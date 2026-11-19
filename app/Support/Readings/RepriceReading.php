<?php

namespace App\Support\Readings;

use App\Enums\CorrectionReason;
use App\Enums\MeterReadingStatus;
use App\Models\MeterReading;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Ledger\CancelLine;
use Illuminate\Support\Facades\DB;

/**
 * Recalculates readings after an earlier one changes, so each week's consumption and charge follow from the one before.
 */
class RepriceReading
{
    /**
     * Start the reading from the corrected reading of the week before it —
     * its last reading, edited after this week was entered — at
     * `$currentReading` when this week's reading was entered again with the
     * edit, and recalculate it as correct() does: an approved one goes back
     * to review. Returns whether that happened; a reading already starting
     * there, at the same reading, is left as it is.
     */
    public static function startFrom(MeterReading $reading, float $previousReading, User $editor, ?float $currentReading = null): bool
    {
        $currentReading ??= $reading->current_reading;

        if (round($previousReading, 2) === round($reading->previous_reading, 2) && round($currentReading, 2) === round($reading->current_reading, 2)) {
            return false;
        }

        return RepriceReading::recalculate($reading, $previousReading, $currentReading, $reading->notes, $editor);
    }

    /**
     * What the reading would come to between the given readings, at the
     * prices and standing discount captured when it was recorded, without
     * changing it: its consumption, its amount due and whether it would be
     * flagged as unusual. `$consumptionOverrides` is as usualConsumptionOf().
     *
     * @param  array<int, float>  $consumptionOverrides
     * @return array{consumption: float, amount_due: string, unusual: bool}
     */
    public static function recalculatedBetween(MeterReading $reading, float $previousReading, float $currentReading, array $consumptionOverrides = []): array
    {
        $consumption = ReadingConsumption::consumptionBetween($previousReading, $currentReading);

        return [
            'consumption' => $consumption,
            'amount_due' => ReadingCharges::chargesFor($consumption, $reading->unit_price, $reading->minimum_payment, $reading->discount_method, $reading->discount_value)['amount_due'],
            'unusual' => ReadingConsumption::usualConsumptionIfUnusual($reading->subscription, $consumption, $reading->week_start, $consumptionOverrides) !== null,
        ];
    }

    /**
     * Recalculate the reading between the given readings at the prices and
     * standing discount captured when it was recorded, sending an approved
     * one back to review (see correct()).
     */
    public static function recalculate(MeterReading $reading, float $previousReading, float $currentReading, ?string $notes, User $editor): bool
    {
        return DB::transaction(function () use ($previousReading, $currentReading, $notes, $editor, $reading): bool {
            // Read the status under the same row lock approval takes, so an approval that just ran is seen and its lines cancelled.
            $reading->setRawAttributes(MeterReading::query()->lockForUpdate()->findOrFail($reading->id)->getAttributes(), true);
            $wasApproved = ! $reading->isPending();
            $consumption = ReadingConsumption::consumptionBetween($previousReading, $currentReading);

            if ($wasApproved) {
                foreach ([SubscriptionTransaction::TYPE_METER_READING, SubscriptionTransaction::TYPE_READING_DISCOUNT] as $type) {
                    $currentLine = ApproveReading::currentLine($reading, $type);
                    if ($currentLine !== null) {
                        CancelLine::cancelForReading($currentLine, $editor, CorrectionReason::ReadingCorrected);
                    }
                }
            }

            $reading->update([
                'previous_reading' => $previousReading,
                'current_reading' => $currentReading,
                'requires_reentry' => false,
                'consumption' => $consumption,
                'usual_consumption' => ReadingConsumption::usualConsumptionIfUnusual($reading->subscription, $consumption, $reading->week_start),
                ...ReadingCharges::chargesFor($consumption, $reading->unit_price, $reading->minimum_payment, $reading->discount_method, $reading->discount_value),
                'notes' => $notes,
                ...($wasApproved ? ['status' => MeterReadingStatus::Pending, 'approved_by' => null, 'approved_at' => null] : []),
            ]);

            return $wasApproved;
        });
    }
}
