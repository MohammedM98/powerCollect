<?php

namespace App\Support\Disconnections;

use App\Enums\DisconnectionEventType;
use App\Enums\MessageChannel;
use App\Enums\MessageKind;
use App\Enums\MessageStatus;
use App\Http\Requests\RemoveDisconnectionItemsRequest;
use App\Http\Requests\RescheduleDisconnectionItemsRequest;
use App\Http\Requests\WarnDisconnectionItemsRequest;
use App\Jobs\SendSubscriptionMessage;
use App\Models\DisconnectionList;
use App\Models\DisconnectionListItem;
use App\Models\MessageBatch;
use App\Models\Subscription;
use App\Models\SubscriptionMessage;
use App\Notifications\ActionCompleted;
use App\Support\Messaging\MessageComposer;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Helpers for the actions on a disconnection list's items.
 */
class DisconnectionItemPage
{
    /**
     * Apply the action to each chosen item on its own and report the items
     * it could not be applied to.
     *
     * @param  callable(DisconnectionListItem): ?string  $apply  returns why it failed, or null
     */
    public static function eachItem(RescheduleDisconnectionItemsRequest|RemoveDisconnectionItemsRequest $request, DisconnectionList $list, string $action, string $status, callable $apply): RedirectResponse
    {
        $succeeded = 0;
        $failed = [];

        foreach ($request->items() as $item) {
            $why = $apply($item);

            if ($why === null) {
                $succeeded++;
            } else {
                $failed[] = self::failure($item, $why);
            }
        }

        Inertia::flash('disconnectionResult', ['action' => $action, 'succeeded' => $succeeded, 'failed' => $failed]);

        if ($succeeded === 0) {
            return back()->withErrors(['ids' => 'لم يُطبَّق الإجراء على أي مشترك؛ راجع الأسباب في التقرير.']);
        }

        $request->user()->notify(new ActionCompleted($status, $list->title.' — '.$succeeded));

        return back()->with('status', $status);
    }

    /**
     * An item an action could not be applied to, and why.
     *
     * @return array{id: int, name: string, accountNumber: ?string, reason: string}
     */
    public static function failure(DisconnectionListItem $item, string $reason): array
    {
        return [
            'id' => $item->id,
            'name' => $item->subscription->displayName(),
            'accountNumber' => $item->subscription->account_number,
            'reason' => $reason,
        ];
    }

    public static function warn(WarnDisconnectionItemsRequest $request, DisconnectionList $disconnectionList): RedirectResponse
    {
        $actor = $request->user();
        $operationId = $request->validated('operation_id');

        if ($existing = MessageBatch::query()->where('operation_id', $operationId)->first()) {
            return redirect()->route('messages.show', $existing)->with('status', 'disconnection-warning-already-sent');
        }

        if ($disconnectionList->isClosed()) {
            return back()->withErrors(['ids' => 'القائمة مغلقة.']);
        }

        $channel = MessageChannel::from($request->validated('channel'));
        $body = $request->validated('body');
        $failed = [];
        $recipients = [];

        foreach ($request->items() as $item) {
            $phone = $item->subscription->contactPhone();

            if (! $item->isScheduled()) {
                $failed[] = DisconnectionItemPage::failure($item, 'لم يعد بانتظار القطع');
            } elseif (! filled($phone)) {
                $failed[] = DisconnectionItemPage::failure($item, 'لا يوجد رقم هاتف');
            } else {
                $recipients[] = $item;
            }
        }

        if ($recipients === []) {
            Inertia::flash('disconnectionResult', ['action' => 'warn', 'succeeded' => 0, 'failed' => $failed]);

            return back()->withErrors(['ids' => 'لا يوجد بين المختارين من ينتظر القطع ولديه رقم هاتف.']);
        }

        try {
            $batch = DB::transaction(function () use ($actor, $disconnectionList, $channel, $body, $operationId, $recipients): MessageBatch {
                $batch = MessageBatch::create([
                    'branch_id' => $disconnectionList->branch_id,
                    'kind' => MessageKind::DisconnectionWarning,
                    'channel' => $channel,
                    'body' => $body,
                    'created_by' => $actor->id,
                    'operation_id' => $operationId,
                ]);

                foreach ($recipients as $item) {
                    $subscription = Subscription::query()->withSum('transactions as balance', 'amount')->with(['branch', 'meterBox'])->findOrFail($item->subscription_id);
                    $message = $batch->messages()->create([
                        'subscription_id' => $subscription->id,
                        'branch_id' => $subscription->branch_id,
                        'phone' => $subscription->contactPhone(),
                        'body' => app(MessageComposer::class)->render($body, [
                            ...app(MessageComposer::class)->variables($subscription, MessageKind::DisconnectionWarning),
                            'موعد_القطع' => $item->scheduled_for->format('d/m/Y'),
                        ]),
                        'status' => MessageStatus::Pending,
                    ]);

                    DisconnectionListItem::query()->whereKey($item->id)->update([
                        'warnings_count' => DB::raw('warnings_count + 1'),
                        'last_warned_at' => now(),
                    ]);
                    $item->recordEvent(DisconnectionEventType::Warned, $actor, null, ['channel' => $channel->value, 'message_batch_id' => $batch->id], null, $message->id);
                }

                return $batch;
            });
        } catch (UniqueConstraintViolationException) {
            // The same send arrived twice at once: the other request sent it.
            $existing = MessageBatch::query()->where('operation_id', $operationId)->firstOrFail();

            return redirect()->route('messages.show', $existing)->with('status', 'disconnection-warning-already-sent');
        }

        if ($channel === MessageChannel::Sms) {
            $batch->messages()->where('status', MessageStatus::Pending)->each(fn (SubscriptionMessage $message) => SendSubscriptionMessage::dispatch($message));
        }

        Inertia::flash('disconnectionResult', [
            'action' => 'warn',
            'succeeded' => count($recipients),
            'failed' => $failed,
            'batchId' => $batch->id,
            'channel' => $channel->value,
        ]);
        $actor->notify(new ActionCompleted('disconnection-warnings-created', $disconnectionList->title.' — '.count($recipients)));

        return back()->with('status', $channel === MessageChannel::Sms ? 'disconnection-warnings-queued' : 'disconnection-warnings-ready');
    }
}
