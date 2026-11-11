<?php

namespace App\Support\Ledger;

use App\Models\SubscriptionTransaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

/**
 * The legacy deletion: whether the final line may be taken off, and doing it with a linked cancellation or refund.
 */
class EraseLine
{
    /**
     * Whether erasing this payment for good can take every part of its
     * split transfer with it, as erasing one part does.
     */
    public static function splitPartsAreErasable(SubscriptionTransaction $transaction, bool $lockForUpdate): bool
    {
        $parts = SubscriptionTransaction::query()->acrossBranches()
            ->where('split_payment_id', $transaction->split_payment_id)->where('type', SubscriptionTransaction::TYPE_PAYMENT)->orderBy('id')
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())->get();

        return $parts->every(fn (SubscriptionTransaction $part): bool => TransactionActions::isDeletableSplitPart($part, $parts, legacy: true, lockForUpdate: $lockForUpdate));
    }

    /**
     * Whether the legacy deletion endpoint may cancel the final original line.
     * Reversals and cancelled originals always remain in financial history.
     */
    public static function isErasable(SubscriptionTransaction $transaction, bool $lockForUpdate = false, bool $withSplitParts = true): bool
    {
        if ($transaction->isReversal() || $transaction->isCancelled() || $transaction->type === SubscriptionTransaction::TYPE_BANK_AUDIT_ADJUSTMENT || $transaction->type === SubscriptionTransaction::TYPE_READING_DISCOUNT) {
            return false;
        }

        if ($withSplitParts && $transaction->isPayment() && $transaction->split_payment_id !== null) {
            return EraseLine::splitPartsAreErasable($transaction, $lockForUpdate);
        }

        $lastOriginalId = SubscriptionTransaction::query()
            ->where('subscription_id', $transaction->subscription_id)
            ->whereNull('reverses_id')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
            ->value('id');

        return LineRules::isCancellable($transaction)
            && (LineHistory::isLastOnStatement($transaction, $lockForUpdate) || $transaction->isPayment() && $lastOriginalId === $transaction->id)
            && ! LineHistory::isPermanentDeletionLocked($transaction, $lockForUpdate);
    }

    /**
     * Preserve the original line and record a linked cancellation or refund.
     * A split transfer is cancelled atomically across all eligible parts.
     *
     * @throws ValidationException when cancellation is unavailable
     */
    public static function erase(SubscriptionTransaction $transaction, User $actor, string $reason): void
    {
        $split = TransactionActions::mutationSplitPayment($transaction);
        if ($split === null) {
            EraseLine::eraseSingle($transaction, $actor, $reason);

            return;
        }

        $split->withPaymentsLocked($actor, function (Collection $parts) use ($actor, $reason, $transaction): void {
            TransactionActions::deleteSplitParts($transaction, $actor, $parts, ['correction_notes' => $reason], legacy: true);
        });
    }

    public static function eraseSingle(SubscriptionTransaction $transaction, User $actor, string $reason): void
    {
        $transaction->withMutationLock(function () use ($actor, $reason, $transaction): void {
            $line = SubscriptionTransaction::query()->lockForUpdate()->findOrFail($transaction->id);
            if (! EraseLine::isErasable($line, lockForUpdate: true, withSplitParts: false)) {
                throw ValidationException::withMessages(['reason' => __('This transaction cannot be cancelled.')]);
            }

            TransactionActions::applyHardDelete($line, $actor, ['correction_notes' => $reason]);
            $transaction->setRawAttributes($line->getAttributes(), true);
        });
    }
}
