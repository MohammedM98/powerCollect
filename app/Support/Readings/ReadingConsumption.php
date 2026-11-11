<?php

namespace App\Support\Readings;

use App\Models\MeterReading;
use App\Models\Subscription;
use Carbon\CarbonInterface;

/**
 * Consumption between two readings, and whether a week's consumption is impossible or unusual against the subscription's usual use.
 */
class ReadingConsumption
{
    /**
     * The kWh used between two meter readings, rounded to the two decimal
     * places readings are kept to.
     */
    public static function consumptionBetween(float $previousReading, float $currentReading): float
    {
        return round($currentReading - $previousReading, 2);
    }

    /**
     * Whether a week's consumption is more than any subscription could use:
     * it is refused when entered, as a mistyped reading.
     */
    public static function isImpossibleConsumption(float $consumption): bool
    {
        return $consumption > (float) config('powercollect.readings.max_weekly_kwh');
    }

    /**
     * What the subscription usually uses in a week: the average of its last
     * readings before the given week, or null while it has too few to say.
     * `$consumptionOverrides` ([reading id => kWh]) counts readings at the
     * consumption they would have after a correction not saved yet.
     *
     * @param  array<int, float>  $consumptionOverrides
     */
    public static function usualConsumptionOf(Subscription $subscription, CarbonInterface $weekStart, array $consumptionOverrides = []): ?float
    {
        $consumptions = MeterReading::query()
            ->where('subscription_id', $subscription->id)
            ->whereDate('week_start', '<', $weekStart->toDateString())
            ->orderByDesc('week_start')
            ->limit((int) config('powercollect.readings.usual_readings'))
            ->pluck('consumption', 'id')
            ->map(fn (mixed $consumption, int $id): float => $consumptionOverrides[$id] ?? (float) $consumption);

        return $consumptions->count() < (int) config('powercollect.readings.usual_minimum_readings')
            ? null
            : round((float) $consumptions->avg(), 2);
    }

    /**
     * The usual consumption to keep with a reading when this week's is far
     * above it — a multiple of it, and big enough to matter — so the reading
     * is flagged for review; null when it is nothing unusual. A subscription
     * with no usual yet has none to compare with (kept as 0), so only a
     * very large week is flagged.
     *
     * @param  array<int, float>  $consumptionOverrides  see usualConsumptionOf()
     */
    public static function usualConsumptionIfUnusual(Subscription $subscription, float $consumption, CarbonInterface $weekStart, array $consumptionOverrides = []): ?float
    {
        $usual = ReadingConsumption::usualConsumptionOf($subscription, $weekStart, $consumptionOverrides);

        if ($usual === null) {
            return $consumption >= (float) config('powercollect.readings.unusual_without_history_kwh') ? 0.0 : null;
        }

        if ($consumption < (float) config('powercollect.readings.unusual_minimum_kwh')) {
            return null;
        }

        return $consumption > $usual * (float) config('powercollect.readings.unusual_multiplier') ? $usual : null;
    }

    /**
     * Whether the reading was flagged when it was entered: far above what
     * the subscription usually uses, so it needs a second look.
     */
    public static function isUnusual(MeterReading $reading): bool
    {
        return $reading->usual_consumption !== null;
    }
}
