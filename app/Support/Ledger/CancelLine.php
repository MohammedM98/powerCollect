<?php

namespace App\Support\Ledger;

use App\Enums\CorrectionReason;
use App\Models\Closing;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Cancels a ledger line: marks it cancelled (who, when, why) and adds the reversal that takes its amount back off the balance.
 */
class CancelLine
{
    /**
     * Delete the line: mark it cancelled — by whom, when and why — and add
     * a reversal that takes its amount back off the balance.
     * Returns the reversal.
     *
     * A weekly reading's charge cancelled this way is a waiver: its reading
     * stays approved and is never billed again. With `$reopenReading` the
     * reading instead goes back for review, to be corrected and billed afresh.
     *
     * @throws ValidationException when the line was cancelled meanwhile, or
     *                             a submitted or approved closing counted it
     */
    public static function cancel(SubscriptionTransaction $transaction, User $actor, CorrectionReason $reason, ?string $notes, bool $reopenReading = false): SubscriptionTransaction
    {
        $split = $transaction->isPayment() ? $transaction->splitPayment : null;
        if ($split === null) {
            return CancelLine::cancelSingle($transaction, $actor, $reason, $notes, $reopenReading);
        }

        return $split->withPaymentsLocked($actor, function (Collection $parts) use ($actor, $reason, $notes, $transaction): SubscriptionTransaction {
            $selected = $parts->find($transaction->id);
            if ($selected === null || $selected->isCancelled()) {
                throw ValidationException::withMessages(['action' => __('This payment was already cancelled or refunded.')]);
            }
            $active = $parts->reject(fn (SubscriptionTransaction $part): bool => $part->isCancelled());
            foreach ($active as $part) {
                if (! $actor->can('delete', $part)) {
                    throw ValidationException::withMessages(['action' => __('The split transfer cannot be cancelled: one of its parts is closed or may not be cancelled.')]);
                }
            }
            $result = null;
            foreach ($active as $part) {
                $hasEarlierRefund = SubscriptionTransaction::query()->where('reference_transaction_id', $part->id)->where('type', SubscriptionTransaction::TYPE_REFUND)->lockForUpdate()->exists();
                if ($hasEarlierRefund) {
                    $reversal = TransactionActions::applyRefund($part, $actor, ['correction_notes' => $notes]);
                    $part->update(['cancellation_reason' => $reason]);
                } else {
                    $reversal = CancelLine::cancelSingle($part, $actor, $reason, $notes);
                }
                if ($part->id === $transaction->id) {
                    $transaction->setRawAttributes($part->getAttributes(), true);
                    $result = $reversal;
                }
            }

            return $result;
        });
    }

    public static function cancelSingle(SubscriptionTransaction $transaction, User $actor, CorrectionReason $reason, ?string $notes, bool $reopenReading = false): SubscriptionTransaction
    {
        return $transaction->withMutationLock(function () use ($actor, $reason, $notes, $reopenReading, $transaction): SubscriptionTransaction {
            if (LineHistory::isInClosedDay($transaction, lockForUpdate: true)) {
                throw ValidationException::withMessages(['reason' => __('A payment in a closed box or in a closing sent for audit or approved cannot be cancelled.')]);
            }

            // Cancelling a weekly reading's bill waives it for good (the key it is billed by stays) unless the reading is sent back for review.
            $reversal = CancelLine::reverse($transaction, $actor, $reason, $notes, fn (SubscriptionTransaction $line): bool => LineRules::isCancellable($line), freeSourceKey: $reopenReading && $transaction->isBilledByReading());

            // A weekly reading's standing discount only stands beside its charge.
            $standingDiscount = LineHistory::readingDiscountStanding($transaction);
            if ($standingDiscount !== null) {
                self::reverse($standingDiscount, $actor, $reason, $notes, fn (SubscriptionTransaction $line): bool => ! $line->isCancelled(), freeSourceKey: $reopenReading);
            }

            if ($reopenReading) {
                TransactionActions::reopenReading($transaction);
            }

            return $reversal;
        });
    }

    /**
     * Cancel a weekly reading's charge or standing-discount line when the
     * reading is corrected or rebilled, as cancel() does. Its key is freed
     * so the line the reading is billed with next can take it.
     */
    public static function cancelForReading(SubscriptionTransaction $transaction, User $actor, CorrectionReason $reason): SubscriptionTransaction
    {
        return CancelLine::reverse($transaction, $actor, $reason, null, fn (SubscriptionTransaction $line): bool => ! $line->isCancelled(), freeSourceKey: true);
    }

    /**
     * Mark the line cancelled and add its reversal, once `$mayCancel`
     * allows it on the locked line.
     *
     * @param  Closure(SubscriptionTransaction): bool  $mayCancel
     *
     * @throws ValidationException when it may not be cancelled (any more)
     */
    public static function reverse(SubscriptionTransaction $transaction, User $actor, CorrectionReason $reason, ?string $notes, Closure $mayCancel, bool $freeSourceKey = false): SubscriptionTransaction
    {
        return $transaction->withMutationLock(function () use ($actor, $reason, $notes, $mayCancel, $freeSourceKey, $transaction): SubscriptionTransaction {
            $line = SubscriptionTransaction::query()->lockForUpdate()->findOrFail($transaction->id);

            if (! $mayCancel($line)) {
                throw ValidationException::withMessages(['reason' => __('This transaction was already cancelled or changed.')]);
            }

            $line->update([
                'status' => SubscriptionTransaction::STATUS_CANCELLED,
                'cancelled_at' => now(),
                'cancelled_by' => $actor->id,
                'cancellation_reason' => $reason,
                'cancellation_notes' => $notes,
                'active_reference' => null,
                ...($freeSourceKey ? ['source_key' => $line->source_key.':cancelled:'.$line->id] : []),
            ]);
            $transaction->setRawAttributes($line->getAttributes(), true);

            return $line->subscription->transactions()->create([
                'recorded_by' => $actor->id,
                'reverses_id' => $line->id,
                'type' => SubscriptionTransaction::TYPE_REVERSAL,
                'source_key' => 'reversal:'.$line->id,
                'amount' => Money::negate($line->amount),
                'currency' => $line->currency,
                'currency_amount' => $line->currency_amount,
                'exchange_rate' => $line->exchange_rate,
                'payment_method' => $line->payment_method,
            ]);
        });
    }
}
