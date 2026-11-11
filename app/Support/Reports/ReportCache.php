<?php

namespace App\Support\Reports;

use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Caches report figures under a version that changes whenever the data
 * behind them may have changed, so a cached figure is never stale:
 *
 * - `history`: the ledger before today. It moves only when a line is
 *   changed in place or recorded with an earlier date, never when today's
 *   payments come in, so the opening balance of a past period stays cached.
 * - `activity`: anything the dashboard shows (lines, readings, boxes,
 *   subscriptions). Its figures are also kept for a minute at most.
 */
class ReportCache
{
    public const HISTORY = 'history';

    public const ACTIVITY = 'activity';

    /**
     * The cached value for `key` at the current version of `scope`,
     * computed and kept for `seconds` (for good when null) when missing.
     *
     * @template TValue
     *
     * @param  Closure(): TValue  $compute
     * @return TValue
     */
    public static function remember(string $scope, string $key, ?int $seconds, Closure $compute): mixed
    {
        $cacheKey = "report:{$scope}:".self::version($scope).':'.$key;

        return $seconds === null
            ? Cache::rememberForever($cacheKey, $compute)
            : Cache::remember($cacheKey, $seconds, $compute);
    }

    /** Mark everything cached under `scope` as out of date. */
    public static function touch(string $scope): void
    {
        Cache::forever("report-version:{$scope}", (string) Str::ulid());
    }

    private static function version(string $scope): string
    {
        return (string) Cache::get("report-version:{$scope}", '0');
    }
}
