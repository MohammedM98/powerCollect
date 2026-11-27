<?php

namespace App\Support\Closing;

use App\Enums\CashBoxType;
use App\Models\AuditNote;
use App\Models\CashBox;
use App\Models\CashBoxPayment;
use App\Models\Closing;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Notifications\BranchClosingNotification;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;

/**
 * The branch's side of a collector's boxes: confirming them closed, one or
 * a picked set at a time, reviewing their transfers and clearings, the
 * owner's confirmation, and the collector's reply to an audit note.
 */
class CashBoxReceiving
{
    use RefusesClosingActions;

    /**
     * The branch confirms a collector's box closed, in one step: it looked
     * over the entries, had the collector correct any mistake in them
     * first, and closes the box for audit review. Every type of box
     * closes the same way, cash as transfers: nothing is counted, a box
     * holds what its entries say, and the audit rejects what it finds
     * wrong. Once confirmed, the box's entries can no longer be corrected.
     */
    public function receive(CashBox $box, User $actor): void
    {
        BranchLock::run($box->branch_id, function () use ($box, $actor): void {
            $current = CashBox::query()->lockForUpdate()->findOrFail($box->id);
            $this->require($current->isEditable() && self::mayReceive($current, $actor), __('You cannot confirm closing this box.'));
            $this->accept($current, $actor);
            $box->refresh();
        });
    }

    /**
     * Confirms a box closed for the branch: closes it if it is still open,
     * takes its transfers and clearings as confirmed, and settles it in the
     * earliest week not yet sent from its own week on.
     */
    private function accept(CashBox $box, User $actor): void
    {
        $this->require($box->payments()->exists(), __('An empty box cannot be closed.'));
        $settling = $this->settlingClosing($box);
        $box->payments()->where('status', 'pending')->whereHas('transaction', fn ($query) => $query->where('status', SubscriptionTransaction::STATUS_ACTIVE))
            ->update(['status' => 'confirmed', 'confirmed_by' => $actor->id, 'confirmed_at' => now(), 'confirmed_in_closing_id' => $settling->id]);
        $expected = CashBoxCounts::expected($box);
        $box->update([
            'status' => 'received', 'closed_at' => now(), 'close_reason' => 'manual', 'open_key' => null,
            'received_by' => $actor->id, 'received_at' => now(), 'confirmed_at' => now(), 'received_in_closing_id' => $settling->id,
            'expected_counts' => $expected,
            ...($box->type->isCounted() ? ['head_counts' => $expected, 'decisions' => []] : []),
        ]);
        $box->user?->notify(new BranchClosingNotification(__('The branch confirmed closing your box.'), $box->number));
    }

    /**
     * The branch's open boxes that hold entries and that the actor may
     * confirm closed, oldest first: of one type when `$type` is given, and
     * one person's when `$userId` is.
     *
     * @return EloquentCollection<int, CashBox>
     */
    public static function closableBoxes(int $branchId, User $actor, ?CashBoxType $type = null, ?int $userId = null): EloquentCollection
    {
        return CashBox::query()->where('branch_id', $branchId)->whereIn('status', ['open', 'pending'])
            ->when($type, fn ($query) => $query->where('type', $type))
            ->when($userId, fn ($query) => $query->where('user_id', $userId))
            ->whereHas('payments')->orderBy('id')->get()
            ->filter(fn (CashBox $box): bool => self::mayReceive($box, $actor))->values();
    }

    /**
     * The branch confirms the open boxes of one type it picked closed at
     * once (`$boxIds`), each as `receive()` confirms a single box. Nothing
     * is closed when any of them is no longer open or not the actor's to
     * close.
     *
     * @param  list<int>  $boxIds
     */
    public function receiveType(int $branchId, User $actor, CashBoxType $type, array $boxIds): void
    {
        $boxes = self::closableBoxes($branchId, $actor, $type)->whereIn('id', $boxIds);
        $this->require($boxIds !== [] && $boxes->count() === count(array_unique($boxIds)), __('Some of the chosen boxes are no longer open or you cannot close them.'));
        foreach ($boxes as $box) {
            $this->receive($box, $actor);
        }
    }

    public static function mayReceive(CashBox $box, User $actor): bool
    {
        return BranchClosingAccess::receive($actor, $box->branch_id)
            && ($box->user_id !== $actor->id || BranchClosingAccess::approve($actor, $box->branch_id));
    }

    /**
     * The week a box received now is kept under: the earliest week from the
     * box's own on that was not sent as a package (as weeks once were).
     */
    private function settlingClosing(CashBox $box): Closing
    {
        return Closing::query()->where('branch_id', $box->branch_id)->whereNotNull('workflow_settings')->whereNull('submitted_at')
            ->where('coverage_from', '>=', $box->closing->coverage_from)
            ->orderBy('coverage_from')->orderBy('id')->first() ?? Closing::currentFor($box->branch_id);
    }

    public function confirmBox(CashBox $box, User $actor): void
    {
        $this->require($box->type->isCounted() && $actor->id === $box->user_id && $box->status === 'received' && $box->close_reason !== CashBox::CLOSE_REASON_PERIOD_END && ! $box->confirmed_at, __('Only the box owner can confirm, after it is received.'));
        $box->update(['confirmed_at' => now()]);
    }

    public function reviewEntry(CashBoxPayment $payment, User $actor, string $status): void
    {
        BranchLock::run($payment->box->branch_id, function () use ($payment, $actor, $status): void {
            $payment->refresh()->load('box');
            $this->require($payment->box->isEditable(), __('A transaction in a closed box cannot be changed.'));
            $allowed = $payment->method === 'clearing' ? ['confirmed', 'rejected'] : ['confirmed', 'missing'];
            $this->require($payment->method !== 'cash' && in_array($status, $allowed, true) && $payment->status !== 'confirmed', __('A confirmed payment cannot be changed.'));
            $this->require(self::mayReceive($payment->box, $actor), __('You cannot review this box\'s transactions.'));
            $this->require($payment->transaction->status === SubscriptionTransaction::STATUS_ACTIVE, __('The payment is cancelled or refunded.'));
            $closing = $this->settlingClosing($payment->box);
            $payment->update(['status' => $status, 'confirmed_by' => $actor->id, 'confirmed_at' => $status === 'confirmed' ? now() : null, 'confirmed_in_closing_id' => $status === 'confirmed' ? $closing->id : null]);
            $box = $payment->box;
            if (in_array($status, ['missing', 'rejected'], true)) {
                foreach (User::query()->where('is_active', true)->get()->filter(fn (User $user): bool => BranchClosingAccess::manage($user, $box->branch_id)) as $admin) {
                    $admin->notify(new BranchClosingNotification(__('A rejected transaction needs the branch\'s review.'), $box->number, ['entry_id' => $payment->id, 'status' => $status]));
                }
            }
        });
    }

    /**
     * The collector's answer to an audit note the branch sent them; it goes
     * back to the branch to pass on to the auditor.
     */
    public function collectorReply(AuditNote $note, User $actor, string $body): void
    {
        $this->require($note->assigned_to === $actor->id && $note->status === 'with_collector', __('The note is not waiting for your reply.'));
        $note->replies()->create(['user_id' => $actor->id, 'kind' => 'collector_response', 'body' => $body]);
        $note->update(['status' => 'collector_replied']);
    }
}
