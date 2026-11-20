<?php

namespace App\Http\Controllers;

use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Support\Ledger\StatementBuilder;
use App\Support\Ledger\TransactionAuditPage;
use App\Support\Queries\DataTableFilters;
use App\Support\Reports\DailySeries;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * The audit log (سجل التدقيق): every change made to the subscriptions' account
 * lines after they were recorded, newest first — details edited in place,
 * lines cancelled or corrected, payments refunded and lines deleted for
 * good — with who did it, when and why. Read-only; a row opens the
 * subscription's statement over the page.
 */
class TransactionAuditController extends Controller
{
    /**
     * The period tabs, as the number of days each covers (null: since the
     * first change).
     */
    public const PERIODS = ['today' => 1, '7' => 7, '30' => 30, '90' => 90, 'all' => null];

    public const DEFAULT_PER_PAGE = 25;

    /**
     * The kinds of change, as the "الإجراء" filter and column name them.
     *
     * @var array<string, string>
     */
    public const KINDS = [
        'amendment' => 'تعديل',
        'cancellation' => 'إلغاء',
        'correction' => 'تصحيح',
        'refund' => 'إرجاع',
        'deletion' => 'حذف نهائي',
    ];

    public function index(Request $request): InertiaResponse
    {
        $this->authorize('viewTransactionAudit', SubscriptionTransaction::class);

        $actor = $request->user();
        $period = TransactionAuditPage::period($request);
        $days = self::PERIODS[$period];
        $from = $days ? DailySeries::startOfDay($days - 1) : null;
        $kind = TransactionAuditPage::filterValue($request, 'kind');

        $inPeriod = fn (): QueryBuilder => TransactionAuditPage::filteredEvents($request, $actor)
            ->when($from, fn (QueryBuilder $query) => $query->where('happened_at', '>=', $from));

        $events = $inPeriod()
            ->when(array_key_exists((string) $kind, self::KINDS), fn (QueryBuilder $query) => $query->where('kind', $kind))
            ->orderByDesc('happened_at')
            ->orderByDesc('event_id')
            ->paginate(DataTableFilters::dataTablePerPage($request, self::DEFAULT_PER_PAGE))
            ->withQueryString();

        $rows = TransactionAuditPage::rows(collect($events->items()));
        $events->setCollection($rows);

        return Inertia::render('TransactionAudit/Index', [
            'events' => $events,
            'period' => $period,
            'counts' => TransactionAuditPage::counts($inPeriod()),
            // Across every change in the period, not only this page: what they moved and how many need a look.
            'impactSummary' => fn () => TransactionAuditPage::impactSummary(TransactionAuditPage::rows($inPeriod()->get())),
            'today' => DailySeries::today()->toDateString(),
            'scopeLabel' => $actor->hasFinancialAuditAccess() ? ($actor->auditSettings()['scope'] === 'selected' ? 'الفروع المحددة للتدقيق' : 'كل الفروع') : ($actor->workBranch()?->name ?? '—'),
            'filters' => DataTableFilters::dataTableState($request, 'happened_at', 'desc', self::DEFAULT_PER_PAGE),
            'filterOptions' => TransactionAuditPage::filterOptions($actor),
            // A row's subscription's statement, opened over the log.
            'statement' => fn () => StatementBuilder::requestedStatement($request, $actor),
        ]);
    }
}
