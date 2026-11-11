<?php

namespace App\Support\Readings;

use App\Models\ReadingCycle;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Helpers for the reading cycle pages.
 */
class ReadingCyclePage
{
    /**
     * How many of each box's subscriptions have the cycle week's reading.
     *
     * @param  Collection<int, int>  $boxIds
     * @return array<int, int>
     */
    public static function readCounts(ReadingCycle $cycle, Collection $boxIds): array
    {
        return DB::table('meter_readings')
            ->join('subscriptions', 'subscriptions.id', '=', 'meter_readings.subscription_id')
            ->whereIn('subscriptions.meter_box_id', $boxIds)
            ->whereDate('meter_readings.week_start', $cycle->week_start->toDateString())
            ->groupBy('subscriptions.meter_box_id')
            ->pluck(DB::raw('count(*)'), 'subscriptions.meter_box_id')
            ->map(fn ($count) => (int) $count)
            ->all();
    }
}
