<?php

namespace App\Support\Ledger;

use App\Enums\PaymentMethod;
use App\Http\Controllers\LedgerController;
use App\Http\Requests\ViewLedgerRequest;
use App\Models\Branch;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Queries\DataTableFilters;
use App\Support\Reports\DailySeries;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Builds the ledger page: its period and date window, the filtered and sorted lines, their rows and totals, and the CSV export.
 */
class LedgerPage
{
    /**
     * The period tabs, as the number of days each covers (null: since the
     * first entry).
     */
    public const PERIODS = ['today' => 1, 'yesterday' => 1, '7' => 7, '30' => 30, '90' => 90, 'month' => null, 'custom' => null, 'all' => null];

    public const DEFAULT_PERIOD = '30';

    /**
     * Type-filter values that pick a whole side instead of one type.
     */
    public const DEBIT = 'debit';

    /**
     * The lines the user may see — of subscriptions in their own branch (any
     * branch for the Super Admin) — narrowed by the search box and the
     * filters. Unordered, so it can be totalled.
     *
     * @return Builder<SubscriptionTransaction>
     */
    public static function filteredLedger(Request $request, User $actor): Builder
    {
        $search = DataTableFilters::searchTerm($request);
        $branchId = $actor->hasFinancialAuditAccess() ? self::filterValue($request, 'branch_id') : null;
        $type = self::filterValue($request, 'type');
        $recordedBy = self::filterValue($request, 'recorded_by');

        return SubscriptionTransaction::query()
            ->whereHas('subscription', fn (Builder $subscriptions) => $subscriptions
                ->readableTo($actor, true)
                ->when($branchId, fn (Builder $query) => $query->where('branch_id', $branchId)))
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $matches) => $matches
                ->whereHas('subscription', fn (Builder $subscriptions) => $subscriptions->where(fn (Builder $inner) => $inner
                    ->where('full_name', 'like', "%{$search}%")
                    ->orWhere('subscription_name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('subscription_phone', 'like', "%{$search}%")
                    ->orWhere('account_number', 'like', "%{$search}%")))
                ->orWhere('voucher_number', 'like', "%{$search}%")
                ->when(ctype_digit($search), fn (Builder $query) => $query->orWhere('voucher_number', ltrim($search, '0') ?: '0'))
                ->orWhere('manual_voucher_number', 'like', "%{$search}%")
                ->orWhere('reference_number', 'like', "%{$search}%")))
            ->when($type === self::DEBIT, fn (Builder $query) => $query->charges())
            ->when($type === LedgerController::CREDIT, fn (Builder $query) => $query->credits())
            ->when(
                ! in_array($type, [self::DEBIT, LedgerController::CREDIT], true) && array_key_exists((string) $type, LinePresenter::typeLabels()),
                fn (Builder $query) => $query->where('type', $type),
            )
            ->when($recordedBy, fn (Builder $query) => $query->where('recorded_by', $recordedBy))
            ->when(self::filterValue($request, 'payment_method'), fn (Builder $query, string $method) => $query->where('payment_method', $method))
            ->when(self::filterValue($request, 'bank_name'), fn (Builder $query, string $bank) => $query->where('bank_name', $bank))
            ->when(self::filterValue($request, 'show_cancelled') === '0', fn (Builder $query) => $query->counted());
    }

    /**
     * Newest first unless a column header asks otherwise; "amount" sorts by
     * the size of the line, whichever side it is on.
     *
     * @param  Builder<SubscriptionTransaction>  $query
     * @return Builder<SubscriptionTransaction>
     */
    public static function sortEntries(Builder $query, Request $request): Builder
    {
        $direction = $request->input('sort') !== null && $request->string('direction')->lower()->value() === 'asc' ? 'asc' : 'desc';

        return (self::sortedByAmount($request)
            ? $query->orderByRaw('abs(subscription_transactions.amount) '.$direction)
            : $query->orderBy('subscription_transactions.created_at', $direction))
            ->orderBy('subscription_transactions.id', $direction);
    }

    public static function sortedByAmount(Request $request): bool
    {
        return $request->input('sort') === 'amount';
    }

    /**
     * The headline figures for the period — total, count, average and
     * largest line — and the same total over as many days just before it.
     * `collected` is what was paid in the period, shown beside the charges.
     *
     * @param  Builder<SubscriptionTransaction>  $headline  the period's lines on the headline side
     * @param  Builder<SubscriptionTransaction>|null  $ledger  every line on that side, for the period before
     * @param  Builder<SubscriptionTransaction>  $inPeriod  every line of the period, both sides
     * @return array{total: string, count: int, average: string, largest: string, previousTotal: string|null, changePct: int|null, collected: string}
     */
    public static function summary(Builder $headline, ?Builder $ledger, ?CarbonImmutable $from, ?int $days, Builder $inPeriod, string $dateBasis = 'recorded'): array
    {
        $totals = $headline->toBase()->selectRaw('count(*) as entries, coalesce(sum(abs(amount)), 0) as total, coalesce(max(abs(amount)), 0) as largest')->first();
        $total = Money::amount($totals->total);
        $count = (int) $totals->entries;

        $previousTotal = $ledger && $from && $days
            ? Money::amount(self::dateFiltered($ledger, $from->subDays($days), $from, $dateBasis)
                ->toBase()
                ->selectRaw('coalesce(sum(abs(amount)), 0) as total')
                ->value('total'))
            : null;

        return [
            'total' => $total,
            'count' => $count,
            'average' => $count > 0 ? Money::amount(Money::decimal($total)->dividedBy($count, 2, RoundingMode::HalfUp)) : '0.00',
            'largest' => Money::amount($totals->largest),
            'previousTotal' => $previousTotal,
            'changePct' => $previousTotal !== null && ! Money::decimal($previousTotal)->isZero()
                ? Money::decimal($total)->minus($previousTotal)->multipliedBy('100')->dividedBy($previousTotal, 0, RoundingMode::HalfUp)->toInt()
                : null,
            'collected' => Money::negate($inPeriod->counted()->whereIn('type', [SubscriptionTransaction::TYPE_PAYMENT, SubscriptionTransaction::TYPE_BANK_AUDIT_ADJUSTMENT])->sum('amount')),
        ];
    }

    /**
     * Each listed day's full figures — however many of its lines this page
     * shows — for the headers that group the table by day: how many lines,
     * and the charges and the credits that day.
     *
     * @param  Builder<SubscriptionTransaction>  $inPeriod
     * @param  array<int, string>  $days
     * @return array<string, array{count: int, charged: string, credited: string}>
     */
    public static function dayTotals(Builder $inPeriod, array $days): array
    {
        if ($days === []) {
            return [];
        }

        $from = CarbonImmutable::parse(min($days), config('app.business_timezone'))->utc();
        $until = CarbonImmutable::parse(max($days), config('app.business_timezone'))->addDay()->utc();

        return $inPeriod
            ->counted()
            ->where('subscription_transactions.created_at', '>=', $from)
            ->where('subscription_transactions.created_at', '<', $until)
            ->toBase()
            ->get(['subscription_transactions.created_at as moment', 'amount', 'type'])
            ->groupBy(fn (object $line): string => DailySeries::localDate($line->moment))
            ->only($days)
            ->map(fn ($lines): array => [
                'count' => $lines->count(),
                'charged' => Money::sum($lines->reject(fn (object $line): bool => SubscriptionTransaction::isCreditLine($line->type, $line->amount))->pluck('amount')),
                'credited' => Money::negate(Money::sum($lines->filter(fn (object $line): bool => SubscriptionTransaction::isCreditLine($line->type, $line->amount))->pluck('amount'))),
            ])
            ->all();
    }

    /**
     * The period's headline total and line count per branch, largest first.
     *
     * @param  Builder<SubscriptionTransaction>  $headline
     * @return array<int, array{id: int, name: string, total: string, count: int}>
     */
    public static function branchTotals(Builder $headline): array
    {
        $totals = $headline
            ->join('subscriptions', 'subscriptions.id', '=', 'subscription_transactions.subscription_id')
            ->toBase()
            ->selectRaw('subscriptions.branch_id, sum(abs(subscription_transactions.amount)) as total, count(*) as entries')
            ->groupBy('subscriptions.branch_id')
            ->get();

        $names = Branch::query()->whereIn('id', $totals->pluck('branch_id'))->pluck('name', 'id');

        return $totals
            ->map(fn (object $branch): array => [
                'id' => (int) $branch->branch_id,
                'name' => $names[$branch->branch_id] ?? '—',
                'total' => Money::amount($branch->total),
                'count' => (int) $branch->entries,
            ])
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public static function dateFiltered(Builder $query, ?CarbonImmutable $from, CarbonImmutable $until, string $dateBasis): Builder
    {
        if ($dateBasis === 'recorded') {
            return $query->when($from, fn (Builder $lines) => $lines->where('subscription_transactions.created_at', '>=', $from))
                ->where('subscription_transactions.created_at', '<', $until);
        }

        return $query->where(function (Builder $dates) use ($from, $until): void {
            $dates->where(function (Builder $paid) use ($from, $until): void {
                $paid->whereNotNull('subscription_transactions.paid_on')
                    ->when($from, fn (Builder $lines) => $lines->where('subscription_transactions.paid_on', '>=', $from->setTimezone(config('app.business_timezone'))->toDateString()))
                    ->where('subscription_transactions.paid_on', '<', $until->setTimezone(config('app.business_timezone'))->toDateString());
            })->orWhere(function (Builder $recorded) use ($from, $until): void {
                $recorded->whereNull('subscription_transactions.paid_on')
                    ->when($from, fn (Builder $lines) => $lines->where('subscription_transactions.created_at', '>=', $from))
                    ->where('subscription_transactions.created_at', '<', $until);
            });
        });
    }

    public static function row(SubscriptionTransaction $transaction): array
    {
        return [
            'id' => $transaction->id,
            'day' => DailySeries::localDate($transaction->created_at),
            'time' => DailySeries::localTime($transaction->created_at),
            'paidOn' => $transaction->paid_on?->toDateString(),
            'bankReceivedOn' => $transaction->bank_received_on?->toDateString(),
            'lateReason' => $transaction->late_reason,
            'subscriptionId' => $transaction->subscription_id,
            'subscriptionName' => $transaction->subscription->displayName(),
            'subscriptionAccountNumber' => $transaction->subscription->account_number,
            'subscriptionPhone' => $transaction->subscription->contactPhone(),
            'subscriptionStatus' => $transaction->subscription->status->value,
            'subscriptionStatusLabel' => __($transaction->subscription->status->label()),
            'branchName' => $transaction->subscription->branch->name,
            'type' => $transaction->type,
            'typeLabel' => LinePresenter::typeLabel($transaction),
            'isCredit' => $transaction->isCredit(),
            // Listed, but left out of the totals.
            'isCancelled' => $transaction->isCancelled() || $transaction->isReversal(),
            'recordedByName' => $transaction->recordedBy?->name,
            'amount' => ltrim($transaction->amount, '-'),
            'voucherNumber' => LinePresenter::displayVoucherNumber($transaction),
            'isManualVoucher' => (bool) $transaction->manual_voucher_number,
            'paymentMethod' => $transaction->payment_method?->value,
            'paymentMethodLabel' => $transaction->payment_method ? __($transaction->payment_method->label()) : null,
            'bankName' => $transaction->bank_name,
            'referenceNumber' => $transaction->reference_number,
            'splitPayment' => $transaction->splitPayment?->badge(),
            'balanceAfter' => $transaction->balance_after,
            'currency' => $transaction->currency,
            'currencyAmount' => $transaction->currency_amount,
            'exchangeRate' => $transaction->exchange_rate,
        ];
    }

    /**
     * What the log covers, shown above its title: every branch, the branch
     * the Super Admin filtered on, or the user's own branch.
     */
    public static function scopeLabel(Request $request, User $actor): string
    {
        if (! $actor->hasFinancialAuditAccess()) {
            return $actor->workBranch()?->name ?? '—';
        }

        $branchId = self::filterValue($request, 'branch_id');

        return ($branchId ? $actor->scopeAuditBranches(Branch::query(), 'branches.id')->find($branchId)?->name : null) ?? ($actor->auditSettings()['scope'] === 'selected' ? __('Branches selected for audit') : __('All branches'));
    }

    /**
     * The filters: the branch (the Super Admin's only — everyone else's log
     * is their own branch), the type of line or a whole side, and who
     * recorded it.
     *
     * @return array<int, array{key: string, label: string, options: array<int, array{value: string, label: string}>}>
     */
    public static function filterOptions(User $actor): array
    {
        $groups = $actor->hasFinancialAuditAccess() ? [DataTableFilters::branchFilterGroup($actor)] : [];

        $groups[] = DataTableFilters::filterGroup('type', __('Entry type'), [
            ['value' => self::DEBIT, 'label' => __('Everything charged (debit)')],
            ['value' => LedgerController::CREDIT, 'label' => __('Everything credited (payments, discounts and clearings)')],
            ...collect(LinePresenter::typeLabels())->map(fn (string $label, string $type): array => ['value' => $type, 'label' => $label])->values(),
        ]);

        $groups[] = DataTableFilters::filterGroup('payment_method', __('Payment method'), collect(PaymentMethod::cases())
            ->map(fn (PaymentMethod $method): array => ['value' => $method->value, 'label' => __($method->label())])->all());

        $groups[] = DataTableFilters::filterGroup('bank_name', __('Bank'), SubscriptionTransaction::query()
            ->whereHas('subscription', fn (Builder $subscriptions) => $subscriptions->readableTo($actor, true))
            ->whereNotNull('bank_name')->where('bank_name', '!=', '')
            ->distinct()->orderBy('bank_name')->pluck('bank_name')
            ->map(fn (string $bank): array => ['value' => $bank, 'label' => $bank])->all());

        $groups[] = DataTableFilters::filterGroup('recorded_by', __('Recorded by'), DataTableFilters::staffOptions(
            User::query()
                ->whereIn('id', SubscriptionTransaction::query()
                    ->whereHas('subscription', fn (Builder $subscriptions) => $subscriptions->readableTo($actor, true))
                    ->select('recorded_by'))
                ->orderBy('name')
                ->get(),
        ));

        return $groups;
    }

    /**
     * Which side the headline figures sum: the credits when the type filter
     * picks payments, discounts, clearings or everything له; otherwise the charges.
     */
    public static function headlineSide(Request $request): string
    {
        $type = self::filterValue($request, 'type');

        return $type === LedgerController::CREDIT || in_array($type, SubscriptionTransaction::CREDIT_TYPES, true) ? LedgerController::CREDIT : self::DEBIT;
    }

    public static function period(Request $request): string
    {
        $period = $request->query('period');

        return is_string($period) && array_key_exists($period, self::PERIODS) ? $period : self::DEFAULT_PERIOD;
    }

    /**
     * @return array{CarbonImmutable|null, CarbonImmutable, int|null}
     */
    public static function dateWindow(ViewLedgerRequest $request, string $period): array
    {
        $today = DailySeries::today();
        $until = $today->addDay();
        $days = self::PERIODS[$period];
        $from = $days ? $today->subDays($days - 1) : null;

        if ($period === 'yesterday') {
            $from = $today->subDay();
            $until = $today;
        } elseif ($period === 'month') {
            $from = $today->startOfMonth();
            $days = $today->day;
        } elseif ($period === 'custom') {
            $dates = $request->validated();
            $from = CarbonImmutable::parse($dates['from'], config('app.business_timezone'))->startOfDay();
            $until = CarbonImmutable::parse($dates['to'], config('app.business_timezone'))->startOfDay()->addDay();
            $days = (int) CarbonImmutable::parse($dates['from'], 'UTC')->diffInDays(CarbonImmutable::parse($dates['to'], 'UTC')) + 1;
        }

        return [$from?->utc(), $until->utc(), $days];
    }

    /**
     * @param  Builder<SubscriptionTransaction>  $query
     * @return array{charged: string, debitCount: int, credited: string, creditCount: int, net: string, cancelled: string, cancelledCount: int}
     */
    public static function ledgerTotals(Builder $query): array
    {
        $aggregate = fn (Builder $lines): object => $lines->toBase()->selectRaw('count(*) as entries, coalesce(sum(abs(amount)), 0) as total')->first();
        $debits = $aggregate((clone $query)->charges());
        $credits = $aggregate((clone $query)->credits());
        $cancelled = $aggregate((clone $query)->whereNotNull('cancelled_at')->whereNull('reverses_id'));
        $charged = Money::amount($debits->total);
        $credited = Money::amount($credits->total);

        return [
            'charged' => $charged, 'debitCount' => (int) $debits->entries,
            'credited' => $credited, 'creditCount' => (int) $credits->entries,
            'net' => Money::subtract($charged, $credited),
            'cancelled' => Money::amount($cancelled->total), 'cancelledCount' => (int) $cancelled->entries,
        ];
    }

    /**
     * What the listed subscribers owed when the period began: the same
     * filters' charges less their credits before its start, nothing when the
     * period has no start. The period's closing balance is this plus its net.
     *
     * @param  Builder<SubscriptionTransaction>  $ledger
     */
    public static function openingBalance(Builder $ledger, ?CarbonImmutable $from, string $dateBasis): string
    {
        return $from ? self::ledgerTotals(self::dateFiltered($ledger, null, $from, $dateBasis))['net'] : '0.00';
    }

    /**
     * The net of the lines listed on the pages before this one, newest
     * first, so the page can carry the running balance on from the closing
     * balance. Null when the list is not in that order, where a running
     * balance would mean nothing.
     *
     * @param  Builder<SubscriptionTransaction>  $sorted  the period's lines in the list's order
     */
    public static function newerNet(Builder $sorted, Request $request, int $offset, string $dateBasis): ?string
    {
        if ($dateBasis !== 'recorded' || self::sortedByAmount($request) || ($request->input('sort') !== null && $request->string('direction')->lower()->value() === 'asc')) {
            return null;
        }

        return $offset > 0
            ? self::ledgerTotals(SubscriptionTransaction::query()->whereIn('id', (clone $sorted)->limit($offset)->pluck('subscription_transactions.id')))['net']
            : '0.00';
    }

    /**
     * @param  Builder<SubscriptionTransaction>  $lines
     */
    public static function export(Builder $lines): StreamedResponse
    {
        return response()->streamDownload(function () use ($lines): void {
            $file = fopen('php://output', 'w');
            fwrite($file, "\xEF\xBB\xBF");
            fputcsv($file, [__('Date'), __('Time'), __('Subscriber'), __('Account'), __('Branch'), __('Type'), __('Voucher'), __('Method'), __('Bank'), __('Reference'), __('Recorded by'), __('Debit'), __('Credit'), __('Balance after'), __('Balance status'), __('Cancelled'), __('Actual payment date'), __('Reason for late recording'), __('Date the transfer reached the bank')]);

            foreach ($lines->lazy(500) as $transaction) {
                $row = self::row($transaction);
                $cells = [$row['day'], $row['time'], $row['subscriptionName'], $row['subscriptionAccountNumber'], $row['branchName'], $row['typeLabel'], $row['voucherNumber'], $row['paymentMethodLabel'], $row['bankName'], $row['referenceNumber'], $row['recordedByName'], $row['isCredit'] ? '' : Money::amount($row['amount']), $row['isCredit'] ? Money::amount($row['amount']) : '', $row['balanceAfter'] === null ? '' : Money::amount($row['balanceAfter']), self::balanceWord($row['balanceAfter']), $row['isCancelled'] ? __('Yes') : __('No')];
                $cells[] = $row['paidOn'];
                $cells[] = $row['lateReason'];
                $cells[] = $row['bankReceivedOn'];
                fputcsv($file, array_map(fn ($cell) => is_string($cell) && ! is_numeric($cell) && preg_match('/^[=+@\-\t\r]/u', $cell) ? "'".$cell : $cell, $cells));
            }

            fclose($file);
        }, 'ledger-'.DailySeries::today()->toDateString().'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * What a balance is called on paper beside its signed number: owed
     * (عليه), credit (له) or settled (مسدّد); nothing when there is none.
     */
    public static function balanceWord(int|float|string|null $balance): string
    {
        if ($balance === null) {
            return '';
        }

        $cents = Money::decimal($balance)->multipliedBy('100')->toInt();

        return $cents > 0 ? __('Debit') : ($cents < 0 ? __('Credit') : __('Settled'));
    }

    /**
     * One `?filter[key]=` value, or null when it is missing, empty or not
     * plain text.
     */
    public static function filterValue(Request $request, string $key): ?string
    {
        $value = $request->input("filter.{$key}");

        return is_scalar($value) && (string) $value !== '' ? (string) $value : null;
    }
}
