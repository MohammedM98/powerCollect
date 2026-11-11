<?php

namespace App\Support\Reports;

use App\Http\Requests\FinancialReportFiltersRequest;
use App\Http\Requests\ViewFinancialReportRequest;
use App\Models\Branch;
use App\Models\Closing;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Support\ArabicSearch;
use App\Support\Closing\ClosingPeriods;
use App\Support\Ledger\LedgerAmounts;
use App\Support\Ledger\LinePresenter;
use App\Support\Queries\DataTableFilters;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Builds the financial reports page: its filters, sections, detail tables, statement and export rows.
 */
class FinancialReportPage
{
    /**
     * The longest stretch a report covers.
     */
    public const MAX_DAYS = 92;

    /** Filter presentation rows after historical running balances have been calculated. @param Collection<int, array<string, mixed>> $rows @return array<string, mixed> */
    public static function detailTable(ViewFinancialReportRequest $request, Collection $rows, string $section): array
    {
        $validated = $request->validated();
        $columns = match ($section) {
            'statement' => ['day', 'voucherNumber', 'description', 'debit', 'credit', 'balance'],
            'debts' => ['name', 'accountNumber', 'branchName', ...array_keys(DebtAging::BUCKETS), 'balance', 'lastPaymentDate'],
            default => ['number', 'collector', 'branchName', 'type', 'status', 'currency', 'amount', 'count'],
        };
        $allowedFilters = match ($section) {
            'statement' => ['side', 'type'],
            'debts' => ['age', 'branchName'],
            default => ['status', 'type', 'collector', 'currency'],
        };
        $defaultSort = $section === 'statement' ? 'day' : ($section === 'debts' ? 'balance' : 'number');
        $state = DataTableFilters::dataTableState($request, $defaultSort, $section === 'debts' ? 'desc' : 'asc');
        $state['sort'] = in_array($validated['sort'] ?? '', $columns, true) ? $validated['sort'] : $defaultSort;
        $state['filter'] = array_intersect_key($validated['filter'] ?? [], array_flip($allowedFilters));
        $state['search'] = $validated['search'] ?? '';
        $options = collect($allowedFilters)->map(function (string $key) use ($rows): array {
            $values = match ($key) {
                'side' => [['value' => 'debit', 'label' => __('Debit (owed)')], ['value' => 'credit', 'label' => __('Credit (in favour)')]],
                'age' => collect(DebtAging::BUCKET_LABELS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => __($label)])->values()->all(),
                default => $rows->unique($key)->filter(fn (array $row): bool => filled($row[$key] ?? null))->map(fn (array $row): array => ['value' => (string) $row[$key], 'label' => $key === 'type' ? ($row['typeLabel'] ?? $row[$key]) : $row[$key]])->values()->all(),
            };
            $labels = ['side' => __('Entry side'), 'type' => __('Transaction type'), 'age' => __('Debt age'), 'branchName' => __('Branch'), 'status' => __('Status'), 'collector' => __('The collector'), 'currency' => __('Currency')];

            return DataTableFilters::filterGroup($key, $labels[$key], $values);
        })->all();
        $terms = ArabicSearch::terms($state['search']);
        $matching = $rows->filter(function (array $row) use ($terms, $state, $columns): bool {
            $text = ArabicSearch::normalize(implode(' ', array_map(fn (string $key): string => (string) ($row[$key] ?? ''), $columns)));
            foreach ($terms as $term) {
                if (! str_contains($text, $term)) {
                    return false;
                }
            }
            foreach ($state['filter'] as $key => $value) {
                if ($value === null || $value === '') {
                    continue;
                }
                $matches = match ($key) {
                    'side' => in_array($value, ['debit', 'credit'], true) && Closing::cents($row[$value]) > 0,
                    'age' => in_array($value, array_keys(DebtAging::BUCKETS), true) && Closing::cents($row[$value]) > 0,
                    default => (string) ($row[$key] ?? '') === $value,
                };
                if (! $matches) {
                    return false;
                }
            }

            return true;
        })->sortBy($state['sort'], SORT_REGULAR, $state['direction'] === 'desc')->values();
        $sumKeys = $section === 'statement' ? ['debit', 'credit'] : ($section === 'debts' ? [...array_keys(DebtAging::BUCKETS), 'balance'] : []);
        $totals = [];
        foreach ($sumKeys as $key) {
            $totals[$key] = Closing::money($matching->reject(fn (array $row): bool => $row['netted'] ?? false)->sum(fn (array $row): int => Closing::cents($row[$key])));
        }

        return ['rows' => $matching, 'state' => $state, 'options' => $options, 'total' => $matching->count(), 'unfilteredTotal' => $rows->count(), 'totals' => $totals, 'active' => $terms !== [] || collect($state['filter'])->contains(fn (?string $value): bool => filled($value))];
    }

    /**
     * The page of a detail table the screen shows. Printing uses every
     * matching row, and the Excel export asks for them as `detailExport`.
     *
     * @param  array<string, mixed>  $table
     * @return array<string, mixed>
     */
    public static function detailTablePage(Request $request, array $table): array
    {
        $size = $table['state']['per_page'];
        $last = max(1, (int) ceil($table['total'] / $size));
        $page = min(max(1, $request->integer('page', 1)), $last);

        return [
            ...$table,
            'rows' => $table['rows']->forPage($page, $size)->values(),
            'meta' => ['current_page' => $page, 'last_page' => $last, 'from' => $table['total'] === 0 ? 0 : ($page - 1) * $size + 1, 'to' => min($page * $size, $table['total']), 'total' => $table['total']],
        ];
    }

    /** @param Collection<int, Branch> $branches */
    public static function accountDirectory(ViewFinancialReportRequest $request, Collection $branches): LengthAwarePaginator
    {
        $validated = $request->validated();
        $sort = in_array($validated['sort'] ?? '', ['account_number', 'display_name'], true) ? $validated['sort'] : 'account_number';

        return Subscription::query()->readableTo($request->user())
            ->whereIn('subscriptions.branch_id', $branches->pluck('id')->all())
            ->when(! $request->user()->can('viewArchived', Subscription::class), fn (Builder $query) => $query->whereNull('archived_at'))
            ->select('subscriptions.*')->selectRaw("COALESCE(NULLIF(subscription_name, ''), full_name) as display_name")
            ->with('branch:id,name')
            ->when(($validated['search'] ?? '') !== '', fn (Builder $query) => $query->matchingSearch($validated['search']))
            ->orderBy($sort, DataTableFilters::sortDirection($request))->orderBy('subscriptions.id')
            ->paginate(DataTableFilters::dataTablePerPage($request))->withQueryString()
            ->through(fn (Subscription $subscription): array => ['id' => $subscription->id, 'name' => $subscription->displayName(), 'accountNumber' => $subscription->account_number, 'branchName' => $subscription->branch?->name]);
    }

    /** All signed ledger lines in the period, including reversals, share one running balance. @param Collection<int, Branch> $branches @return array<string, mixed>|null */
    public static function statement(ViewFinancialReportRequest $request, Collection $branches, CarbonImmutable $from, CarbonImmutable $to): ?array
    {
        $validated = $request->validated();
        if (! isset($validated['subscription'])) {
            return null;
        }
        $subscription = Subscription::query()->readableTo($request->user())->whereIn('branch_id', $branches->pluck('id')->all())->findOrFail($validated['subscription']);
        Gate::authorize('view', $subscription);
        [$start, $end] = ClosingPeriods::for($subscription->branch_id)->utcRange($from, $to);
        $opening = Closing::cents((string) $subscription->transactions()->where('created_at', '<', $start)->sum('amount'));
        $balance = $opening;
        $debit = 0;
        $credit = 0;
        $transactions = $subscription->transactions()->where('created_at', '>=', $start)->where('created_at', '<', $end)
            ->with(['subscription.branch', 'subscription.meterBox', 'recordedBy', 'meterReading', 'reverses.meterReading', 'bankTransferAudit', 'referenceTransaction'])
            ->orderBy('created_at')->orderBy('id')->get();
        $netted = self::nettedWithinPeriod($transactions);
        $lines = $transactions->map(function (SubscriptionTransaction $line) use (&$balance, &$debit, &$credit, $netted): array {
            $amount = Closing::cents($line->amount);
            $balance += $amount;
            if (! isset($netted[$line->id])) {
                $debit += max(0, $amount);
                $credit += max(0, -$amount);
            }

            return [...self::row($line), 'balance' => Closing::money($balance), 'debit' => Closing::money(max(0, $amount)), 'credit' => Closing::money(max(0, -$amount)), 'netted' => isset($netted[$line->id])];
        });

        return ['subscription' => ['id' => $subscription->id, 'name' => $subscription->displayName(), 'accountNumber' => $subscription->account_number, 'branchName' => $branches->firstWhere('id', $subscription->branch_id)?->name, 'url' => route('subscriptions.statement', $subscription)], 'opening' => Closing::money($opening), 'debit' => Closing::money($debit), 'credit' => Closing::money($credit), 'closing' => Closing::money($balance), 'lines' => $lines];
    }

    /**
     * The lines that cancel each other out inside the period: a cancelled
     * line and the reversal that takes it back, both recorded in it. They
     * stay on the statement but count in neither its debit nor its credit
     * total, as on the subscription's own statement page. A line cancelled
     * after the period still stood at its end, so it keeps counting.
     *
     * @param  Collection<int, SubscriptionTransaction>  $transactions
     * @return array<int, true>
     */
    public static function nettedWithinPeriod(Collection $transactions): array
    {
        $ids = $transactions->pluck('id')->flip();

        return $transactions->filter(fn (SubscriptionTransaction $line): bool => $line->reverses_id !== null && $ids->has($line->reverses_id))
            ->flatMap(fn (SubscriptionTransaction $line): array => [$line->id, $line->reverses_id])
            ->mapWithKeys(fn (int $id): array => [$id => true])
            ->all();
    }

    /**
     * The summary's printable rows, using the same figures as the screen.
     *
     * @param  array<string, mixed>  $flow
     * @param  array<string, mixed>  $collections
     * @param  Collection<int, array<string, mixed>>  $branches
     * @param  array<string, mixed>|null  $comparison
     * @return list<array{string, int|string, string}>
     */
    public static function summaryPrintRows(array $flow, array $collections, Collection $branches, ?array $comparison): array
    {
        return [
            [__('Opening balance of subscriber accounts'), '', $flow['opening']],
            ...array_map(fn (array $line): array => ['+ '.$line['label'], $line['count'], $line['total']], $flow['charges']),
            [__('Total charges (debit)'), '', $flow['chargesTotal']],
            ...array_map(fn (array $line): array => ['− '.$line['label'], $line['count'], $line['total']], $flow['credits']),
            [__('Total payments and discounts (credit)'), '', $flow['creditsTotal']],
            [__('Cancellations and reversing entries'), $flow['corrections']['count'], $flow['corrections']['total']],
            [__('Closing balance of subscriber accounts'), '', $flow['closing']],
            [__('Total receipts recorded'), $collections['count'], $collections['total']],
            [__('Cash collection'), '', $collections['cash']],
            [__('Transfers and cheques'), '', $collections['nonCash']],
            [$collections['receipts']['basis'], '', ''],
            ...array_map(fn (array $row): array => [$row['label'], '', $row['amount']], $collections['receipts']['rows']),
            ...($comparison === null ? [] : [
                [__('Collected before (').$comparison['from'].' – '.$comparison['to'].')', '', $comparison['total']],
                [__('Collection difference from the previous period'), '', $comparison['difference']],
            ]),
            ...array_map(fn (array $account): array => [__('Account: ').$account['label'], $account['count'], $account['total']], $collections['accounts']),
            ...array_map(fn (array $collector): array => [__('Collector: ').$collector['name'], $collector['count'], $collector['total']], $collections['collectors']),
            ...$branches->map(fn (array $branch): array => [__('Collection: ').$branch['name'], $branch['collections']['count'], $branch['collections']['total']])->all(),
        ];
    }

    /**
     * The lines a download holds, for whoever may export the report.
     *
     * @return array{chosen: Collection<int, Branch>, from: CarbonImmutable, to: CarbonImmutable, lines: Builder<SubscriptionTransaction>}
     */
    public static function exportedLines(FinancialReportFiltersRequest $request): array
    {
        ['chosen' => $chosen, 'from' => $from, 'to' => $to, 'kind' => $kind] = self::filters($request, FinancialReportAccess::branches($request->user()));
        $lines = (new BranchReport($chosen, $from, $to))->lines($kind)
            ->with(['subscription.branch', 'subscription.meterBox', 'recordedBy', 'meterReading', 'reverses.meterReading', 'bankTransferAudit', 'referenceTransaction'])
            ->orderBy('subscription_transactions.created_at')
            ->orderBy('subscription_transactions.id');

        return ['chosen' => $chosen, 'from' => $from, 'to' => $to, 'lines' => $lines];
    }

    /**
     * The request's branch (one of the user's, or all of them when they see
     * more than one), its days (today by default, the day furthest along
     * among the branches; never past today, at most a quarter) and the kind
     * of line listed.
     *
     * @param  Collection<int, Branch>  $branches
     * @return array{chosen: Collection<int, Branch>, branch: int|string|null, from: CarbonImmutable, to: CarbonImmutable, today: CarbonImmutable, kind: string}
     */
    public static function filters(FinancialReportFiltersRequest $request, Collection $branches): array
    {
        $validated = $request->validated();
        $requested = $validated['branch'] ?? null;
        $all = ($requested === null || $requested === '' || $requested === 'all') && $branches->count() > 1;
        $branch = $all ? null : ($branches->firstWhere('id', (int) $requested)
            ?? $branches->firstWhere('id', $request->user()->branch_id)
            ?? $branches->first());
        $chosen = $all ? $branches : collect([$branch])->filter()->values();
        $today = ClosingPeriods::furthestToday($chosen);
        $to = isset($validated['to']) ? ClosingPeriods::date($validated['to']) : $today;
        $from = isset($validated['from']) ? ClosingPeriods::date($validated['from']) : $to;

        if ($to->greaterThan($today)) {
            $to = $today;
        }

        if ($from->greaterThan($to) || $from->diffInDays($to) >= self::MAX_DAYS) {
            throw ValidationException::withMessages(['from' => __('Choose a valid period of no more than three months that does not go past today.')]);
        }

        return [
            'chosen' => $chosen,
            'branch' => $all ? 'all' : $branch?->id,
            'from' => $from,
            'to' => $to,
            'today' => $today,
            'kind' => $validated['kind'] ?? 'all',
        ];
    }

    /**
     * The quick picks above the report: today, yesterday, this week, this
     * month and last month, by the closing schedule's week and cut-off.
     *
     * @return array<int, array{key: string, label: string, from: string, to: string}>
     */
    public static function presets(CarbonImmutable $today): array
    {
        [$weekStart] = ClosingPeriods::week($today);
        [$lastMonthStart, $lastMonthEnd] = ClosingPeriods::month($today->startOfMonth()->subDay());

        return array_map(fn (array $preset): array => [...$preset, 'from' => $preset['from']->toDateString(), 'to' => $preset['to']->toDateString()], [
            ['key' => 'today', 'label' => __('Today'), 'from' => $today, 'to' => $today],
            ['key' => 'yesterday', 'label' => __('Yesterday'), 'from' => $today->subDay(), 'to' => $today->subDay()],
            ['key' => 'week', 'label' => __('This week'), 'from' => $weekStart, 'to' => $today],
            ['key' => 'last-week', 'label' => __('Last week'), 'from' => $weekStart->subWeek(), 'to' => $weekStart->subDay()],
            ['key' => 'month', 'label' => __('This month'), 'from' => $today->startOfMonth(), 'to' => $today],
            ['key' => 'last-month', 'label' => __('Last month'), 'from' => $lastMonthStart, 'to' => $lastMonthEnd],
            ['key' => 'quarter', 'label' => __('Last 90 days'), 'from' => $today->subDays(89), 'to' => $today],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public static function row(SubscriptionTransaction $line): array
    {
        $isPayment = $line->isPayment();

        return [
            'id' => $line->id,
            'subscriptionId' => $line->subscription_id,
            'day' => ClosingPeriods::for($line->subscription->branch_id)->dayOf($line->created_at),
            'time' => DailySeries::localTime($line->created_at),
            'branchName' => $line->subscription->branch?->name,
            'voucherNumber' => LinePresenter::printedVoucherNumber($line),
            'subscriptionName' => $line->subscription->displayName(),
            'accountNumber' => $line->subscription->account_number,
            'meterBoxNumber' => $line->subscription->meterBox?->box_number,
            'type' => $line->type,
            'typeLabel' => LinePresenter::typeLabel($line),
            'description' => LinePresenter::description($line),
            'methodLabel' => $isPayment && $line->payment_method ? __($line->payment_method->label()) : null,
            'account' => $isPayment ? ($line->bank_name ?? __('Cash box')) : null,
            'currency' => $isPayment ? $line->currency?->value : null,
            'currencyAmount' => $isPayment && $line->currency_amount !== null ? LedgerAmounts::formatAmount($line->currency_amount) : null,
            'isCredit' => $line->isCredit(),
            'isCancelled' => $line->isCancelled() || $line->isReversal(),
            'amount' => ltrim((string) $line->amount, '-'),
            'recordedBy' => $line->recordedBy?->name,
        ];
    }
}
