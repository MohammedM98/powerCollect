<?php

namespace App\Support\Closing;

use App\Enums\CashBoxType;
use App\Enums\PaymentMethod;
use App\Models\CashBox;
use App\Models\CashBoxPayment;
use App\Models\ClosingSetting;
use App\Models\SubscriptionTransaction;
use App\Support\Branches\BranchSettings;
use Carbon\CarbonImmutable;

/**
 * Keeps the cash boxes in step with the ledger: a new payment or clearing
 * gets its box entry (starting the branch's closing on its first one), and
 * an edited, corrected or deleted payment moves or leaves its entry while
 * the box is still open.
 */
class ClosingLedgerSync
{
    use RefusesClosingActions;

    public function __construct(private BranchClosingWorkflow $workflow, private CashBoxEntries $entries) {}

    /**
     * Observer hook: a new ledger line gets its box entry.
     */
    public function created(SubscriptionTransaction $payment): void
    {
        $this->capture($payment);
    }

    /**
     * Observer hook: a payment's amount, currency, method or status changed.
     */
    public function updated(SubscriptionTransaction $payment): void
    {
        if ($payment->wasChanged(['currency', 'currency_amount', 'amount', 'payment_method', 'status'])) {
            $this->syncEditablePayment($payment);
        }
    }

    /**
     * Observer hook: a payment about to be deleted leaves its open box.
     */
    public function deleting(SubscriptionTransaction $payment): void
    {
        $this->releaseEditablePayment($payment);
    }

    public function capture(SubscriptionTransaction $payment): void
    {
        if (! in_array($payment->type, [SubscriptionTransaction::TYPE_PAYMENT, SubscriptionTransaction::TYPE_CLEARING], true) || $payment->status !== SubscriptionTransaction::STATUS_ACTIVE) {
            return;
        }
        BranchLock::run($payment->branch_id, function () use ($payment): void {
            app(BranchSettings::class)->forget(ClosingSetting::class);
            if (! ClosingSetting::ownFor($payment->branch_id)?->workflow_started_at) {
                $this->workflow->start($payment->branch_id, $payment->recordedBy()->firstOrFail(), $payment->created_at->toImmutable());

                return;
            }
            $this->workflow->refresh($payment->branch_id);
            // Only this payment: the scheduled closings:process gives a box to any payment missed before.
            if ($payment->created_at->greaterThanOrEqualTo(ClosingSetting::ownFor($payment->branch_id)->workflow_started_at)
                && ! CashBoxPayment::query()->where('subscription_transaction_id', $payment->id)->exists()) {
                $this->entries->attach($payment);
            }
        });
    }

    public function syncOriginalTime(SubscriptionTransaction $payment, CarbonImmutable $occurred): void
    {
        if (! ClosingSetting::ownFor($payment->branch_id)?->workflow_started_at) {
            return;
        }
        BranchLock::run($payment->branch_id, function () use ($payment, $occurred): void {
            $entry = CashBoxPayment::query()->where('subscription_transaction_id', $payment->id)->first();
            $this->require($entry && $entry->box->status === 'open' && $entry->status !== 'confirmed', __('A payment cannot be redistributed after its box was closed or confirmed.'));
            $entry->delete();
            $this->entries->attach($payment, $occurred);
        });
    }

    public function syncEditablePayment(SubscriptionTransaction $payment): void
    {
        if (! ClosingSetting::ownFor($payment->branch_id)?->workflow_started_at) {
            return;
        }
        $entry = CashBoxPayment::query()->where('subscription_transaction_id', $payment->id)->first();
        $box = $entry?->box;
        if (! $box || ! $box->isEditable()) {
            return;
        }
        if (CashBoxType::for($payment) !== $box->type) {
            $occurred = $entry->occurred_at;
            $entry->delete();
            $this->entries->attach($payment, $occurred);
            $this->recountClosed($box);

            return;
        }
        $methodChanged = $entry->method !== $this->entries->method($payment);
        $entry->update([
            ...$this->entries->amount($payment),
            'method' => $this->entries->method($payment),
            ...($methodChanged ? ['status' => $payment->payment_method === PaymentMethod::Cash ? 'cash' : 'pending', 'confirmed_by' => null, 'confirmed_at' => null, 'confirmed_in_closing_id' => null] : []),
        ]);
        $this->recountClosed($box);
    }

    /**
     * Keep a corrected payment in the box that holds the original, while the
     * correction stays attributed to whoever made it: the collector who took
     * the money hands it over at closing, not the head who fixed the amount.
     * A transfer's share must stay with its transfer; any other payment
     * stays where it was recorded when the original's box is no longer open.
     */
    public function syncCorrectedPayment(SubscriptionTransaction $original, SubscriptionTransaction $replacement): void
    {
        if (! $original->isPayment() || ! $replacement->isPayment()) {
            return;
        }
        $share = $original->split_payment_id !== null && $original->split_payment_id === $replacement->split_payment_id;
        $originalEntry = $original->boxEntry()->with('box')->first();
        $replacementEntry = $replacement->boxEntry()->with('box')->first();
        if ($originalEntry === null || $replacementEntry === null || $originalEntry->cash_box_id === $replacementEntry->cash_box_id) {
            return;
        }
        $movable = $originalEntry->box->isEditable() && $replacementEntry->box->isEditable()
            && $originalEntry->box->branch_id === $replacementEntry->box->branch_id
            && $originalEntry->box->type === $replacementEntry->box->type;
        if ($share) {
            $this->require($movable, __('A corrected transfer share cannot be moved out of the original transfer\'s box.'));
        } elseif (! $movable) {
            return;
        }
        $replacementEntry->update([
            'cash_box_id' => $originalEntry->cash_box_id,
            'occurred_at' => $originalEntry->occurred_at,
            'is_late' => $originalEntry->is_late,
        ]);
        $this->recountClosed($originalEntry->box);
        $this->recountClosed($replacementEntry->box);
    }

    public function releaseEditablePayment(SubscriptionTransaction $payment): void
    {
        $entry = CashBoxPayment::query()->where('subscription_transaction_id', $payment->id)->first();
        if ($entry) {
            $box = $entry->box;
            $this->require($box->isEditable(), __('A payment linked to a closed box cannot be deleted.'));
            $entry->delete();
            $this->recountClosed($box);
        }
    }

    /**
     * Keep legacy boxes that have not been confirmed closed in step with
     * their collector's corrections.
     */
    private function recountClosed(CashBox $box): void
    {
        if ($box->status === 'pending') {
            $box->update(['expected_counts' => CashBoxCounts::expected($box)]);
        }
    }
}
