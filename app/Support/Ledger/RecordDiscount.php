<?php

namespace App\Support\Ledger;

use App\Enums\DiscountMethod;
use App\Http\Requests\StoreSubscriptionDiscountRequest;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Closing\BranchLock;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator as ValidationValidator;

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
        // Under the branch lock, and checked again there, so two discounts at once cannot take the balance below zero.
        return BranchLock::run($subscription->branch_id, function () use ($subscription, $recorder, $method, $value, $notes): SubscriptionTransaction {
            $balance = $subscription->balance();
            Validator::make([], [])->after(fn (ValidationValidator $validator) => StoreSubscriptionDiscountRequest::checkAgainstBalance($validator, $subscription, $balance, $method->value, $value))->validate();
            $base = LedgerAmounts::discountBase($method, $balance, $subscription);

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
        });
    }
}
