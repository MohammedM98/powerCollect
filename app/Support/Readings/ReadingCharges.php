<?php

namespace App\Support\Readings;

use App\Enums\DiscountMethod;
use App\Models\MeterReading;
use App\Models\Subscription;
use App\Support\Money;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

/**
 * What a reading charges: its amount, its standing discount, and the source keys its ledger lines are billed by.
 */
class ReadingCharges
{
    /**
     * What a standing discount takes off a week's reading fee, in shekels:
     * a percentage of the fee, kilowatts of the consumption at the kilo
     * price, or shekels off the price of each kilo — never more than the fee.
     */
    public static function discountFor(DiscountMethod $method, float|string $value, float $consumption, float|string $unitPrice): string
    {
        $readingFee = Money::multiply($consumption, $unitPrice);
        $discount = match ($method) {
            DiscountMethod::Percentage => Money::decimal($readingFee)->multipliedBy((string) $value)->dividedBy('100', 2, RoundingMode::HalfUp),
            DiscountMethod::Kilowatt => BigDecimal::min((string) $value, (string) $consumption)->multipliedBy((string) $unitPrice),
            DiscountMethod::Shekel => Money::decimal($consumption)->multipliedBy(BigDecimal::min((string) $value, (string) $unitPrice)),
        };

        return Money::amount(BigDecimal::min(Money::amount($discount), $readingFee));
    }

    /**
     * What a week's consumption costs: consumption × kilowatt price, but
     * never less than the minimum payment. A subscription with a standing
     * discount pays the fee less the discount instead, with no minimum:
     * only the kilos the discount leaves are paid for. `discount_amount`
     * is what the discount took off the week's bill.
     *
     * @return array{reading_fee: string, discount_amount: string, amount_due: string}
     */
    public static function chargesFor(
        float $consumption,
        float|string $unitPrice,
        float|string $minimumPayment,
        ?DiscountMethod $discountMethod = null,
        float|string|null $discountValue = null,
    ): array {
        $readingFee = Money::multiply($consumption, $unitPrice);
        $hasDiscount = $discountMethod !== null && $discountValue !== null;
        $discount = $hasDiscount ? ReadingCharges::discountFor($discountMethod, $discountValue, $consumption, $unitPrice) : '0.00';
        $amountDue = $hasDiscount ? Money::subtract($readingFee, $discount) : Money::amount(BigDecimal::max($readingFee, (string) $minimumPayment));

        return [
            'reading_fee' => Money::amount($readingFee),
            'discount_amount' => Money::amount($discount),
            'amount_due' => Money::amount($amountDue),
        ];
    }

    /**
     * The key of the transaction that charges this reading once approved.
     */
    public static function chargeSourceKey(MeterReading $reading): string
    {
        return 'meter-reading:'.$reading->id;
    }

    /**
     * The key of the transaction that takes this reading's standing
     * discount off once it is approved.
     */
    public static function discountSourceKey(MeterReading $reading): string
    {
        return 'meter-reading-discount:'.$reading->id;
    }

    /**
     * The week's bill before its standing discount: the reading fee, or
     * the minimum payment when that is more.
     */
    public static function amountBeforeDiscount(MeterReading $reading): string
    {
        return Money::add($reading->amount_due, $reading->discount_amount);
    }
}
