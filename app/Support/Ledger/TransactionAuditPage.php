<?php

namespace App\Support\Ledger;

use App\Http\Controllers\TransactionAuditController;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\TransactionAmendment;
use App\Models\TransactionDeletion;
use App\Models\User;
use App\Support\Queries\DataTableFilters;
use App\Support\Reports\DailySeries;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Builds the transaction audit log: amendments, deletions and reversals as events, filtered and summarised.
 */
class TransactionAuditPage
{
    public const DEFAULT_PERIOD = '30';

    /**
     * Every change as one list — `kind`, `event_id` (the row of its own
     * table), `happened_at`, `user_id` (who made it) and `subscription_id` —
     * of subscriptions the user may see, narrowed by the search box, the
     * branch and who made it. Unordered, so it can be counted.
     */
    public static function filteredEvents(Request $request, User $actor): QueryBuilder
    {
        $search = DataTableFilters::searchTerm($request);
        $branchId = $actor->hasFinancialAuditAccess() ? self::filterValue($request, 'branch_id') : null;
        $userId = self::filterValue($request, 'user_id');
        $narrowsSubscriptions = ($actor->hasFinancialAuditAccess() && $actor->auditSettings()['scope'] === 'selected') || ! $actor->hasFinancialAuditAccess() || $branchId !== null || $search !== '';

        $amendments = DB::table('transaction_amendments')
            ->join('subscription_transactions', 'subscription_transactions.id', '=', 'transaction_amendments.transaction_id')
            ->selectRaw("'amendment' as kind, transaction_amendments.id as event_id, transaction_amendments.created_at as happened_at, transaction_amendments.user_id as user_id, subscription_transactions.subscription_id as subscription_id");

        $reversals = DB::table('subscription_transactions as reversal')
            ->whereIn('reversal.type', SubscriptionTransaction::REVERSAL_TYPES)
            ->selectRaw(
                "case when reversal.type = ? then 'refund' "
                ."when reversal.type = ? and exists (select 1 from subscription_transactions as replacement where replacement.corrects_id = reversal.reverses_id) then 'correction' "
                ."else 'cancellation' end as kind, reversal.id as event_id, reversal.created_at as happened_at, reversal.recorded_by as user_id, reversal.subscription_id as subscription_id",
                [SubscriptionTransaction::TYPE_REFUND, SubscriptionTransaction::TYPE_REVERSAL],
            );

        $deletions = DB::table('transaction_deletions')
            ->selectRaw("'deletion' as kind, id as event_id, created_at as happened_at, user_id, subscription_id");

        return DB::query()
            ->fromSub($amendments->unionAll($reversals)->unionAll($deletions), 'events')
            ->when($narrowsSubscriptions, fn (QueryBuilder $query) => $query->whereIn('subscription_id', Subscription::query()
                ->readableTo($actor, true)
                ->when($branchId, fn (Builder $subscriptions) => $subscriptions->where('branch_id', $branchId))
                ->when($search !== '', fn (Builder $subscriptions) => $subscriptions->matchingSearch($search))
                ->select('subscriptions.id')))
            ->when($userId, fn (QueryBuilder $query) => $query->where('user_id', $userId));
    }

    /**
     * How many changes of each kind the period holds.
     *
     * @return array<string, int>
     */
    public static function counts(QueryBuilder $inPeriod): array
    {
        $counts = $inPeriod->selectRaw('kind, count(*) as total')->groupBy('kind')->pluck('total', 'kind');

        return collect(TransactionAuditController::KINDS)->map(fn (string $label, string $kind): int => (int) ($counts[$kind] ?? 0))->all();
    }

    /**
     * The page's changes, each with what the log shows of it.
     *
     * @param  Collection<int, object{kind: string, event_id: int}>  $events
     * @return Collection<int, array<string, mixed>>
     */
    public static function rows(Collection $events): Collection
    {
        $ids = fn (array $kinds): array => $events->whereIn('kind', $kinds)->pluck('event_id')->all();
        $amendments = TransactionAmendment::query()->with(['user', 'transaction.subscription.branch'])->findMany($ids(['amendment']))->keyBy('id');
        $reversals = SubscriptionTransaction::query()
            ->with(['recordedBy', 'subscription.branch', 'reverses.correction'])
            ->findMany($ids(['cancellation', 'correction', 'refund']))
            ->keyBy('id');
        $deletions = TransactionDeletion::query()->with(['user', 'subscription.branch'])->findMany($ids(['deletion']))->keyBy('id');

        return $events
            ->map(fn (object $event): ?array => match ($event->kind) {
                'amendment' => $amendments->has($event->event_id) ? self::amendmentRow($amendments[$event->event_id]) : null,
                'deletion' => $deletions->has($event->event_id) ? self::deletionRow($deletions[$event->event_id]) : null,
                default => $reversals->has($event->event_id) ? self::reversalRow($event->kind, $reversals[$event->event_id]) : null,
            })
            ->filter()
            ->values();
    }

    /**
     * @return array<string, mixed>
     */
    public static function amendmentRow(TransactionAmendment $amendment): array
    {
        $line = $amendment->transaction;

        return [
            ...self::eventBase('amendment', $amendment->id, $amendment->created_at, $amendment->user, $line->subscription),
            'lines' => [self::lineSummary($line->type, $line->amount, LinePresenter::displayVoucherNumber($line))],
            'changes' => collect($amendment->changes)->map(fn (array $values, string $field): array => [
                'label' => StatementBuilder::amendmentFieldLabel($field),
                'from' => $values[0] ?? null,
                'to' => $values[1] ?? null,
            ])->values()->all(),
            'reason' => $amendment->reason,
            'notes' => null,
        ];
    }

    /**
     * A cancellation, a correction or a refund: the reversal line it
     * added, and why from the line it reverses.
     *
     * @return array<string, mixed>
     */
    public static function reversalRow(string $kind, SubscriptionTransaction $reversal): array
    {
        $original = $reversal->reverses;
        $isFullRefund = $kind === 'refund' && $original?->status === SubscriptionTransaction::STATUS_LINKED_CANCELLATION;

        return [
            ...self::eventBase($kind, $reversal->id, $reversal->created_at, $reversal->recordedBy, $reversal->subscription),
            'kindNote' => $kind === 'refund' ? ($isFullRefund ? __('Full') : __('Partial')) : null,
            'lines' => [
                $original
                    ? self::lineSummary($original->type, $original->amount, LinePresenter::displayVoucherNumber($original))
                    : self::lineSummary($reversal->type, $reversal->amount, null),
                ...($kind === 'refund' ? [['label' => __('Amount refunded'), 'amount' => LedgerAmounts::formatAmount(abs((float) $reversal->amount)), 'voucherNumber' => null]] : []),
            ],
            'changes' => [],
            // A partial refund leaves the payment standing, without a reason of its own.
            'reason' => $original?->cancellation_reason && ($kind !== 'refund' || $isFullRefund) ? __($original->cancellation_reason->label()) : null,
            'notes' => $kind !== 'refund' || $isFullRefund ? $original?->cancellation_notes : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function deletionRow(TransactionDeletion $deletion): array
    {
        return [
            ...self::eventBase('deletion', $deletion->id, $deletion->created_at, $deletion->user, $deletion->subscription),
            // Deletions recorded before these two actions were retired keep their note.
            'kindNote' => match ($deletion->action) {
                'delete_reversal' => __('Only the cancellation; the original transaction came back'),
                'delete_tree' => __('The transaction and everything linked to it'),
                default => null,
            },
            'lines' => collect($deletion->transactions)
                ->map(fn (array $line): array => self::lineSummary(
                    (string) ($line['type'] ?? ''),
                    (string) ($line['amount'] ?? '0'),
                    filled($line['manual_voucher_number'] ?? null)
                        ? $line['manual_voucher_number']
                        : (filled($line['voucher_number'] ?? null) ? str_pad((string) $line['voucher_number'], 6, '0', STR_PAD_LEFT) : null),
                ))
                ->all(),
            'changes' => [],
            'reason' => $deletion->reason,
            'notes' => null,
        ];
    }

    /**
     * What every row shows: its kind, when (business time), who made the
     * change, and whose account it was on.
     *
     * @return array<string, mixed>
     */
    public static function eventBase(string $kind, int $id, mixed $at, ?User $user, ?Subscription $subscription): array
    {
        return [
            'key' => $kind.'-'.$id,
            'kind' => $kind,
            'kindLabel' => TransactionAuditController::KINDS[$kind],
            'kindNote' => null,
            'day' => DailySeries::localDate($at),
            'time' => DailySeries::localTime($at),
            'userName' => $user?->name,
            'subscription' => $subscription ? [
                'id' => $subscription->id,
                'name' => $subscription->displayName(),
                'accountNumber' => $subscription->account_number,
                'status' => $subscription->status->value,
                'statusLabel' => __($subscription->status->label()),
                'branchName' => $subscription->branch->name,
            ] : null,
        ];
    }

    /**
     * A line as the log names it: its type, its amount in shekels and its
     * voucher, if any.
     *
     * @return array{label: string, amount: string, voucherNumber: ?string}
     */
    public static function lineSummary(string $type, string $amount, ?string $voucherNumber): array
    {
        return [
            'label' => LinePresenter::typeLabels()[$type] ?? __('Transaction'),
            'amount' => LedgerAmounts::formatAmount(abs((float) $amount)),
            'voucherNumber' => $voucherNumber,
        ];
    }

    /**
     * The filters: the branch (the Super Admin's only — everyone else's
     * log is their own branch), the kind of change, and who made it.
     *
     * @return array<int, array{key: string, label: string, options: array<int, array{value: string, label: string}>}>
     */
    public static function filterOptions(User $actor): array
    {
        $groups = $actor->hasFinancialAuditAccess() ? [DataTableFilters::branchFilterGroup($actor)] : [];

        $groups[] = DataTableFilters::filterGroup('kind', __('Action'), collect(TransactionAuditController::KINDS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values());
        $groups[] = DataTableFilters::filterGroup('user_id', __('By'), DataTableFilters::staffOptions(
            User::query()
                ->when($actor->hasFinancialAuditAccess() && $actor->auditSettings()['scope'] === 'selected', fn (Builder $users) => $users->whereIn('id', self::filteredEvents(new Request, $actor)->select('user_id')))
                // Branch staff see their branch's staff and the Super Admins, who have no branch.
                ->when(! $actor->hasFinancialAuditAccess(), fn (Builder $users) => $users->where(fn (Builder $inBranch) => $inBranch
                    ->where('branch_id', $actor->workBranchId())
                    ->orWhereNull('branch_id')))
                ->orderBy('name')
                ->get(),
        ));

        return $groups;
    }

    public static function period(Request $request): string
    {
        $period = $request->query('period');

        return is_string($period) && array_key_exists($period, TransactionAuditController::PERIODS) ? $period : self::DEFAULT_PERIOD;
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
