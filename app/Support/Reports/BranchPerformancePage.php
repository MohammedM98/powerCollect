<?php

namespace App\Support\Reports;

use App\Enums\SubscriptionStatus;
use App\Http\Controllers\BranchPerformanceController;
use App\Models\Branch;
use App\Models\MeterReading;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Ledger\Money;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Builds the branch performance pages: each branch's collections, readings and boxes over the chosen period.
 */
class BranchPerformancePage
{
    public const WORK_LOG_DAYS = 14;

    /**
     * Adds each branch's subscription and staff counts, what it charged its
     * subscriptions, and when its last subscription and reading were entered.
     *
     * @param  Builder<Branch>  $query
     * @return Builder<Branch>
     */
    public static function withFigures(Builder $query): Builder
    {
        return $query
            ->withCount([
                'subscriptions',
                'subscriptions as active_subscriptions_count' => fn (Builder $subscriptions) => $subscriptions->where('status', SubscriptionStatus::Active),
                'users as staff_count' => fn (Builder $users) => $users->where('is_active', true),
            ])
            ->withSum(['transactions as charges_total' => fn (Builder $lines) => $lines->charges()], 'amount')
            ->withSum(['transactions as collected_total' => fn (Builder $lines) => $lines->counted()->where('type', SubscriptionTransaction::TYPE_PAYMENT)], 'amount')
            ->withMax('subscriptions as last_registration_at', 'created_at')
            ->withMax('meterReadings as last_reading_at', 'created_at');
    }

    /**
     * What each branch's subscribers owe now, and how much of it is older
     * than 90 days, by the same aging as the debts report.
     *
     * @param  array<int, int>  $branchIds
     * @return array<int, array{owed: string, older: string, debtors: int}>
     */
    public static function debtsByBranch(array $branchIds): array
    {
        $debtors = (new DebtAging(DailySeries::today()))->debtors(Subscription::query()->whereIn('subscriptions.branch_id', $branchIds));

        return collect($branchIds)->mapWithKeys(function (int $branchId) use ($debtors): array {
            $own = $debtors->filter(fn (array $debtor): bool => $debtor['subscription']->branch_id === $branchId);

            return [$branchId => [
                'owed' => number_format($own->sum('balance') / 100, 2, '.', ''),
                'older' => number_format($own->sum(fn (array $debtor): int => $debtor['buckets']['older']) / 100, 2, '.', ''),
                'debtors' => $own->count(),
            ]];
        })->all();
    }

    /**
     * @param  array<string, int>  $entries  entries per business day
     * @return array<string, mixed>
     */
    public static function branchSummary(Branch $branch, array $entries): array
    {
        $sparkline = array_map(fn (string $day): int => $entries[$day] ?? 0, DailySeries::lastDays(BranchPerformanceController::SPARKLINE_DAYS));
        $lastEntryAt = collect([$branch->last_registration_at, $branch->last_reading_at])->filter()->max();

        return [
            'id' => $branch->id,
            'name' => $branch->name,
            'isActive' => $branch->is_active,
            'governorateName' => $branch->governorate?->name,
            'areaName' => $branch->area?->name,
            'chargesTotal' => Money::amount($branch->charges_total),
            'collectedTotal' => Money::negate($branch->collected_total ?? '0'),
            'collectionRate' => (float) $branch->charges_total > 0 ? (int) round(-(float) ($branch->collected_total ?? 0) / (float) $branch->charges_total * 100) : null,
            'subscriptions' => $branch->subscriptions_count,
            'activeSubscriptions' => $branch->active_subscriptions_count,
            'staff' => $branch->staff_count,
            'todayEntries' => $entries[DailySeries::today()->toDateString()] ?? 0,
            'weekEntries' => array_sum(array_slice($sparkline, -7)),
            'sparkline' => $sparkline,
            'lastEntryAt' => $lastEntryAt ? CarbonImmutable::parse($lastEntryAt, 'UTC')->toIso8601String() : null,
        ];
    }

    /**
     * How many entries — subscriptions registered and readings entered — each
     * branch made on each of the last `$days` business days.
     *
     * @param  array<int, int>  $branchIds
     * @return array<int, array<string, int>> branch id => [Y-m-d => entries]
     */
    public static function entriesPerDay(array $branchIds, int $days): array
    {
        return self::entries($branchIds, DailySeries::startOfDay($days - 1))
            ->groupBy('branch_id')
            ->map(fn (Collection $entries): array => $entries->countBy(fn (object $entry): string => DailySeries::localDate($entry->created_at))->all())
            ->all();
    }

    /**
     * The branch's staff, busiest first: how many entries each made here
     * (all time and in the last 7 days), the account lines they recorded
     * here — how many, and their total on each side (عليه and له) — and
     * when they last did any of it.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function team(Branch $branch): array
    {
        $members = $branch->users()->with('userType')->orderBy('name')->get();
        $weekStart = DailySeries::startOfDay(6);
        $perMember = fn (Builder $query, string $member): Collection => $query
            ->whereIn($member, $members->modelKeys())
            ->toBase()
            ->selectRaw("{$member} as user_id, count(*) as entries, sum(case when created_at >= ? then 1 else 0 end) as week_entries, max(created_at) as last_at", [$weekStart])
            ->groupBy($member)
            ->get()
            ->keyBy('user_id');

        $registrations = $perMember(Subscription::query()->where('branch_id', $branch->id), 'registered_by');
        $readings = $perMember(MeterReading::query()->where('branch_id', $branch->id), 'recorded_by');
        $credit = implode(', ', array_fill(0, count(SubscriptionTransaction::CREDIT_TYPES), '?'));
        $recorded = SubscriptionTransaction::query()
            ->counted()
            ->whereIn('recorded_by', $members->modelKeys())
            ->whereHas('subscription', fn (Builder $query) => $query->where('branch_id', $branch->id))
            ->toBase()
            ->selectRaw(
                "recorded_by as user_id, count(*) as entries, max(created_at) as last_at,
                    sum(case when type in ({$credit}) or (type = ? and amount < 0) then 0 else abs(amount) end) as charged,
                    sum(case when type in ({$credit}) or (type = ? and amount < 0) then abs(amount) else 0 end) as credited",
                [...SubscriptionTransaction::CREDIT_TYPES, SubscriptionTransaction::TYPE_BANK_AUDIT_ADJUSTMENT, ...SubscriptionTransaction::CREDIT_TYPES, SubscriptionTransaction::TYPE_BANK_AUDIT_ADJUSTMENT],
            )
            ->groupBy('recorded_by')
            ->get()
            ->keyBy('user_id');

        return $members
            ->map(function (User $member) use ($registrations, $readings, $recorded): array {
                $registered = $registrations[$member->id] ?? null;
                $read = $readings[$member->id] ?? null;
                $lines = $recorded[$member->id] ?? null;
                $lastActivityAt = collect([$registered?->last_at, $read?->last_at, $lines?->last_at])->filter()->max();

                return [
                    'id' => $member->id,
                    'name' => $member->name,
                    'username' => $member->username,
                    'roleLabel' => $member->isSuperAdmin() ? __($member->role->label()) : ($member->userType?->name ?? __('Employee')),
                    'isActive' => $member->is_active,
                    'entries' => (int) ($registered?->entries ?? 0) + (int) ($read?->entries ?? 0),
                    'weekEntries' => (int) ($registered?->week_entries ?? 0) + (int) ($read?->week_entries ?? 0),
                    'recordedCount' => (int) ($lines?->entries ?? 0),
                    'recordedCharged' => Money::amount($lines?->charged ?? '0'),
                    'recordedCredited' => Money::amount($lines?->credited ?? '0'),
                    'lastActivityAt' => $lastActivityAt ? CarbonImmutable::parse($lastActivityAt, 'UTC')->toIso8601String() : null,
                ];
            })
            ->sortByDesc('entries')
            ->values()
            ->all();
    }

    /**
     * The last two weeks, newest first: the day's new subscriptions and
     * entries, what was charged, and who made the most entries.
     *
     * @param  Builder<SubscriptionTransaction>  $charges
     * @return array<int, array{date: string, newSubscriptions: int, entries: int, chargesCount: int, chargesTotal: float, topEntrant: string|null}>
     */
    public static function workLog(Branch $branch, Builder $charges): array
    {
        $since = DailySeries::startOfDay(self::WORK_LOG_DAYS - 1);
        $byDay = fn (Collection $rows): Collection => $rows->groupBy(fn (object $row): string => DailySeries::localDate($row->created_at));

        $entries = $byDay(self::entries([$branch->id], $since));
        $charged = $byDay($charges->where('subscription_transactions.created_at', '>=', $since)->toBase()->get(['subscription_transactions.created_at', 'amount']));
        $names = User::query()->whereIn('id', $entries->flatten()->pluck('user_id')->unique())->pluck('name', 'id');

        return array_map(function (string $day) use ($entries, $charged, $names): array {
            $dayEntries = $entries[$day] ?? collect();
            $topEntrant = $dayEntries->countBy('user_id')->sortDesc()->keys()->first();

            return [
                'date' => $day,
                'newSubscriptions' => $dayEntries->where('kind', 'registration')->count(),
                'entries' => $dayEntries->count(),
                'chargesCount' => ($charged[$day] ?? collect())->count(),
                'chargesTotal' => Money::sum(($charged[$day] ?? collect())->map(fn (object $line): string => Money::amount(Money::decimal($line->amount)->abs()))),
                'topEntrant' => $topEntrant ? ($names[$topEntrant] ?? null) : null,
            ];
        }, array_reverse(DailySeries::lastDays(self::WORK_LOG_DAYS)));
    }

    /**
     * Every entry made in the given branches since `$since`: subscriptions
     * registered and readings entered, each with its branch, who made it
     * and when.
     *
     * @param  array<int, int>  $branchIds
     * @return Collection<int, object{branch_id: int, user_id: int, created_at: string, kind: string}>
     */
    public static function entries(array $branchIds, CarbonImmutable $since): Collection
    {
        $registrations = Subscription::query()
            ->whereIn('branch_id', $branchIds)
            ->where('created_at', '>=', $since)
            ->toBase()
            ->selectRaw("branch_id, registered_by as user_id, created_at, 'registration' as kind")
            ->get();

        $readings = MeterReading::query()
            ->whereIn('branch_id', $branchIds)
            ->where('created_at', '>=', $since)
            ->toBase()
            ->selectRaw("branch_id, recorded_by as user_id, created_at, 'reading' as kind")
            ->get();

        return $registrations->concat($readings);
    }
}
