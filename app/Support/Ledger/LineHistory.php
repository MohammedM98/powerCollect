<?php

namespace App\Support\Ledger;

use App\Enums\ClosingStatus;
use App\Models\CashBox;
use App\Models\Closing;
use App\Models\ClosingPayment;
use App\Models\MeterReading;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use Closure;
use Illuminate\Database\Eloquent\Builder;

/**
 * Where a line stands in its subscription's history: last on the statement, paid against, fully reversed, locked by a closed day.
 */
class LineHistory
{
    /**
     * The standing discount (خصم القراءات الأسبوعية) billed beside this weekly reading's
     * charge, while it still stands; null for any other line. The two are
     * one bill: cancelling or deleting the charge takes it too, or the
     * subscription would keep a discount on a bill that no longer exists.
     */
    public static function readingDiscountStanding(SubscriptionTransaction $transaction, bool $lockForUpdate = true): ?SubscriptionTransaction
    {
        if ($transaction->type !== SubscriptionTransaction::TYPE_METER_READING || $transaction->meter_reading_id === null) {
            return null;
        }

        return SubscriptionTransaction::query()
            ->where('meter_reading_id', $transaction->meter_reading_id)
            ->where('type', SubscriptionTransaction::TYPE_READING_DISCOUNT)
            ->whereNull('cancelled_at')
            ->where('status', SubscriptionTransaction::STATUS_ACTIVE)
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
            ->first();
    }

    public static function isLastTransaction(SubscriptionTransaction $transaction, bool $lockForUpdate = false): bool
    {
        [$lastId, $previousId] = SubscriptionTransaction::query()
            ->where('subscription_id', $transaction->subscription_id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
            ->limit(2)
            ->pluck('id')
            ->pad(2, null)
            ->all();

        return $lastId === $transaction->id
            || ($previousId === $transaction->id && LineHistory::readingDiscountStanding($transaction, $lockForUpdate)?->id === $lastId);
    }

    public static function hasAppliedPayment(SubscriptionTransaction $transaction, bool $lockForUpdate = false): bool
    {
        return SubscriptionTransaction::query()
            ->where('reference_transaction_id', $transaction->id)
            ->whereIn('type', SubscriptionTransaction::PAYMENT_LIKE_TYPES)
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
            ->exists();
    }

    public static function isFullyReversed(SubscriptionTransaction $transaction, bool $lockForUpdate = false): bool
    {
        $hasCorrection = ! $lockForUpdate && $transaction->relationLoaded('correction')
            ? $transaction->correction !== null
            : SubscriptionTransaction::query()
                ->where('corrects_id', $transaction->id)
                ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
                ->exists();

        if ($hasCorrection) {
            return false;
        }

        $reversals = ! $lockForUpdate && $transaction->relationLoaded('linkedReversals')
            ? $transaction->linkedReversals->whereIn('type', SubscriptionTransaction::REVERSAL_TYPES)
            : SubscriptionTransaction::query()
                ->where('subscription_id', $transaction->subscription_id)
                ->where(fn (Builder $query): Builder => $query
                    ->where('reference_transaction_id', $transaction->id)
                    ->orWhere('reverses_id', $transaction->id))
                ->whereIn('type', SubscriptionTransaction::REVERSAL_TYPES)
                ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
                ->get();

        return $reversals->isNotEmpty()
            && Closing::cents($transaction->amount) + $reversals->sum(fn (SubscriptionTransaction $reversal): int => Closing::cents($reversal->amount)) === 0;
    }

    /**
     * Whether this is a weekly reading's bill for another amount than its
     * reading now costs: the reading was corrected after it was billed, so
     * the bill may not stand again.
     */
    public static function isStaleReadingBill(SubscriptionTransaction $transaction): bool
    {
        $reading = $transaction->type === SubscriptionTransaction::TYPE_METER_READING && $transaction->isBilledByReading()
            ? MeterReading::query()->find($transaction->meter_reading_id)
            : null;

        // A reading awaiting its current reading again is refused on its own, by reinstate().
        return $reading !== null && ! $reading->requires_reentry && Closing::cents($transaction->amount) !== Closing::cents($reading->amountBeforeDiscount());
    }

    /**
     * Whether a reading billed this line again in place of an earlier bill
     * of it. It can be cancelled, but never deleted or erased: that would
     * bring back the bill it replaced, which no longer matches the reading.
     */
    public static function replacesReadingBill(SubscriptionTransaction $transaction): bool
    {
        return $transaction->isBilledByReading() && $transaction->corrects_id !== null;
    }

    public static function isPermanentDeletionLocked(SubscriptionTransaction $transaction, bool $lockForUpdate = false): bool
    {
        return SubscriptionTransaction::query()
            ->whereKey(array_filter([$transaction->id, $transaction->reference_transaction_id, $transaction->reverses_id, $transaction->corrects_id]))
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
            ->get()
            ->contains(fn (SubscriptionTransaction $line): bool => LineHistory::isInClosedDay($line, $lockForUpdate));
    }

    /**
     * Whether the line is the last one on the subscription's statement, the
     * one at the bottom of the table (the statement lists oldest first).
     */
    public static function isLastOnStatement(SubscriptionTransaction $transaction, bool $lockForUpdate = false): bool
    {
        $lastGroupId = SubscriptionTransaction::query()
            ->where('subscription_id', $transaction->subscription_id)
            ->whereNull('reverses_id')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
            ->value('id');

        if ($lastGroupId === null) {
            return false;
        }

        return SubscriptionTransaction::query()
            ->where('subscription_id', $transaction->subscription_id)
            ->where(fn (Builder $query): Builder => $query
                ->whereKey($lastGroupId)
                ->orWhere('reverses_id', $lastGroupId))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
            ->value('id') === $transaction->id;
    }

    /**
     * Membership itself locks the transaction, independently of current settings
     * or cached relations. Legacy pending boxes remain editable until closure.
     */
    public static function isInClosedDay(SubscriptionTransaction $transaction, bool $lockForUpdate = false): bool
    {
        if (CashBox::query()
            ->whereHas('payments', fn (Builder $query): Builder => $query->where('subscription_transaction_id', $transaction->id))
            ->whereNotIn('status', ['open', 'pending'])
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
            ->exists()) {
            return true;
        }

        return ClosingPayment::query()
            ->where('subscription_transaction_id', $transaction->id)
            ->whereHas('closing', fn (Builder $query): Builder => $query->whereIn('status', [
                ClosingStatus::Submitted->value,
                ClosingStatus::Approved->value,
            ]))
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
            ->exists();
    }
}
