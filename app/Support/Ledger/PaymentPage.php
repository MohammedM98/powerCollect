<?php

namespace App\Support\Ledger;

use App\Enums\CashBoxType;
use App\Enums\PaymentMethod;
use App\Enums\SubscriptionStatus;
use App\Http\Controllers\PaymentController;
use App\Models\AuditNote;
use App\Models\CashBox;
use App\Models\CashBoxPayment;
use App\Models\CollectorDebt;
use App\Models\MeterBox;
use App\Models\SubArea;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\Tariff;
use App\Models\User;
use App\Support\Closing\BranchClosingWorkflow;
use App\Support\Closing\CashBoxPresenter;
use App\Support\Closing\ClosingPeriods;
use App\Support\Queries\DataTableFilters;
use App\Support\Queries\SubscriptionListQuery;
use App\Support\Reports\DailySeries;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Builds the payments page and the collector's own boxes view.
 */
class PaymentPage
{
    /** The columns the subscribers table may be sorted by. */
    public const SORTABLE = ['account_number', 'display_name', 'status', 'outstanding_balance'];

    /**
     * The "Balance" filter: what a subscriber owes, against the sum of their
     * account's lines (positive is what they owe).
     */
    public const BALANCE_FILTERS = ['owing' => ['>', 'Has a balance owed'], 'settled' => ['=', 'Settled'], 'credit' => ['<', 'Has a credit balance']];

    /** The payments listed under the day's totals. */
    public const RECENT_PAYMENTS = 8;

    /**
     * The entries of the actor's own open boxes in their branch.
     *
     * @return Builder<CashBoxPayment>
     */
    public static function ownOpenEntries(User $actor): Builder
    {
        return CashBoxPayment::query()->whereHas('box', fn (Builder $box) => $box->where('branch_id', $actor->workBranchId())->where('user_id', $actor->id)->whereIn('status', ['open', 'pending']));
    }

    /**
     * The actor's boxes, with what waits on them: received cash boxes to
     * confirm, audit notes to answer, and the shortfalls they still owe.
     *
     * @return array{started: bool, branchName: ?string, boxes: array<int, array<string, mixed>>, current: array<string, array<string, mixed>|null>, needsAction: array<int, array<string, mixed>>, auditNotes: array<int, array<string, mixed>>, debts: array<int, array<string, mixed>>}
     */
    public static function ownCashBoxes(User $actor, bool $includeRecentHistory = true): array
    {
        if (! CashBoxPresenter::boxesStarted($actor)) {
            return ['started' => false, 'branchName' => $actor->workBranch()?->name, 'boxes' => [], 'current' => [], 'needsAction' => [], 'auditNotes' => [], 'debts' => []];
        }

        app(BranchClosingWorkflow::class)->refresh($actor->workBranchId());
        $query = CashBoxPresenter::ownBoxQuery($actor);
        $outstanding = (clone $query)->whereNull('confirmed_at')->get();
        $history = $includeRecentHistory ? (clone $query)->whereNotNull('confirmed_at')->limit(10)->get() : collect();
        $rows = $outstanding->concat($history)->map(fn (CashBox $box): array => CashBoxPresenter::cashBoxRow($box));

        return [
            'started' => true,
            'branchName' => $actor->workBranch()?->name,
            'boxes' => $rows->values()->all(),
            'current' => collect(CashBoxType::cases())->mapWithKeys(fn (CashBoxType $type): array => [$type->value => $rows->first(fn (array $box): bool => $box['type'] === $type->value && $box['status'] === 'open')])->all(),
            'needsAction' => $rows->filter(fn (array $box): bool => $box['stage'] === 'awaiting_confirmation')->values()->all(),
            'auditNotes' => CashBoxPresenter::waitingAuditNotes($actor)->with(['box:id,number', 'closing:id,coverage_from,coverage_until,workflow_settings', 'entry.transaction.subscription:id,full_name,subscription_name,account_number', 'replies' => fn ($query) => $query->where('kind', 'collector')->latest('id')])
                ->latest('id')->get()->map(fn (AuditNote $note): array => [
                    'id' => $note->id,
                    'body' => $note->body,
                    'question' => $note->replies->first()?->body,
                    'differences' => $note->differences,
                    'closing' => $note->closing->only(['coverage_from', 'coverage_until', 'workflow_settings']),
                    'entry' => $note->entry?->transaction ? [
                        'subscriber' => $note->entry->transaction->subscription->displayName(),
                        'voucherNumber' => LinePresenter::displayVoucherNumber($note->entry->transaction),
                        'typeLabel' => LinePresenter::typeLabel($note->entry->transaction),
                        'amount' => $note->entry->amount, 'currency' => $note->entry->currency,
                    ] : null,
                    'box' => $note->box ? ['number' => $note->box->number, 'url' => route('payments.cash-boxes.show', $note->box)] : null,
                    'replyUrl' => route('payments.audit-notes.reply', $note),
                ])->all(),
            'debts' => CollectorDebt::query()->where('user_id', $actor->id)->where('branch_id', $actor->workBranchId())->where('remaining', '>', 0)
                ->with('box:id,number')->oldest('id')->get()->map(fn (CollectorDebt $debt): array => [
                    'id' => $debt->id,
                    'currency' => $debt->currency,
                    'amount' => $debt->amount,
                    'remaining' => $debt->remaining,
                    'createdAt' => $debt->created_at,
                    'box' => $debt->box ? ['number' => $debt->box->number, 'url' => route('payments.cash-boxes.show', $debt->box)] : null,
                ])->all(),
        ];
    }

    /**
     * The table's search, filters and sort. The search finds a name, account
     * or old number, phone or meter box number; the balance filter sorts
     * those who owe from those settled or in credit.
     *
     * @param  Builder<Subscription>  $query
     */
    public static function applyTableFilters(Builder $query, Request $request): void
    {
        $search = DataTableFilters::searchTerm($request);

        if ($search !== '') {
            self::applySearch($query, $search);
        }

        DataTableFilters::applyDataTableFilters($query, $request, [], self::SORTABLE, 'display_name');
        DataTableFilters::applyDataTableFilterSelects($query, $request, ['status', 'branch_id', 'tariff_id', 'meter_box_id']);
        DataTableFilters::applyMeterBoxNameFilter($query, $request);
        SubscriptionListQuery::applySubAreaFilter($query, $request);

        $balance = self::BALANCE_FILTERS[(string) self::filterValue($request, 'balance')] ?? null;

        if ($balance !== null) {
            $query->whereRaw('(select coalesce(sum(amount), 0) from subscription_transactions where subscription_transactions.subscription_id = subscriptions.id) '.$balance[0].' 0');
        }
    }

    /**
     * The Filter menu's dropdowns: what they owe, status, subscription type,
     * منطقة 2 and meter box — and the branch, for the Super Admin.
     *
     * @return array<int, array{key: string, label: string, options: array<int, array<string, mixed>>}>
     */
    public static function filterOptions(User $actor, Request $request): array
    {
        $groups = [
            DataTableFilters::filterGroup('balance', __('Balance'), collect(self::BALANCE_FILTERS)->map(fn (array $filter, string $value): array => ['value' => $value, 'label' => __($filter[1])])),
            DataTableFilters::filterGroup('status', __('Status'), SubscriptionStatus::options()),
            DataTableFilters::filterGroup('tariff_id', 'Subscription type', DataTableFilters::modelOptions(Tariff::orderBy('category')->get(), fn (Tariff $tariff): string => __($tariff->category->label()))),
            DataTableFilters::subAreaFilterGroup(SubArea::query()->visibleTo($actor)->orderBy('name')->get()),
            ...DataTableFilters::meterBoxFilterGroupsFor($actor, $request, $actor->isSuperAdmin() ? fn (MeterBox $box): string => $box->branch->name : null),
        ];

        if ($actor->isSuperAdmin()) {
            $groups[] = DataTableFilters::branchFilterGroup();
        }

        return $groups;
    }

    /**
     * The subscriptions of the user's branch (any branch for the Super Admin)
     * whose name, account name, account or old number or meter box number
     * match every word of the search, or whose phone contains its digits.
     *
     * @return Collection<int, Subscription>
     */
    public static function matching(User $actor, string $search): Collection
    {
        return self::applySearch(Subscription::query()
            ->visibleTo($actor)
            ->with(['branch', 'meterBox', 'circuitBreaker', 'profile'])
            ->withSum('transactions as outstanding_balance', 'amount'), $search)
            ->orderBy('full_name')
            ->limit(PaymentController::RESULT_LIMIT + 1)
            ->get();
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

    /**
     * Keep the subscriptions whose name, account name, account or old number
     * or meter box number match every word of the search, or whose phone
     * contains its digits.
     *
     * @param  Builder<Subscription>  $query
     * @return Builder<Subscription>
     */
    public static function applySearch(Builder $query, string $search): Builder
    {
        $digits = preg_replace('/\D/', '', $search);

        return $query->where(function (Builder $matching) use ($search, $digits): void {
            $matching->matchingSearch($search);

            if (strlen($digits) >= 3) {
                $matching->orWhere('phone', 'like', '%'.$digits.'%')->orWhere('subscription_phone', 'like', '%'.$digits.'%');
            }
        });
    }

    /**
     * One search result: who, where, and what they owe, in the shape the
     * payment form reads.
     *
     * @return array<string, mixed>
     */
    public static function row(Subscription $subscription): array
    {
        return [
            'id' => $subscription->id,
            'fullName' => $subscription->displayName(),
            'accountNumber' => $subscription->account_number,
            'subscriberNumber' => $subscription->profile?->subscriber_number,
            'phone' => $subscription->contactPhone(),
            'meterBoxNumber' => $subscription->meterBox?->box_number,
            'meterBoxName' => $subscription->meterBox?->displayName(),
            'subAreaId' => $subscription->meterBox?->sub_area_id,
            'subAreaName' => $subscription->meterBox?->subArea?->name,
            'branchName' => $subscription->branch->name,
            'status' => $subscription->status->value,
            'statusLabel' => __($subscription->status->label()),
            'balance' => number_format((float) ($subscription->outstanding_balance ?? 0), 2, '.', ''),
            'weeklyMinimumPayment' => $subscription->weeklyMinimumPayment(),
        ];
    }

    /**
     * What the user has collected in the current business day: the totals
     * (cancelled payments left out), and their latest payments.
     *
     * @return array{count: int, total: string, cash: string, transfers: string, payments: array<int, array<string, mixed>>}
     */
    public static function todaysPayments(User $actor): array
    {
        $periods = ClosingPeriods::for($actor->workBranchId());
        $day = $periods->dayOf(now());
        [$from, $until] = $periods->utcRange($day, $day);

        $payments = SubscriptionTransaction::query()
            ->where('type', SubscriptionTransaction::TYPE_PAYMENT)
            ->whereNull('cancelled_at')
            ->where('recorded_by', $actor->id)
            ->where('created_at', '>=', $from)
            ->where('created_at', '<', $until)
            ->with('subscription')
            ->latest('id')
            ->get();

        $sumOf = fn (Collection $lines): string => number_format($lines->sum(fn (SubscriptionTransaction $payment): float => -(float) $payment->amount), 2, '.', '');
        $cash = $payments->filter(fn (SubscriptionTransaction $payment): bool => $payment->payment_method === PaymentMethod::Cash);

        return [
            'count' => $payments->count(),
            'total' => $sumOf($payments),
            'cash' => $sumOf($cash),
            'transfers' => $sumOf($payments->reject(fn (SubscriptionTransaction $payment): bool => $payment->payment_method === PaymentMethod::Cash)),
            'payments' => $payments->take(self::RECENT_PAYMENTS)->map(fn (SubscriptionTransaction $payment): array => [
                'id' => $payment->id,
                'subscriptionName' => $payment->subscription->displayName(),
                'amount' => LedgerAmounts::formatAmount(ltrim($payment->amount, '-')),
                'methodLabel' => $payment->payment_method ? __($payment->payment_method->label()) : null,
                'bankName' => $payment->bank_name,
                'voucherNumber' => LinePresenter::displayVoucherNumber($payment),
                'time' => DailySeries::localTime($payment->created_at),
                'receiptUrl' => route('subscriptions.payments.receipt', [$payment->subscription, $payment]),
            ])->values()->all(),
        ];
    }
}
