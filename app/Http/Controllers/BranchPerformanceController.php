<?php

namespace App\Http\Controllers;

use App\Enums\SubscriptionStatus;
use App\Models\Branch;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Support\Ledger\Money;
use App\Support\Reports\BranchPerformancePage;
use App\Support\Reports\DailySeries;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * How each branch is doing: what it charged its subscriptions (the lines
 * on their accounts, عليه), its subscriptions, and its staff's entries —
 * subscriptions registered and weekly readings entered — and when. The
 * Super Admin compares every branch; a branch's own staff go straight to
 * their branch. Read-only.
 */
class BranchPerformanceController extends Controller
{
    /**
     * The sort buttons, and the figure each one ranks branches by.
     */
    public const SORTS = [
        'revenue' => 'chargesTotal',
        'subscriptions' => 'activeSubscriptions',
        'activity' => 'weekEntries',
        'collection' => 'collectionRate',
        'debts' => 'owed',
    ];

    public const SPARKLINE_DAYS = 14;

    public const CHART_DAYS = 30;

    public const LATEST_REGISTRATIONS = 8;

    public function index(Request $request): InertiaResponse|RedirectResponse
    {
        $this->authorize('viewBranchPerformance', SubscriptionTransaction::class);

        $actor = $request->user();

        if (! $actor->isSuperAdmin()) {
            abort_unless($actor->workBranchId(), 403);

            return redirect()->route('branch-performance.show', $actor->workBranchId());
        }

        $sort = $request->query('sort');
        $sort = is_string($sort) && array_key_exists($sort, self::SORTS) ? $sort : 'revenue';

        $branches = BranchPerformancePage::withFigures(Branch::query())->with(['governorate', 'area'])->orderBy('name')->get();
        $entries = BranchPerformancePage::entriesPerDay($branches->modelKeys(), self::SPARKLINE_DAYS);

        $debts = BranchPerformancePage::debtsByBranch($branches->modelKeys());
        $summaries = $branches
            ->map(fn (Branch $branch): array => [...BranchPerformancePage::branchSummary($branch, $entries[$branch->id] ?? []), ...$debts[$branch->id]])
            ->sortByDesc(fn (array $branch): float => (float) ($branch[self::SORTS[$sort]] ?? -1))
            ->values()
            ->map(fn (array $branch, int $index): array => [...$branch, 'rank' => $index + 1]);

        return Inertia::render('BranchPerformance/Index', [
            'sort' => $sort,
            'summary' => [
                'branches' => $branches->count(),
                'activeBranches' => $branches->where('is_active', true)->count(),
                'chargesTotal' => Money::sum($summaries->pluck('chargesTotal')),
                'collectedTotal' => Money::sum($summaries->pluck('collectedTotal')),
                'owed' => Money::sum($summaries->pluck('owed')),
                'older' => Money::sum($summaries->pluck('older')),
                'subscriptions' => $summaries->sum('subscriptions'),
                'activeSubscriptions' => $summaries->sum('activeSubscriptions'),
                'weekEntries' => $summaries->sum('weekEntries'),
                'todayEntries' => $summaries->sum('todayEntries'),
                'staff' => $summaries->sum('staff'),
            ],
            'branches' => $summaries,
        ]);
    }

    public function show(Request $request, Branch $branch): InertiaResponse
    {
        $this->authorize('viewForBranch', [SubscriptionTransaction::class, $branch]);

        $branch = BranchPerformancePage::withFigures(Branch::query())->with(['governorate', 'area'])->findOrFail($branch->id);
        $entries = BranchPerformancePage::entriesPerDay([$branch->id], self::CHART_DAYS)[$branch->id] ?? [];
        $charges = fn (): Builder => SubscriptionTransaction::query()->charges()->whereHas('subscription', fn (Builder $query) => $query->where('branch_id', $branch->id));
        $statusCounts = $branch->subscriptions()->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return Inertia::render('BranchPerformance/Show', [
            'branch' => [
                ...BranchPerformancePage::branchSummary($branch, $entries),
                'phone' => $branch->phone,
                'statusCounts' => array_map(fn (array $status): array => [
                    ...$status,
                    'count' => (int) ($statusCounts[$status['value']] ?? 0),
                ], SubscriptionStatus::options()),
                'monthChargesTotal' => Money::amount($charges()
                    ->where('subscription_transactions.created_at', '>=', DailySeries::startOfDay(self::CHART_DAYS - 1))
                    ->toBase()
                    ->selectRaw('coalesce(sum(abs(amount)), 0) as total')
                    ->value('total')),
                'monthEntries' => array_sum($entries),
            ],
            'canCompareBranches' => $request->user()->isSuperAdmin(),
            'dailyRegistrations' => DailySeries::counts(Subscription::query()->where('branch_id', $branch->id), 'subscriptions.created_at', self::CHART_DAYS),
            'dailyCharges' => DailySeries::sums($charges(), 'subscription_transactions.created_at', 'subscription_transactions.amount', self::CHART_DAYS),
            'team' => BranchPerformancePage::team($branch),
            'workLog' => BranchPerformancePage::workLog($branch, $charges()),
            'latestRegistrations' => $branch->subscriptions()
                ->with('registeredBy')
                ->latest()
                ->latest('id')
                ->take(self::LATEST_REGISTRATIONS)
                ->get()
                ->map(fn (Subscription $subscription): array => [
                    'id' => $subscription->id,
                    'name' => $subscription->displayName(),
                    'phone' => $subscription->contactPhone(),
                    'status' => $subscription->status->value,
                    'registeredByName' => $subscription->registeredBy?->name,
                    'createdAt' => $subscription->created_at->toIso8601String(),
                ]),
        ]);
    }
}
