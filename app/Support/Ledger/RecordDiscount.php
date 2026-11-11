<?php

namespace App\Support\Ledger;

use App\Enums\DiscountMethod;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Records a one-off discount, worked out from the subscription's balance or kilo price.
 */
class RecordDiscount
{
    /**
     * Take a discount off what the subscription owes, worked out by
     * discountFor() from their current balance and kilo price.
     */
    public static function handle(Subscription $subscription, User $recorder, DiscountMethod $method, float|string $value, ?string $notes): SubscriptionTransaction
    {
        $base = match ($method) {
            DiscountMethod::Percentage => $subscription->balance(),
            DiscountMethod::Kilowatt => $subscription->kilowattPrice(),
            DiscountMethod::Shekel => null,
        };

        return $subscription->transactions()->create([
            'recorded_by' => $recorder->id,
            'type' => SubscriptionTransaction::TYPE_DISCOUNT,
            'source_key' => 'discount:'.Str::ulid(),
            'amount' => Money::negate(LedgerAmounts::discountFor($method, $value, $base)),
            'discount_method' => $method,
            'discount_value' => $value,
            'discount_base' => $base,
            'notes' => $notes,
        ]);
    }
}
