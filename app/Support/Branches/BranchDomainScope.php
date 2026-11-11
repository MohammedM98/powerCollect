<?php

namespace App\Support\Branches;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Validation\ValidationException;

class BranchDomainScope implements Scope
{
    /** @var list<string> */
    private const DIRECT = [
        'Subscription', 'MeterBox', 'MeterReading', 'ReadingCycle', 'ReadingAssignment',
        'DisconnectionList', 'DisconnectionListItem', 'SubscriptionMessage', 'CashBox', 'Closing',
        'CashTransfer', 'CashBoxSync', 'MessageBatch', 'SubscriptionBulkChange', 'SubscriberProfileChange', 'CompanyDocument',
    ];

    /** @var array<string, array{string, string}> */
    private const PARENTS = [
        'SubscriptionTransaction' => ['subscription_id', 'Subscription'],
        'TransactionDeletion' => ['subscription_id', 'Subscription'],
        'TransactionAmendment' => ['transaction_id', 'SubscriptionTransaction'],
        'SubscriptionArchiveEvent' => ['subscription_id', 'Subscription'],
        'MeterReadingAdjustment' => ['meter_reading_id', 'MeterReading'],
        'StandingDiscount' => ['subscription_id', 'Subscription'],
        'SubscriptionBulkChangeItem' => ['subscription_id', 'Subscription'],
        'ReadingSubmission' => ['reading_cycle_id', 'ReadingCycle'],
        'ReadingAssignmentEvent' => ['reading_assignment_id', 'ReadingAssignment'],
        'PaperSheet' => ['reading_cycle_id', 'ReadingCycle'],
        'CashBoxPayment' => ['cash_box_id', 'CashBox'],
        'CashBoxAudit' => ['cash_box_id', 'CashBox'],
        'BankTransferAudit' => ['cash_box_payment_id', 'CashBoxPayment'],
        'AuditNote' => ['closing_id', 'Closing'],
        'AuditNoteReply' => ['audit_note_id', 'AuditNote'],
        'ClosingPayment' => ['closing_id', 'Closing'],
        'ClosingEvent' => ['closing_id', 'Closing'],
        'CollectorDebt' => ['cash_box_id', 'CashBox'],
        'DisconnectionEvent' => ['disconnection_list_item_id', 'DisconnectionListItem'],
    ];

    public static function register(): void
    {
        foreach ([...self::DIRECT, ...array_keys(self::PARENTS), 'Branch', 'User', 'SplitPayment'] as $name) {
            $class = 'App\\Models\\'.$name;
            $class::addGlobalScope(new self);
            if (in_array($name, ['Branch', 'User', 'SplitPayment'], true)) {
                continue;
            }
            $class::saving(function (Model $model): void {
                $branchId = BranchDomainContext::id();
                if ($branchId === null) {
                    return;
                }
                $name = class_basename($model);
                $valid = in_array($name, self::DIRECT, true)
                    ? (int) $model->getAttribute('branch_id') === $branchId
                    : self::parentQuery($name)->whereKey($model->getAttribute(self::PARENTS[$name][0]))->exists();
                if (! $valid) {
                    throw ValidationException::withMessages(['branch_id' => 'لا يمكن حفظ بيانات تخص فرعًا آخر من هذا الرابط.']);
                }
            });
        }
    }

    /** The selected view narrows reads; domain boundaries still apply to every request. */
    public function apply(Builder $builder, Model $model): void
    {
        $branchId = BranchDomainContext::id() ?? (request()->isMethodSafe() ? BranchViewContext::id() : null);
        if ($branchId === null) {
            return;
        }
        $name = class_basename($model);
        if ($name === 'Branch') {
            $builder->whereKey($branchId);
        } elseif ($name === 'User') {
            $builder->where(fn (Builder $users) => $users->where($model->qualifyColumn('branch_id'), $branchId)
                ->orWhere($model->qualifyColumn('id'), request()->user()?->id));
        } elseif ($name === 'SplitPayment') {
            $builder->whereHas('payments');
        } elseif (isset(self::PARENTS[$name])) {
            $builder->whereIn($model->qualifyColumn(self::PARENTS[$name][0]), self::parentQuery($name)->select('id'));
        } else {
            $builder->where($model->qualifyColumn('branch_id'), $branchId);
        }
    }

    /**
     * Adds `acrossBranches()` to every query on a scoped model: the one way
     * to read past the branch host or the selected branch view. Use it only
     * for reads that must see every branch by design (company-wide unique
     * numbers, a split payment's parts in several branches, the signed-in
     * user's own row, the list of branches to choose from), and say why
     * where it is called. A test keeps the raw `withoutGlobalScope` call
     * out of the rest of the application.
     */
    public function extend(Builder $builder): void
    {
        $builder->macro('acrossBranches', fn (Builder $builder): Builder => $builder->withoutGlobalScope(self::class));
    }

    private static function parentQuery(string $name): Builder
    {
        $class = 'App\\Models\\'.self::PARENTS[$name][1];

        return $class::query();
    }
}
