<?php

namespace App\Support\Ledger;

use App\Enums\ChargeType;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;

/**
 * What may be done with a ledger line: corrected, cancelled or amended, and which types of line a user may correct.
 */
class LineRules
{
    /**
     * Whether a line may be corrected or deleted: a payment, discount,
     * clearing or charge recorded by hand that still stands. Weekly
     * readings, their standing discounts and the registration fee are
     * billed by their own flows.
     */
    public static function isCorrectable(SubscriptionTransaction $transaction): bool
    {
        if (LineRules::isRegistrationFee($transaction)) {
            return false;
        }

        return ! $transaction->isCancelled() && in_array($transaction->type, LineRules::correctableTypes(), true);
    }

    /**
     * Whether a line may be deleted (cancelled with a reversal): anything
     * that may be corrected, and also a weekly reading or the registration
     * fee, billed wrongly. Its source key is kept, so the flow that billed
     * it does not bill it again. A weekly reading's discount is never
     * deleted on its own: it goes with its reading.
     */
    public static function isCancellable(SubscriptionTransaction $transaction): bool
    {
        if ($transaction->isCancelled()) {
            return false;
        }

        return LineRules::isCorrectable($transaction) || in_array($transaction->type, [SubscriptionTransaction::TYPE_METER_READING, SubscriptionTransaction::TYPE_SUBSCRIPTION_FEE], true);
    }

    /** A standing payment whose descriptive details may still be amended. */
    public static function isAmendable(SubscriptionTransaction $transaction, bool $lockForUpdate = false): bool
    {
        return $transaction->isPayment()
            && ! $transaction->isCancelled()
            && ! LineHistory::isInClosedDay($transaction, $lockForUpdate);
    }

    /**
     * Whether this is the registration fee created by the subscription flow,
     * rather than a subscription-fee charge entered by hand.
     */
    public static function isRegistrationFee(SubscriptionTransaction $transaction): bool
    {
        return $transaction->type === SubscriptionTransaction::TYPE_SUBSCRIPTION_FEE && ! str_starts_with($transaction->source_key, 'charge:');
    }

    /**
     * The types of line a user may correct or delete.
     *
     * @return array<int, string>
     */
    public static function correctableTypes(): array
    {
        return [SubscriptionTransaction::TYPE_PAYMENT, SubscriptionTransaction::TYPE_DISCOUNT, SubscriptionTransaction::TYPE_CLEARING, ...array_map(fn (ChargeType $type): string => $type->value, ChargeType::cases())];
    }
}
