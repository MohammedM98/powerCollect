<?php

namespace App\Http\Controllers;

use App\Http\Requests\FinancialReportFiltersRequest;
use App\Http\Requests\ViewFinancialReportRequest;
use App\Models\Branch;
use App\Models\Closing;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Support\Branches\BranchScope;
use App\Support\Closing\ClosingPeriods;
use App\Support\Queries\DataTableFilters;
use App\Support\Reports\BranchReport;
use App\Support\Reports\DebtAging;
use App\Support\Reports\FinancialReportAccess;
use App\Support\Reports\FinancialReportPage;
use App\Support\Reports\ReportDetails;
use App\Support\Reports\ReportPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The reports page (التقارير): a branch's day — or any stretch of days, or
 * every branch the user may see: how what the subscriptions owe moved,
 * where the payments came in, the readings, and every line, which download
 * as a CSV. Report access retains the user's existing branch scope.
 */
class ReportController extends Controller
{
    public const PER_PAGE = 50;

    /**
     * The summary sections (overview, collections, movements) carry the
     * period's figures and lines for the screen, print and Excel; the
     * detail sections (boxes, debts, statement) build only their own table.
     */
    public function index(ViewFinancialReportRequest $request): InertiaResponse
    {
        $section = $request->validated('section') ?? 'overview';
        $branches = FinancialReportAccess::branches($request->user());
        ['chosen' => $chosen, 'branch' => $branch, 'from' => $from, 'to' => $to, 'today' => $today, 'kind' => $kind] = FinancialReportPage::filters($request, $branches);
        $report = new BranchReport($chosen, $from, $to);
        $details = new ReportDetails($chosen, $from, $to);
        $debtData = $section === 'debts' ? $details->debts() : null;
        $boxData = $section === 'boxes' ? $details->boxes() : null;
        $statementData = $section === 'statement' ? FinancialReportPage::statement($request, $chosen, $from, $to) : null;
        $accountDirectory = $section === 'statement' && $statementData === null && $request->user()->can('viewAny', Subscription::class)
            ? FinancialReportPage::accountDirectory($request, $chosen) : null;
        $detailTable = match ($section) {
            'debts' => FinancialReportPage::detailTable($request, collect($debtData['rows'])->map(fn (array $row): array => [...$row, ...$row['buckets']]), $section),
            'boxes' => FinancialReportPage::detailTable($request, collect($boxData['rows']), $section),
            'statement' => $statementData ? FinancialReportPage::detailTable($request, collect($statementData['lines']), $section) : null,
            default => null,
        };
        $period = ReportPeriod::describe($from, $to, $request->query('view'), $today);
        $summary = $chosen->isNotEmpty() && in_array($section, ['overview', 'collections', 'movements'], true);
        $collections = $summary ? $report->collections() : null;
        $comparison = null;
        if ($collections !== null) {
            $previous = (new BranchReport($chosen, ClosingPeriods::date($period['comparison']['from']), ClosingPeriods::date($period['comparison']['to'])))->collections(includeReceipts: false);
            $previousCents = Closing::cents($previous['total']);
            $difference = Closing::cents($collections['total']) - $previousCents;
            $comparison = [
                ...$period['comparison'],
                'total' => $previous['total'],
                'difference' => Closing::money($difference),
                'percentage' => $previousCents === 0 ? null : round($difference / $previousCents * 100, 1),
            ];
        }
        $branchSummary = $summary && $chosen->count() > 1
            ? $chosen->map(function (Branch $item) use ($from, $to): array {
                $branchReport = new BranchReport(collect([$item]), $from, $to);

                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'flow' => $branchReport->flow(),
                    'collections' => $branchReport->collections(includeReceipts: false),
                ];
            })->values()
            : collect();
        $flow = $summary ? $report->flow() : null;
        $scopeLabel = $chosen->count() === 1 ? $chosen->first()->name : 'كل الفروع';
        $transactions = $summary
            ? $report->lines($kind)
                ->with(['subscription.branch', 'subscription.meterBox', 'recordedBy', 'meterReading', 'reverses.meterReading', 'bankTransferAudit', 'referenceTransaction'])
                ->orderByDesc('subscription_transactions.created_at')
                ->orderByDesc('subscription_transactions.id')
                ->paginate($request->boolean('print') ? DataTableFilters::dataTablePerPage($request, self::PER_PAGE) : self::PER_PAGE)
                ->withQueryString()
                ->through(fn (SubscriptionTransaction $line): array => FinancialReportPage::row($line))
            : null;
        $printData = null;
        if ($request->boolean('print') && $flow !== null) {
            $detail = $request->query('print_view') === 'lines';
            $columns = $detail
                ? ['التاريخ', 'الوقت', 'الفرع', 'السند', 'المشترك', 'رقم الحساب', 'البيان', 'الحساب', 'عليه', 'له', 'سجّله', 'الحالة']
                : ['البند', 'العدد', 'المبلغ ₪'];
            $rows = $detail ? $transactions->getCollection()->map(fn (array $line): array => [
                $line['day'], $line['time'], $line['branchName'], $line['voucherNumber'], $line['subscriptionName'], $line['accountNumber'],
                $line['description'], $line['account'], $line['isCredit'] ? '' : $line['amount'], $line['isCredit'] ? $line['amount'] : '',
                $line['recordedBy'], $line['isCancelled'] ? 'ملغى / قيد عكسي' : '',
            ])->all() : FinancialReportPage::summaryPrintRows($flow, $collections, $branchSummary, $comparison);
            $printData = [
                'columns' => array_map(fn (string $label): array => ['key' => $label, 'label' => $label], $columns),
                'rows' => array_map(fn (array $row): array => ['type' => 'row', 'cells' => array_combine($columns, array_map(fn (mixed $value): string => (string) $value, $row))], $rows),
                'total' => $detail ? $transactions->total() : count($rows),
                'summary' => $scopeLabel.' · '.$from->format('d/m/Y').' – '.$to->format('d/m/Y').($detail ? ' · '.collect(BranchReport::kinds())->firstWhere('value', $kind)['label'] : ' · الملخص لجميع أنواع الحركات'),
                'context' => ['branchName' => $scopeLabel, 'templatePage' => '/reports'],
            ];
        }
        if ($request->boolean('print') && in_array($section, ['debts', 'boxes', 'statement'], true)) {
            [$columns, $rows] = match ($section) {
                'debts' => [['المشترك', 'رقم الحساب', 'الفرع', 'حتى 30 يومًا', '31–60 يومًا', '61–90 يومًا', 'أكثر من 90 يومًا', 'الرصيد عليه', 'آخر دفعة'], collect($detailTable['rows'])->map(fn (array $row): array => [$row['name'], $row['accountNumber'], $row['branchName'], ...array_values($row['buckets']), $row['balance'], $row['lastPaymentDate'] ?? ''])->all()],
                'boxes' => [['الصندوق', 'المحصّل', 'الفرع', 'النوع', 'الحالة', 'العملة', 'المبلغ المسجل', 'عدد الحركات'], collect($detailTable['rows'])->map(fn (array $row): array => [$row['number'], $row['collector'], $row['branchName'], $row['type'], $row['status'], $row['currency'], $row['amount'], $row['count']])->all()],
                default => [['التاريخ', 'السند', 'البيان', 'عليه (مدين)', 'له (دائن)', 'الرصيد'], $statementData ? [
                    [$from->toDateString(), '', 'الرصيد الافتتاحي', '', '', $statementData['opening']],
                    ...collect($detailTable['rows'])->map(fn (array $line): array => [$line['day'], $line['voucherNumber'], $line['description'], $line['debit'] === '0.00' ? '' : $line['debit'], $line['credit'] === '0.00' ? '' : $line['credit'], $line['balance']])->all(),
                    [$to->toDateString(), '', 'الرصيد الختامي / إجمالي الفترة', $statementData['debit'], $statementData['credit'], $statementData['closing']],
                ] : []],
            };
            if ($section === 'debts') {
                $rows[] = ['الإجمالي', '', '', ...array_map(fn (string $key): string => $detailTable['totals'][$key], array_keys(DebtAging::BUCKETS)), $detailTable['totals']['balance'], ''];
            }
            if ($section === 'statement' && $statementData && $detailTable['active']) {
                array_shift($rows);
                array_pop($rows);
                $rows[] = ['', '', 'إجمالي الحركات المطابقة', $detailTable['totals']['debit'], $detailTable['totals']['credit'], ''];
            }
            $identity = $statementData ? $statementData['subscription']['name'].' · '.$statementData['subscription']['accountNumber'].' · ' : '';
            $printData = [
                'columns' => array_map(fn (string $label): array => ['key' => $label, 'label' => $label], $columns),
                'rows' => array_map(fn (array $row): array => ['type' => 'row', 'cells' => array_combine($columns, array_map(fn (mixed $value): string => (string) $value, $row))], $rows),
                'total' => count($rows), 'summary' => $identity.$scopeLabel.' · '.$from->format('d/m/Y').' – '.$to->format('d/m/Y'),
                'context' => ['branchName' => $scopeLabel, 'templatePage' => '/reports'],
            ];
        }

        return Inertia::render('Reports/Index', [
            'reportSection' => $section,
            'reportAccounts' => $accountDirectory,
            'accountFilters' => $accountDirectory !== null ? DataTableFilters::dataTableState($request, 'account_number') : null,
            'detailTable' => $detailTable === null ? null : FinancialReportPage::detailTablePage($request, $detailTable),
            'detailExport' => Inertia::optional(fn (): ?Collection => $detailTable['rows'] ?? null),
            'debts' => $debtData === null ? null : Arr::except($debtData, 'rows'),
            'boxData' => $boxData === null ? null : Arr::except($boxData, 'rows'),
            'reportStatement' => $statementData === null ? null : Arr::except($statementData, 'lines'),
            'canViewStatements' => $request->user()->can('viewAny', Subscription::class),
            'branches' => $branches->map(fn (Branch $branch): array => ['value' => $branch->id, 'label' => $branch->name])->values(),
            'filters' => ['branch' => $branch, 'from' => $from->toDateString(), 'to' => $to->toDateString(), 'kind' => $kind],
            'scopeLabel' => $scopeLabel,
            'branchScope' => BranchScope::shownTo($request->user()) ? BranchScope::describe($chosen) : null,
            'canExport' => FinancialReportAccess::export($request->user()),
            'period' => $period,
            'comparison' => $comparison,
            'printData' => $printData,
            'branchSummary' => $branchSummary,
            'presets' => FinancialReportPage::presets($today),
            'today' => $today->toDateString(),
            'cutoff' => ClosingPeriods::for($chosen->count() === 1 ? $chosen->first() : null)->cutoff(),
            'kinds' => BranchReport::kinds(),
            'flow' => $flow,
            'collections' => $collections,
            'readings' => $summary ? $report->readings() : null,
            'days' => $summary ? $report->days() : [],
            'transactions' => $transactions,
        ]);
    }

    /**
     * The report's lines, oldest first, as a CSV file for a spreadsheet,
     * with the same filters as on the page. The branch's name heads the
     * file and names it, so a file shared later still says whose it is.
     */
    public function export(FinancialReportFiltersRequest $request): StreamedResponse
    {
        ['chosen' => $chosen, 'from' => $from, 'to' => $to, 'lines' => $lines] = FinancialReportPage::exportedLines($request);
        $scope = BranchScope::describe($chosen)['name'];
        $columns = ['التاريخ', 'الوقت', 'الفرع', 'رقم السند', 'المشترك', 'رقم الحساب', 'الطبلون', 'النوع', 'البيان', 'طريقة الدفع', 'الحساب', 'العملة', 'المبلغ بالعملة', 'عليه', 'له', 'سجّله', 'ملغى'];

        return response()->streamDownload(function () use ($lines, $columns, $scope, $from, $to): void {
            $file = fopen('php://output', 'w');
            fwrite($file, "\u{FEFF}");
            fputcsv($file, ["{$scope} — التقارير المالية"]);
            fputcsv($file, ['الفترة: '.$from->format('d/m/Y').' – '.$to->format('d/m/Y')]);
            fputcsv($file, []);
            fputcsv($file, $columns);

            foreach ($lines->lazy(500) as $line) {
                $row = FinancialReportPage::row($line);
                fputcsv($file, [
                    $row['day'], $row['time'], $row['branchName'], $row['voucherNumber'], $row['subscriptionName'], $row['accountNumber'], $row['meterBoxNumber'],
                    $row['typeLabel'], $row['description'], $row['methodLabel'], $row['account'], $row['currency'], $row['currencyAmount'],
                    $row['isCredit'] ? '' : $row['amount'], $row['isCredit'] ? $row['amount'] : '', $row['recordedBy'], $row['isCancelled'] ? 'نعم' : '',
                ]);
            }

            fclose($file);
        }, 'التقارير_'.str_replace(' ', '-', $scope)."_{$from->toDateString()}_{$to->toDateString()}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * A bounded page of export lines, oldest first, and its next cursor.
     * Every request applies the same authorization and report filters.
     */
    public function lines(FinancialReportFiltersRequest $request): JsonResponse
    {
        ['lines' => $lines] = FinancialReportPage::exportedLines($request);
        $page = $lines->cursorPaginate(500);

        return response()->json([
            'lines' => $page->getCollection()->map(fn (SubscriptionTransaction $line): array => FinancialReportPage::row($line))->values(),
            'nextCursor' => $page->nextCursor()?->encode(),
        ]);
    }
}
