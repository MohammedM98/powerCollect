<?php

namespace App\Support\Readings;

use App\Models\MeterReading;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Changes a reading's kilo price or minimum payment after it was entered:
 * the week is charged again and the change kept with the reading. Each
 * field needs its own permission.
 */
class UpdateReadingPricing
{
    /**
     * Whether the change reopened an approved reading, so its approvers
     * must approve it again.
     *
     * @param  array{unit_price?: numeric-string|float, minimum_payment?: numeric-string|float}  $pricing
     */
    public static function handle(MeterReading $meterReading, User $actor, array $pricing): bool
    {
        return DB::transaction(function () use ($meterReading, $actor, $pricing): bool {
            $meterReading->subscription()->lockForUpdate()->firstOrFail();
            $reading = MeterReading::query()->lockForUpdate()->findOrFail($meterReading->id);
            foreach (['unit_price' => 'updateUnitPrice', 'minimum_payment' => 'updateMinimumPayment'] as $field => $ability) {
                if (array_key_exists($field, $pricing)) {
                    Gate::forUser($actor)->authorize($ability, $reading);
                }
            }
            $before = $reading->only(['unit_price', 'minimum_payment']);
            $reading->fill($pricing);
            if (! $reading->isDirty(['unit_price', 'minimum_payment'])) {
                return false;
            }
            $reopened = AdjustLastReading::correct($reading, $reading->current_reading, $reading->notes, $actor);
            AdjustLastReading::recordAdjustment($reading, 'pricing', $before, $reading->only(['unit_price', 'minimum_payment']), $actor);

            return $reopened;
        });
    }
}
