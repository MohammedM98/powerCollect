<?php

namespace App\Support\Messaging;

use App\Enums\MessageChannel;
use App\Enums\MessageKind;
use App\Enums\MessageStatus;
use App\Enums\SubscriptionStatus;
use App\Http\Requests\StoreMessageBatchRequest;
use App\Jobs\SendSubscriptionMessage;
use App\Models\Branch;
use App\Models\MessageBatch;
use App\Models\MessageTemplate;
use App\Models\SmsSetting;
use App\Models\Subscription;
use App\Models\SubscriptionMessage;
use App\Models\User;
use App\Notifications\ActionCompleted;
use App\Support\Branches\BranchDomainContext;
use App\Support\Queries\DataTableFilters;
use App\Support\Readings\ReadingWeeks;
use App\Support\Reports\DailySeries;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Builds the messages pages: recipients for each kind of message and the batches sent.
 */
class MessagePage
{
    /**
     * The choices for writing a message: its kinds, the ways of sending, the
     * saved templates, the placeholders of each kind, and each branch's
     * recent reading weeks (each branch reads on its own weeks).
     *
     * @return array<string, mixed>
     */
    public static function writingOptions(User $actor): array
    {
        return [
            'kinds' => MessageKind::options(MessageKind::composable()),
            'channels' => MessageChannel::options(),
            'smsDeliversMessages' => app(SmsGateway::class)->deliversMessages(),
            'templates' => MessageTemplate::query()->orderBy('name')->get(['id', 'name', 'kind', 'body']),
            // Shared company data is changed from the central site only (EnsureBranchDomainAccess).
            'canManageTemplates' => BranchDomainContext::id() === null && $actor->can('create', MessageTemplate::class),
            'placeholders' => collect(MessageKind::composable())
                ->mapWithKeys(fn (MessageKind $kind) => [$kind->value => MessageComposer::placeholdersFor($kind)]),
            'weekOptions' => ReadingWeeks::recentWeekOptionsFor($actor),
        ];
    }

    /**
     * Queue every message of the send that is still waiting.
     */
    public static function dispatchPending(MessageBatch $batch): void
    {
        $batch->messages()
            ->where('status', MessageStatus::Pending)
            ->each(fn (SubscriptionMessage $message) => SendSubscriptionMessage::dispatch($message));
    }

    /**
     * This month's sends, for the figures above the list: how many sends and
     * messages, and how many of those messages went out, wait or failed.
     *
     * @return array{batches: int, messages: int, sent: int, pending: int, failed: int}
     */
    public static function monthSummary(User $actor): array
    {
        $since = DailySeries::today()->startOfMonth()->setTimezone(config('app.timezone'));
        $batches = MessageBatch::query()->visibleTo($actor)->where('created_at', '>=', $since);
        $counts = SubscriptionMessage::query()
            ->whereIn('message_batch_id', (clone $batches)->select('id'))
            ->selectRaw('COUNT(*) as messages')
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as sent', [MessageStatus::Sent->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending', [MessageStatus::Pending->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as failed', [MessageStatus::Failed->value])
            ->first();

        return [
            'batches' => $batches->count(),
            'messages' => (int) $counts->messages,
            'sent' => (int) $counts->sent,
            'pending' => (int) $counts->pending,
            'failed' => (int) $counts->failed,
        ];
    }

    /**
     * What a list or a send's page shows about a send.
     *
     * @return array<string, mixed>
     */
    public static function batchSummary(MessageBatch $batch): array
    {
        return [
            'id' => $batch->id,
            'kind' => $batch->kind->value,
            'kindLabel' => __($batch->kind->label()),
            'channel' => $batch->channel->value,
            'channelLabel' => __($batch->channel->label()),
            'excerpt' => Str::limit($batch->body, 90),
            'weekStart' => $batch->week_start?->toDateString(),
            'branchName' => $batch->branch?->name ?? __('All branches'),
            'createdBy' => $batch->createdBy?->name,
            'createdAt' => $batch->created_at->toIso8601String(),
            'total' => (int) $batch->messages_count,
            'pending' => (int) $batch->pending_count,
            'sent' => (int) $batch->sent_count,
            'failed' => (int) $batch->failed_count,
        ];
    }

    /**
     * The kind of message asked for in the address, a custom one by default.
     */
    public static function requestedKind(Request $request): MessageKind
    {
        return MessageKind::tryFrom((string) $request->input('kind')) ?? MessageKind::Custom;
    }

    /**
     * Who the message goes to, as asked for in the request: for a weekly
     * reading the week (the latest ended one by default) and whether only
     * approved readings count, for a balance reminder the least balance,
     * and the subscription filters — active subscriptions by default.
     *
     * @return array{week_start: string, approved_only: bool, min_balance: float, branch_id: ?string, status: ?string, meter_box_name: ?string, meter_box_id: ?string, circuit_breaker_id: ?string, search: string, subscription_ids: array<int, int>}
     */
    public static function criteria(Request $request): array
    {
        return [
            'week_start' => (string) ($request->input('week_start') ?: ReadingWeeks::latestEndedWeekStart(self::readingBranchId($request))->toDateString()),
            'approved_only' => $request->boolean('approved_only', true),
            'min_balance' => (float) $request->input('min_balance', 0),
            'branch_id' => $request->filled('branch_id') ? (string) $request->input('branch_id') : null,
            'status' => $request->has('status') ? ((string) $request->input('status') ?: null) : SubscriptionStatus::Active->value,
            'meter_box_name' => $request->filled('meter_box_name') ? (string) $request->input('meter_box_name') : null,
            'meter_box_id' => $request->filled('meter_box_id') ? (string) $request->input('meter_box_id') : null,
            'circuit_breaker_id' => $request->filled('circuit_breaker_id') ? (string) $request->input('circuit_breaker_id') : null,
            'search' => trim((string) $request->input('search')),
            'subscription_ids' => array_map('intval', (array) $request->input('subscription_ids', [])),
        ];
    }

    /**
     * The branch whose reading weeks the message follows: the user's own, or
     * for the Super Admin the one asked for, else the first branch, as the
     * page lists the weeks.
     */
    public static function readingBranchId(Request $request): ?int
    {
        $user = $request->user();

        if (! $user->isSuperAdmin()) {
            return $user->workBranchId();
        }

        return $request->filled('branch_id') ? (int) $request->input('branch_id') : Branch::query()->orderBy('name')->value('id');
    }

    /**
     * The recipients for the compose page's preview, at most `$limit` of them.
     *
     * @return array<int, array{id: int, name: string, accountNumber: ?string, phone: ?string, branchId: int, branchName: ?string, variables: array<string, string>}>
     */
    public static function recipientRows(Request $request, User $actor, int $limit = MessageComposer::MAX_RECIPIENTS): array
    {
        $kind = self::requestedKind($request);

        return app(MessageComposer::class)->recipients($kind, $actor, self::criteria($request), $limit)
            ->map(fn (Subscription $subscription) => [
                'id' => $subscription->id,
                'name' => $subscription->displayName(),
                'accountNumber' => $subscription->account_number,
                'phone' => $subscription->contactPhone(),
                'branchId' => $subscription->branch_id,
                'branchName' => $subscription->branch?->name,
                'variables' => app(MessageComposer::class)->variables($subscription, $kind),
            ])
            ->values()
            ->all();
    }

    public static function store(StoreMessageBatchRequest $request): RedirectResponse
    {
        $actor = $request->user();
        $kind = MessageKind::from($request->validated('kind'));
        $channel = MessageChannel::from($request->validated('channel'));
        $body = $request->validated('body');

        $recipients = app(MessageComposer::class)
            ->recipients($kind, $actor, [...MessagePage::criteria($request), 'subscription_ids' => $request->validated('subscription_ids')])
            ->filter(fn (Subscription $subscription): bool => filled($subscription->contactPhone()));

        if ($recipients->isEmpty()) {
            return back()->withErrors(['subscription_ids' => __('None of the chosen subscribers has a phone number and matches the message\'s conditions.')]);
        }

        $branchIds = $recipients->pluck('branch_id')->unique();

        $batch = DB::transaction(function () use ($actor, $kind, $channel, $body, $request, $recipients, $branchIds): MessageBatch {
            $batch = MessageBatch::create([
                'branch_id' => $actor->isSuperAdmin() ? ($branchIds->count() === 1 ? $branchIds->first() : null) : $actor->workBranchId(),
                'kind' => $kind,
                'channel' => $channel,
                'body' => $body,
                'week_start' => $kind === MessageKind::WeeklyReading ? $request->validated('week_start') : null,
                'created_by' => $actor->id,
            ]);

            foreach ($recipients as $subscription) {
                $batch->messages()->create([
                    'subscription_id' => $subscription->id,
                    'branch_id' => $subscription->branch_id,
                    'phone' => $subscription->contactPhone(),
                    'body' => app(MessageComposer::class)->render($body, app(MessageComposer::class)->variables($subscription, $kind)),
                    'status' => MessageStatus::Pending,
                ]);
            }

            return $batch;
        });

        if ($channel === MessageChannel::Sms) {
            MessagePage::dispatchPending($batch);
        }

        $actor->notify(new ActionCompleted('messages-created', __($kind->label()).' — '.$recipients->count()));

        if ($channel === MessageChannel::Sms && $request->boolean('stay_on_page')) {
            return back()->with('status', 'messages-queued');
        }

        return redirect()
            ->route('messages.show', $batch)
            ->with('status', $channel === MessageChannel::Sms ? 'messages-queued' : 'messages-ready');
    }

    public static function show(Request $request, MessageBatch $batch): InertiaResponse
    {

        $actor = $request->user();
        $batch = MessageBatch::query()->withStatusCounts()->with(['branch', 'createdBy'])->findOrFail($batch->id);

        $query = $batch->messages()->getQuery()->with(['subscription', 'sentBy']);
        DataTableFilters::applyDataTableFilters($query, $request, ['phone', 'body'], ['id', 'status', 'sent_at'], 'id');
        DataTableFilters::applyDataTableFilterSelects($query, $request, ['status']);

        $countryCode = SmsSetting::countryCode();

        $messages = $query->paginate(DataTableFilters::dataTablePerPage($request, 25))
            ->withQueryString()
            ->through(fn (SubscriptionMessage $message) => [
                'id' => $message->id,
                'subscriptionName' => $message->subscription?->displayName(),
                'accountNumber' => $message->subscription?->account_number,
                'phone' => $message->phone,
                'body' => $message->body,
                'status' => $message->status->value,
                'statusLabel' => __($message->status->label()),
                'error' => $message->error,
                'sentAt' => $message->sent_at?->toIso8601String(),
                'sentBy' => $message->sentBy?->name,
                'whatsAppLink' => $batch->channel === MessageChannel::WhatsApp
                    ? PhoneNumber::whatsAppLink($message->phone, $message->body, $countryCode)
                    : null,
            ]);

        return Inertia::render('Messages/Show', [
            'batch' => MessagePage::batchSummary($batch) + ['body' => $batch->body],
            'messages' => $messages,
            'canUpdate' => $actor->can('update', $batch),
            'filters' => DataTableFilters::dataTableState($request, 'id', 'asc', 25),
            'filterOptions' => [DataTableFilters::filterGroup('status', __('Status'), MessageStatus::options())],
        ]);
    }
}
