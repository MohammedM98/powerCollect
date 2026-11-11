<?php

namespace App\Http\Controllers;

use App\Enums\DisconnectionReason;
use App\Http\Requests\AddDisconnectionItemsRequest;
use App\Http\Requests\ConfirmDisconnectionItemsRequest;
use App\Http\Requests\PreviewDisconnectionItemsRequest;
use App\Http\Requests\RemoveDisconnectionItemsRequest;
use App\Http\Requests\RescheduleDisconnectionItemsRequest;
use App\Http\Requests\WarnDisconnectionItemsRequest;
use App\Models\DisconnectionList;
use App\Models\DisconnectionListItem;
use App\Models\Subscription;
use App\Notifications\ActionCompleted;
use App\Support\Disconnections\DisconnectionItemPage;
use App\Support\Disconnections\DisconnectionItemPresenter;
use App\Support\Ledger\Money;
use App\Support\Messaging\MessageComposer;
use App\Support\Queries\DisconnectionItemsQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

/**
 * What is done to the subscriptions on a disconnection list, one or many at
 * a time: adding them, moving their date, removing them, warning them and
 * confirming their disconnection. Every bulk action starts from a preview of
 * exactly which subscriptions it reaches, then acts on those, each on its
 * own, and reports how each one went.
 */
class DisconnectionItemController extends Controller
{
    public function __construct(private MessageComposer $composer) {}

    /**
     * Put the chosen subscriptions on the list: the ticked ones, or every
     * match of the candidates page.
     */
    public function store(AddDisconnectionItemsRequest $request, DisconnectionList $disconnectionList): RedirectResponse
    {
        if ($disconnectionList->isClosed()) {
            return back()->withErrors(['ids' => 'القائمة مغلقة؛ أعد فتحها لإضافة مشتركين.']);
        }

        $query = $request->boolean('all')
            ? DisconnectionListController::candidateQuery($disconnectionList, $request)
            : Subscription::query()->where('branch_id', $disconnectionList->branch_id)->whereIn('id', $request->validated('ids'))->orderBy('id');
        $subscriptions = $query->limit(AddDisconnectionItemsRequest::MAX_SUBSCRIPTIONS + 1)->get();

        if ($subscriptions->count() > AddDisconnectionItemsRequest::MAX_SUBSCRIPTIONS) {
            return back()->withErrors(['ids' => 'يمكن إضافة '.AddDisconnectionItemsRequest::MAX_SUBSCRIPTIONS.' مشترك على الأكثر في المرة الواحدة؛ ضيّق الفلاتر.']);
        }

        $result = $disconnectionList->addSubscriptions(
            $subscriptions,
            DisconnectionReason::from($request->validated('reason')),
            $request->validated('note'),
            Carbon::parse($request->validated('scheduled_for')),
            $request->user(),
        );

        Inertia::flash('disconnectionResult', [
            'action' => 'add',
            'succeeded' => count($result['added']),
            'failed' => $result['skipped'],
        ]);

        if ($result['added'] === []) {
            return back()->withErrors(['ids' => 'لم يُضف أي مشترك؛ راجع الأسباب في التقرير.']);
        }

        $request->user()->notify(new ActionCompleted('disconnection-items-added', $disconnectionList->title.' — '.count($result['added'])));

        return back()->with('status', 'disconnection-items-added');
    }

    /**
     * Exactly which items an action would reach — the ticked ones, or every
     * match of the list's search and filters — with what the action needs to
     * show: their status, balance, fee and, for those who may warn, phone.
     */
    public function preview(PreviewDisconnectionItemsRequest $request, DisconnectionList $disconnectionList): JsonResponse
    {

        $query = $request->boolean('all')
            ? DisconnectionItemsQuery::filteredDisconnectionItems($disconnectionList, $request)
            : $disconnectionList->items()->whereIn('id', array_map('intval', $request->input('ids')))->orderBy('id');
        $items = $query->with(DisconnectionItemPresenter::disconnectionItemRelations())->limit(RescheduleDisconnectionItemsRequest::MAX_ITEMS + 1)->get();
        $withPhone = $request->user()->can('warn', $disconnectionList);

        return response()->json([
            'tooMany' => $items->count() > RescheduleDisconnectionItemsRequest::MAX_ITEMS,
            'max' => RescheduleDisconnectionItemsRequest::MAX_ITEMS,
            'items' => $items->take(RescheduleDisconnectionItemsRequest::MAX_ITEMS)->map(fn (DisconnectionListItem $item) => DisconnectionItemPresenter::disconnectionItemRow($item, $withPhone))->values(),
        ]);
    }

    /**
     * Move the chosen items' date — any number of times. Nothing is sent.
     */
    public function reschedule(RescheduleDisconnectionItemsRequest $request, DisconnectionList $disconnectionList): RedirectResponse
    {
        if ($disconnectionList->isClosed()) {
            return back()->withErrors(['ids' => 'القائمة مغلقة.']);
        }

        $date = Carbon::parse($request->validated('scheduled_for'));
        $reason = $request->validated('reason');

        return DisconnectionItemPage::eachItem($request, $disconnectionList, 'reschedule', 'disconnection-items-rescheduled', fn (DisconnectionListItem $item): ?string => $item->reschedule($date, $request->user(), $reason) ? null : 'لم يعد بانتظار القطع');
    }

    /**
     * Take the chosen items off the list; their history stays.
     */
    public function remove(RemoveDisconnectionItemsRequest $request, DisconnectionList $disconnectionList): RedirectResponse
    {
        if ($disconnectionList->isClosed()) {
            return back()->withErrors(['ids' => 'القائمة مغلقة.']);
        }

        $reason = $request->validated('reason');

        return DisconnectionItemPage::eachItem($request, $disconnectionList, 'remove', 'disconnection-items-removed', fn (DisconnectionListItem $item): ?string => $item->remove($request->user(), $reason) ? null : 'لم يعد بانتظار القطع');
    }

    /**
     * Warn the chosen subscriptions who wait on the list and have a phone
     * number: an SMS through the gateway, or WhatsApp messages the staff
     * member sends from the send's page. The same send (`operation_id`)
     * arriving again sends nothing more; a new warning to the same people
     * is a new send.
     */
    public function warn(WarnDisconnectionItemsRequest $request, DisconnectionList $disconnectionList): RedirectResponse
    {
        return DisconnectionItemPage::warn($request, $disconnectionList);
    }

    /**
     * Confirm that the chosen subscriptions have really been disconnected:
     * each is disconnected and charged the fee chosen for it on its own,
     * after checking again under lock that it still waits and its service is
     * still on. Each one's result is reported.
     */
    public function confirm(ConfirmDisconnectionItemsRequest $request, DisconnectionList $disconnectionList): RedirectResponse
    {
        $actor = $request->user();
        $succeeded = 0;
        $failed = [];
        $feesTotal = '0.00';

        foreach ($request->items() as $item) {
            $outcome = $item->confirmDisconnection($actor, $request->feeFor($item->id));

            if ($outcome === 'disconnected') {
                $succeeded++;
                $feesTotal = Money::add($feesTotal, $item->fee_amount);
            } else {
                $failed[] = DisconnectionItemPage::failure($item, DisconnectionListItem::OUTCOMES[$outcome]);
            }
        }

        $missing = count($request->validated('ids')) - $request->items()->count();

        if ($missing > 0) {
            $failed[] = ['id' => null, 'name' => $missing.' من المختارين', 'accountNumber' => null, 'reason' => 'ليسوا في هذه القائمة'];
        }

        Log::info('Disconnections confirmed', [
            'list_id' => $disconnectionList->id,
            'user_id' => $actor->id,
            'succeeded' => $succeeded,
            'failed' => count($failed),
            'fees_total' => $feesTotal,
        ]);

        Inertia::flash('disconnectionResult', [
            'action' => 'confirm',
            'succeeded' => $succeeded,
            'failed' => $failed,
            'feesTotal' => number_format($feesTotal, 2, '.', ''),
        ]);

        if ($succeeded === 0) {
            return back()->withErrors(['ids' => 'لم يُؤكَّد قطع أي مشترك؛ راجع الأسباب في التقرير.']);
        }

        $actor->notify(new ActionCompleted('disconnections-confirmed', $disconnectionList->title.' — '.$succeeded));

        return back()->with('status', $failed === [] ? 'disconnections-confirmed' : 'disconnections-confirmed-partly');
    }
}
