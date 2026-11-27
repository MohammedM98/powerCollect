<?php

namespace App\Support\Ledger;

use App\Enums\DiscountMethod;
use App\Models\Subscription;
use Brick\Math\RoundingMode;
use Illuminate\Support\Str;

/**
 * How a discount is worked out and how an amount is shown.
 */
class LedgerAmounts
{
    /**
     * What a discount takes off, in shekels: a percentage of the balance
     * owed, kilowatts at the kilo price, or the shekels given.
     */
    public static function discountFor(DiscountMethod $method, float|string $value, float|string|null $base): string
    {
        return Money::amount(match ($method) {
            DiscountMethod::Percentage => Money::decimal($base)->multipliedBy((string) $value)->dividedBy('100', 2, RoundingMode::HalfUp),
            DiscountMethod::Kilowatt => Money::decimal($value)->multipliedBy((string) $base),
            DiscountMethod::Shekel => Money::decimal($value),
        });
    }

    /**
     * What a one-off discount is worked out from: the balance owed for a
     * percentage, the subscription's kilo price for kilowatts, and nothing
     * for shekels. Shared by checking a discount and recording it, so the
     * two cannot drift apart.
     */
    public static function discountBase(DiscountMethod $method, float|int|string $owed, Subscription $subscription): float|int|string|null
    {
        return match ($method) {
            DiscountMethod::Percentage => $owed,
            DiscountMethod::Kilowatt => $subscription->kilowattPrice(),
            DiscountMethod::Shekel => null,
        };
    }

    /**
     * An amount as the app shows it: no decimals when whole (50), two
     * otherwise (617.50).
     */
    public static function formatAmount(float|string $amount): string
    {
        return Str::replaceEnd('.00', '', Money::amount($amount));
    }
}
