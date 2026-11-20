<?php

namespace App\Support\Ledger;

use App\Enums\CorrectionReason;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Closing\BranchClosingWorkflow;
use Closure;

/**
 * Corrects a ledger line: cancels it, then records the right line in its place.
 */
class CorrectLine
{
    /**
     * Correct the line: cancel it as cancel() does, then record the right
     * line in its place with `$record`, which gets the subscription (whose
     * balance no longer counts this line) and returns the new line.
     *
     * @param  Closure(Subscription): SubscriptionTransaction  $record
     */
    public static function correct(SubscriptionTransaction $transaction, User $actor, CorrectionReason $reason, ?string $notes, Closure $record): SubscriptionTransaction
    {
        return $transaction->withMutationLock(function () use ($actor, $reason, $notes, $record, $transaction): SubscriptionTransaction {
            CancelLine::cancelSingle($transaction, $actor, $reason, $notes);

            $replacement = $record($transaction->subscription);
            $replacement->update([
                'corrects_id' => $transaction->id,
                ...($transaction->isPayment() && $replacement->isPayment() ? [
                    'paid_on' => $transaction->paid_on,
                    'late_reason' => $transaction->late_reason,
                ] : []),
            ]);
            app(BranchClosingWorkflow::class)->syncCorrectedPayment($transaction, $replacement);

            return $replacement;
        });
    }
}
