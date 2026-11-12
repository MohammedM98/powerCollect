<?php

namespace App\Support\Readings;

use App\Enums\MeterReadingStatus;
use App\Models\MeterReading;
use App\Models\Subscription;
use App\Models\Tariff;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Records or replaces a subscription's reading for a week, with its consumption and price.
 */
class RecordReading
{
    /**
     * Record the subscription's reading for the week, pending approval: from
     * the reading the week starts from, at their kilo price, minimum payment
     * and standing discount as they are now, so a later change never alters
     * it. It does not touch the subscription's balance until approved.
     * The subscription should come with its tariff, circuit breaker and
     * standing discount.
     */
    public static function handle(Subscription $subscription, CarbonInterface $weekStart, float $currentReading, User $recorder, ?string $notes, ?string $mobileOperationId = null): MeterReading
    {
        $weekStart = Carbon::instance($weekStart);
        if ($subscription->meterReadings()->where('week_start', '<', $weekStart)->where('requires_reentry', true)->exists()) {
            throw ValidationException::withMessages(['current_reading' => __('Enter the pending current reading before recording a new week.')]);
        }
        $previousReading = $subscription->previousReadingBefore($weekStart);
        $consumption = ReadingConsumption::consumptionBetween($previousReading, $currentReading);
        $discount = $subscription->standingDiscount;
        $unitPrice = $subscription->kilowattPrice();
        $minimumPayment = $subscription->weeklyMinimumPayment();

        return MeterReading::create([
            'subscription_id' => $subscription->id,
            'branch_id' => $subscription->branch_id,
            'week_start' => $weekStart,
            'week_end' => ReadingWeeks::weekEndFor($weekStart, $subscription->branch_id),
            'previous_reading' => $previousReading,
            'current_reading' => $currentReading,
            'consumption' => $consumption,
            'usual_consumption' => ReadingConsumption::usualConsumptionIfUnusual($subscription, $consumption, $weekStart),
            'unit_price' => $unitPrice,
            'minimum_payment' => $minimumPayment,
            'discount_method' => $discount?->method,
            'discount_value' => $discount?->value,
            'discount_segment' => $discount?->segment,
            ...ReadingCharges::chargesFor($consumption, $unitPrice, $minimumPayment, $discount?->method, $discount?->value),
            'status' => MeterReadingStatus::Pending,
            'recorded_by' => $recorder->id,
            'notes' => $notes,
            'mobile_operation_id' => $mobileOperationId,
        ]);
    }
}
