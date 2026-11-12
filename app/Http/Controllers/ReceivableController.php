<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Branches\BranchScope;
use App\Support\Ledger\StatementBuilder;
use App\Support\Queries\DataTableFilters;
use App\Support\Reports\DailySeries;
use App\Support\Reports\DebtAging;
use App\Support\Reports\ReceivablesPage;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * The debts report (أعمار الديون): every subscription the user may see who
 * owes money, with how old their debt is (see DebtAging), the totals per
 * age and the oldest debts first to chase. Read-only; a row opens the
 * subscription's statement over the page.
 */
class ReceivableController extends Controller
{
    public const DEFAULT_PER_PAGE = 25;

    public function index(Request $request): InertiaResponse
    {
        $this->authorize('viewDebtAging', SubscriptionTransaction::class);

        $actor = $request->user();
        $debtors = ReceivablesPage::withAgeFilter((new DebtAging(DailySeries::today()))->debtors(ReceivablesPage::filteredSubscriptions($request, $actor)), $request);
        $perPage = DataTableFilters::dataTablePerPage($request, self::DEFAULT_PER_PAGE);
        $page = max(1, (int) $request->input('page', 1));
        $sorted = ReceivablesPage::sortDebtors($debtors, $request);

        $rows = new LengthAwarePaginator(
            $sorted->forPage($page, $perPage)->map(fn (array $debtor): array => ReceivablesPage::row($debtor))->values(),
            $sorted->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()],
        );

        return Inertia::render('Receivables/Index', [
            'debtors' => $rows,
            'summary' => ReceivablesPage::summary($debtors),
            'buckets' => collect(DebtAging::BUCKET_LABELS)->map(fn (string $label, string $key): array => ['key' => $key, 'label' => __($label)])->values(),
            'today' => DailySeries::today()->toDateString(),
            'scopeLabel' => ReceivablesPage::scopeLabel($request, $actor),
            // The Super Admin reads, large above the report, which branch it holds.
            'branchScope' => fn () => BranchScope::shownTo($actor) ? BranchScope::forFilter($actor, ReceivablesPage::filterValue($request, 'branch_id')) : null,
            'filters' => DataTableFilters::dataTableState($request, 'balance', 'desc', self::DEFAULT_PER_PAGE),
            'filterOptions' => ReceivablesPage::filterOptions($actor),
            // A debtor's statement, opened over the report.
            'statement' => fn () => StatementBuilder::requestedStatement($request, $actor),
        ]);
    }
}
