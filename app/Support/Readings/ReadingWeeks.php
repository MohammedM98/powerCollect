<?php

namespace App\Support\Readings;

use App\Models\Branch;
use App\Models\ReadingEntrySetting;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * The reading weeks: the week a date falls in, ending on the branch's reading day, and the recent weeks offered for entry.
 */
class ReadingWeeks
{
    /**
     * The first day of the reading week containing the given date. Weeks end
     * on the branch's reading day (Thursday unless changed in its reading
     * schedule settings; the company's reading day for a branch without a
     * schedule of its own, or when no branch is given) and start the day
     * after the previous one.
     */
    public static function weekStartFor(CarbonInterface $date, Branch|int|null $branch): Carbon
    {
        return ReadingEntrySetting::forBranch($branch)->weekStartFor($date);
    }

    /**
     * The reading day that ends the reading week containing the given date.
     */
    public static function weekEndFor(CarbonInterface $date, Branch|int|null $branch): Carbon
    {
        return ReadingEntrySetting::forBranch($branch)->weekEndFor($date);
    }

    /**
     * The start of the latest week that has ended, counting today as its
     * last day if today is the reading day. "Today" is the business's local
     * date.
     */
    public static function latestEndedWeekStart(Branch|int|null $branch, ?CarbonInterface $at = null): Carbon
    {
        return ReadingEntrySetting::forBranch($branch)->latestEndedWeekStart($at);
    }

    /**
     * The latest ended week and the ones before it, newest first, as
     * select options (`value` the week's first day, `end` its last). Weeks
     * read on an earlier reading day keep their dates.
     *
     * @return array<int, array{value: string, label: string, end: string}>
     */
    public static function recentWeekOptions(Branch|int|null $branch, int $count = 8): array
    {
        $weekStart = ReadingWeeks::latestEndedWeekStart($branch);
        $options = [];

        while (count($options) < $count) {
            $weekEnd = ReadingWeeks::weekEndFor($weekStart, $branch);
            $options[] = [
                'value' => $weekStart->toDateString(),
                'label' => __('Week ending ').$weekEnd->locale('ar')->dayName.' '.$weekEnd->format('d/m/Y'),
                'end' => $weekEnd->toDateString(),
            ];
            $weekStart = ReadingWeeks::weekStartFor($weekStart->copy()->subDay(), $branch);
        }

        return $options;
    }

    /**
     * The recent weeks of each branch the user may enter readings for, by
     * branch id (every branch for the Super Admin, whose list is in the
     * branches' name order), since each branch reads on its own weeks.
     *
     * @return array<int, array<int, array{value: string, label: string, end: string}>>
     */
    public static function recentWeekOptionsFor(User $user, int $count = 8): array
    {
        $branchIds = $user->isSuperAdmin() ? Branch::query()->orderBy('name')->pluck('id') : collect([$user->workBranchId()]);

        return $branchIds->mapWithKeys(fn (?int $branchId): array => [$branchId => ReadingWeeks::recentWeekOptions($branchId, $count)])->all();
    }
}
