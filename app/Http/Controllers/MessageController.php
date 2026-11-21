<?php

namespace App\Http\Controllers;

use App\Enums\MessageChannel;
use App\Enums\MessageKind;
use App\Enums\MessageStatus;
use App\Enums\SubscriptionStatus;
use App\Http\Requests\MessageRecipientsRequest;
use App\Http\Requests\SettleUnconfirmedMessageRequest;
use App\Http\Requests\StoreMessageBatchRequest;
use App\Jobs\SendSubscriptionMessage;
use App\Models\MessageBatch;
use App\Models\MeterBox;
use App\Models\Subscription;
use App\Models\SubscriptionMessage;
use App\Support\Messaging\MessageComposer;
use App\Support\Messaging\MessagePage;
use App\Support\Queries\DataTableFilters;
use App\Support\Queries\SubscriptionListQuery;
use App\Support\Readings\ReadingWeeks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Messages to subscriptions: a weekly reading, a reminder of what they owe,
 * or any news. A message is written once with `{placeholders}`, sent to
 * the picked subscriptions with each one's own details filled in, and kept
 * as a send (MessageBatch) with a message per subscription. SMS go out
 * through the SMS gateway on the queue; WhatsApp messages are sent by the
 * staff member from their own WhatsApp, one by one, from the send's page.
 */
class MessageController extends Controller
{
    /**
     * The most subscriptions a search in the quick message window lists.
     */
    public const SEARCH_RESULTS = 8;

    public function __construct(private MessageComposer $composer) {}

    /**
     * Every send so far, newest first.
     */
    public function index(Request $request): InertiaResponse
    {
        $this->authorize('viewAny', MessageBatch::class);

        $actor = $request->user();

        $query = MessageBatch::query()->visibleTo($actor)->withStatusCounts()->with(['branch', 'createdBy']);
        DataTableFilters::applyDataTableFilters($query, $request, ['body'], ['created_at'], 'created_at', 'desc');
        DataTableFilters::applyDataTableFilterSelects($query, $request, ['kind', 'channel', 'branch_id']);

        $batches = $query->paginate(DataTableFilters::dataTablePerPage($request))
            ->withQueryString()
            ->through(fn (MessageBatch $batch) => MessagePage::batchSummary($batch));

        $filterOptions = [
            DataTableFilters::filterGroup('kind', 'النوع', MessageKind::options()),
            DataTableFilters::filterGroup('channel', 'طريقة الإرسال', MessageChannel::options()),
        ];

        if ($actor->isSuperAdmin()) {
            $filterOptions[] = DataTableFilters::branchFilterGroup();
        }

        return Inertia::render('Messages/Index', [
            'batches' => $batches,
            'canSend' => $actor->can('create', MessageBatch::class),
            'filters' => DataTableFilters::dataTableState($request, 'created_at', 'desc'),
            'filterOptions' => $filterOptions,
            'monthSummary' => fn () => MessagePage::monthSummary($actor),
        ]);
    }

    /**
     * Write a message. Its recipients load on request (`only: ['recipients']`)
     * from the criteria in the address, each with the values for the
     * placeholders, so the page shows every subscription's own text as the
     * message is typed.
     */
    public function create(Request $request): InertiaResponse
    {
        $this->authorize('create', MessageBatch::class);

        $actor = $request->user();
        $meterBoxes = MeterBox::query()->visibleTo($actor)->with(['branch', 'subArea'])->orderBy('box_number')->get();

        return Inertia::render('Messages/Create', [
            ...MessagePage::writingOptions($actor),
            'weekBranchId' => MessagePage::readingBranchId($request),
            'statusOptions' => SubscriptionStatus::options(),
            'branchOptions' => $actor->isSuperAdmin() ? DataTableFilters::branchFilterGroup()['options'] : [],
            'meterBoxGroups' => DataTableFilters::meterBoxFilterGroups(
                $meterBoxes,
                $actor->isSuperAdmin() ? fn (MeterBox $box) => $box->branch->name : null,
            ),
            'circuitBreakerOptions' => DataTableFilters::circuitBreakerFilterGroup()['options'],
            'maxRecipients' => MessageComposer::MAX_RECIPIENTS,
            'criteria' => MessagePage::criteria($request) + ['kind' => MessagePage::requestedKind($request)->value],
            'recipients' => Inertia::optional(fn () => MessagePage::recipientRows($request, $actor)),
        ]);
    }

    /**
     * What the quick message window needs to write a message from any page,
     * as JSON: the same choices as the messages page, the week a weekly
     * reading starts on, and how many subscriptions it may reach.
     */
    public function quick(Request $request): JsonResponse
    {
        $this->authorize('create', MessageBatch::class);

        $weekBranchId = MessagePage::readingBranchId($request);

        return response()->json([
            ...MessagePage::writingOptions($request->user()),
            'weekBranchId' => $weekBranchId,
            'weekStart' => ReadingWeeks::latestEndedWeekStart($weekBranchId)->toDateString(),
            'maxRecipients' => MessageComposer::MAX_RECIPIENTS,
        ]);
    }

    /**
     * Subscriptions for the quick message window, as JSON: a few whose name,
     * phone or account matches `search`, to pick from, or of the picked
     * `subscription_ids` those the kind of message reaches (for a weekly
     * reading, who has a reading that week), each with the values for the
     * placeholders. Nothing without either.
     */
    public function recipients(MessageRecipientsRequest $request): JsonResponse
    {

        if ($request->boolean('selection.all')) {
            $selectionRequest = new Request([
                'search' => $request->input('selection.search', ''),
                'filter' => $request->input('selection.filter', []),
            ]);
            $query = Subscription::query()->visibleTo($request->user());
            $ids = SubscriptionListQuery::applySubscriptionListFilters($query, $selectionRequest)
                ->reorder()->limit(MessageComposer::MAX_RECIPIENTS + 1)->pluck('subscriptions.id')->all();

            if (count($ids) > MessageComposer::MAX_RECIPIENTS) {
                throw ValidationException::withMessages(['selection' => 'يمكن مراسلة '.MessageComposer::MAX_RECIPIENTS.' اشتراك على الأكثر؛ ضيّق الفلاتر ثم أعد المحاولة.']);
            }

            $request->merge(['subscription_ids' => $ids, 'status' => '', 'search' => '']);

            return response()->json(['recipients' => $ids === [] ? [] : MessagePage::recipientRows($request, $request->user())]);
        }

        $searching = $request->filled('search');

        if (! $searching && ! $request->filled('subscription_ids')) {
            return response()->json(['recipients' => []]);
        }

        return response()->json([
            'recipients' => MessagePage::recipientRows($request, $request->user(), $searching ? self::SEARCH_RESULTS : MessageComposer::MAX_RECIPIENTS),
        ]);
    }

    /**
     * Send the message to the picked subscriptions who have a phone number,
     * then open the send — or, for SMS sent from the quick message window
     * (`stay_on_page`), stay on the page it was written on.
     */
    public function store(StoreMessageBatchRequest $request): RedirectResponse
    {
        return MessagePage::store($request);
    }

    /**
     * One send: its wording and every subscription's message with how it went.
     */
    public function show(Request $request, MessageBatch $batch): InertiaResponse
    {
        $this->authorize('view', $batch);

        return MessagePage::show($request, $batch);
    }

    /**
     * Send a send's SMS that are still waiting or failed again.
     */
    public function retry(Request $request, MessageBatch $batch): RedirectResponse
    {
        $this->authorize('update', $batch);

        if ($batch->channel !== MessageChannel::Sms) {
            return back()->withErrors(['retry' => 'رسائل واتساب تُرسل من القائمة واحدة واحدة.']);
        }

        $batch->messages()->where('status', MessageStatus::Failed)->update(['status' => MessageStatus::Pending, 'error' => null]);
        MessagePage::dispatchPending($batch);

        return back()->with('status', 'messages-retried');
    }

    /**
     * Record that a WhatsApp message was sent by the staff member.
     */
    public function markSent(Request $request, MessageBatch $batch, SubscriptionMessage $message): RedirectResponse
    {
        $this->authorize('update', $batch);

        if ($batch->channel !== MessageChannel::WhatsApp) {
            return back()->withErrors(['message' => 'رسائل SMS تُسجَّل مرسلة عند إرسالها.']);
        }

        $message->markSent($request->user());

        return back();
    }

    /**
     * Settle an SMS the gateway did not confirm, once someone has checked
     * with the subscriber or the provider: it arrived (`delivered`), or it
     * did not and is sent again (`resend`).
     */
    public function settleUnconfirmed(SettleUnconfirmedMessageRequest $request, MessageBatch $batch, SubscriptionMessage $message): RedirectResponse
    {
        $outcome = $request->validated('outcome');

        if ($message->status !== MessageStatus::Unconfirmed) {
            return back()->withErrors(['message' => 'هذه الرسالة ليست بانتظار التأكيد.']);
        }

        if ($outcome === 'delivered') {
            $message->markSent($request->user());

            return back()->with('status', 'message-confirmed');
        }

        $message->update(['status' => MessageStatus::Pending, 'error' => null]);
        SendSubscriptionMessage::dispatch($message);

        return back()->with('status', 'message-resent');
    }
}
