<?php

namespace App\Http\Controllers;

use App\Http\Requests\ViewLedgerRequest;
use App\Models\Branch;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Branches\BranchScope;
use App\Support\Ledger\LedgerPage;
use App\Support\Ledger\Money;
use App\Support\Ledger\StatementBuilder;
use App\Support\Queries\DataTableFilters;
use App\Support\Reports\DailySeries;
use Illuminate\Database\Eloquent\Builder;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The financial log (السجل المالي): every line of the accounts of the
 * subscriptions the user may see, newest first and grouped by day, with the
 * period's totals, a daily chart and the totals per branch. Read-only.
 *
 * The figures sum one side of the accounts: the charges (عليه) unless the
 * type filter picks payments or discounts (له), since adding money owed to
 * money paid would mean nothing. Amounts are in shekels. Cancelled lines
 * and their reversals are listed but left out of every figure, since they
 * cancel each other out.
 */
class LedgerController extends Controller
{
    public const DEFAULT_PER_PAGE = 25;

    /**
     * The chart never shows fewer days than this, and shows this many when
     * the period has no start.
     */
    public const MIN_CHART_DAYS = 7;

    public const OPEN_CHART_DAYS = 30;

    public const CREDIT = 'credit';

    public function index(ViewLedgerRequest $request): InertiaResponse|StreamedResponse
    {

        $actor = $request->user();
        $period = LedgerPage::period($request);
        $dateBasis = $request->validated('date_basis') ?? 'recorded';
        [$from, $until, $days] = LedgerPage::dateWindow($request, $period);
        $side = LedgerPage::headlineSide($request);

        $ledger = fn (): Builder => LedgerPage::filteredLedger($request, $actor);
        $inPeriod = fn (): Builder => LedgerPage::dateFiltered($ledger(), $from, $until, $dateBasis);
        $onSide = fn (Builder $query): Builder => $side === self::CREDIT ? $query->credits() : $query->charges();

        if ($request->query('format') === 'csv') {
            return LedgerPage::export(LedgerPage::sortEntries($inPeriod()->with(['subscription.branch', 'recordedBy', 'splitPayment']), $request));
        }

        $entries = LedgerPage::sortEntries($inPeriod()->with(['subscription.branch', 'recordedBy', 'splitPayment']), $request)
            ->paginate(DataTableFilters::dataTablePerPage($request, self::DEFAULT_PER_PAGE))
            ->withQueryString()
            ->through(fn (SubscriptionTransaction $transaction): array => LedgerPage::row($transaction));

        $groupedByDay = ! LedgerPage::sortedByAmount($request);

        return Inertia::render('Ledger/Index', [
            'entries' => $entries,
            'period' => $period,
            'dateBasis' => $dateBasis,
            'dateRange' => [
                'from' => $from?->setTimezone(config('app.business_timezone'))->toDateString(),
                'to' => $until->setTimezone(config('app.business_timezone'))->subDay()->toDateString(),
            ],
            'ledgerTotals' => LedgerPage::ledgerTotals($inPeriod()),
            'openingBalance' => LedgerPage::openingBalance($ledger(), $from, $dateBasis),
            'newerNet' => LedgerPage::newerNet(LedgerPage::sortEntries($inPeriod(), $request), $request, ($entries->currentPage() - 1) * $entries->perPage(), $dateBasis),
            'side' => $side,
            'summary' => LedgerPage::summary($onSide($inPeriod()), $from && $days ? $onSide($ledger()) : null, $from, $days, $inPeriod(), $dateBasis),
            'dayTotals' => $groupedByDay ? LedgerPage::dayTotals($inPeriod(), collect($entries->items())->pluck('day')->unique()->all()) : [],
            'dailyTotals' => $dateBasis === 'paid' || in_array($period, ['yesterday', 'month', 'custom'], true) ? [] : DailySeries::sums(
                $onSide($ledger()),
                'subscription_transactions.created_at',
                'subscription_transactions.amount',
                $days === null ? self::OPEN_CHART_DAYS : max($days, self::MIN_CHART_DAYS),
            ),
            'branchTotals' => LedgerPage::branchTotals($onSide($inPeriod())),
            'today' => DailySeries::today()->toDateString(),
            'scopeLabel' => LedgerPage::scopeLabel($request, $actor),
            // An auditor of several branches reads, large above the log, which branch it holds.
            'branchScope' => fn () => BranchScope::shownTo($actor) ? BranchScope::forFilter($actor, LedgerPage::filterValue($request, 'branch_id')) : null,
            'filters' => DataTableFilters::dataTableState($request, 'created_at', 'desc', self::DEFAULT_PER_PAGE),
            'filterOptions' => LedgerPage::filterOptions($actor),
            // A line's subscription's statement, opened over the log.
            'statement' => fn () => StatementBuilder::requestedStatement($request, $actor),
        ]);
    }
}
