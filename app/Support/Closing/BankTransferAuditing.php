<?php

namespace App\Support\Closing;

use App\Enums\AuditAction;
use App\Enums\CashBoxType;
use App\Models\BankTransferAudit;
use App\Models\CashBox;
use App\Models\CashBoxAudit;
use App\Models\CashBoxPayment;
use App\Models\Closing;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Ledger\Money;
use Illuminate\Database\Eloquent\Builder;

class BankTransferAuditing
{
    use RefusesClosingActions;

    public function __construct(private BranchBoxes $boxes, private SplitTransferAuditing $splits) {}

    public static function allowed(User $actor, AuditAction $action = AuditAction::ReviewTransfers): bool
    {
        return $actor->is_active && $actor->canAuditAction($action);
    }

    /** @param list<array{transaction_id: int, bank_amount: string|int|float}> $parts */
    public function record(CashBoxPayment $entry, User $actor, string $bankAmount, ?string $reason, array $parts = [], ?string $revision = null): BankTransferAudit
    {
        abort_unless(self::allowed($actor), 403);
        abort_unless($actor->auditIncludesBranch($entry->box->branch_id), 404);

        if ($entry->transaction->split_payment_id !== null) {
            $this->require($entry->transaction->isPayment() && ! $entry->transaction->isCancelled(), __('A cancelled or non-financial transaction cannot be audited.'));

            return $this->splits->record($entry, $actor, $bankAmount, $reason, $parts, $revision, $this->recordSingle(...));
        }

        return $this->recordSingle($entry, $actor, $bankAmount, $reason);
    }

    /** @return array<string, mixed>|null */
    public function details(CashBoxPayment $entry, User $actor): ?array
    {
        abort_unless(self::allowed($actor), 403);
        abort_unless($actor->auditIncludesBranch($entry->box->branch_id), 404);

        return $entry->transaction->split_payment_id === null ? null : $this->splits->details($entry, $actor);
    }

    private function recordSingle(CashBoxPayment $entry, User $actor, string $bankAmount, ?string $reason): BankTransferAudit
    {
        return BranchLock::run($entry->box->branch_id, function () use ($entry, $actor, $bankAmount, $reason): BankTransferAudit {
            $current = CashBoxPayment::query()->with(['box', 'transaction'])->lockForUpdate()->findOrFail($entry->id);
            $box = $current->box;
            $payment = $current->transaction;
            $this->require($box->status === 'received' && $box->type === CashBoxType::BankTransfer, __('The financial audit is only available for transfers in closed boxes.'));
            $this->require($payment->isPayment() && ! $payment->isCancelled(), __('A cancelled or non-financial transaction cannot be audited.'));
            $amountInCents = Closing::cents($bankAmount);
            $this->require($amountInCents >= 0 && $amountInCents <= 100000000, __('Enter a valid amount received by the bank.'));
            $existing = $current->audit()->first();
            if ($existing?->isPosted()) {
                $this->require(Closing::cents($existing->bank_amount) === $amountInCents, __('This transfer was already audited; the decision cannot be changed.'));

                return $existing;
            }
            $this->require(! $box->audit()->exists(), __('This box\'s audit is complete.'));
            $recorded = abs(Closing::cents($payment->currency_amount ?? $payment->amount));
            $rate = $payment->exchange_rate ?? '1.0000';
            $this->require(Money::decimal($rate)->isPositive(), __('The payment\'s exchange rate is not valid for the audit.'));
            $difference = abs(Closing::cents($payment->amount)) - Closing::cents(Money::multiply(Closing::money($amountInCents), $rate));
            $this->require($difference === 0 || filled($reason), __('Write the reason for the audit difference.'));
            $values = [
                'cash_box_payment_id' => $current->id, 'audited_by' => $actor->id,
                'currency' => $payment->currency->value, 'recorded_amount' => Closing::money($recorded),
                'bank_amount' => Closing::money($amountInCents), 'exchange_rate' => $rate,
                'difference' => Closing::money($difference),
                'outcome' => match (true) {
                    $amountInCents === 0 => 'missing', $difference > 0 => 'short', $difference < 0 => 'over', default => 'matched'
                },
                'reason' => filled($reason) ? trim($reason) : null, 'audited_at' => now(),
            ];
            if ($existing) {
                if (Closing::cents($existing->bank_amount) === $amountInCents && $existing->reason === $values['reason']) {
                    return $existing;
                }
                $existing->update($values);

                return $existing;
            }

            return BankTransferAudit::query()->create($values);
        });
    }

    public function complete(CashBox $box, User $actor): CashBoxAudit
    {
        abort_unless(self::allowed($actor, AuditAction::ApproveBoxes), 403);
        abort_unless($actor->auditIncludesBranch($box->branch_id), 404);

        return BranchLock::run($box->branch_id, function () use ($box, $actor): CashBoxAudit {
            $current = CashBox::query()->lockForUpdate()->findOrFail($box->id);
            $this->require($current->status === 'received', __('Only a closed box\'s audit can be approved.'));
            if ($existing = $current->audit()->first()) {
                return $existing;
            }
            if ($current->type === CashBoxType::BankTransfer) {
                $entries = $current->payments()->with(['transaction.subscription', 'audit'])
                    ->whereHas('transaction', fn (Builder $query): Builder => $query->where('type', SubscriptionTransaction::TYPE_PAYMENT)->where('status', SubscriptionTransaction::STATUS_ACTIVE))
                    ->lockForUpdate()->get();
                foreach ($entries as $entry) {
                    $entry->setRelation('box', $current);
                    $payment = $entry->transaction;
                    if ($payment->split_payment_id !== null) {
                        $this->splits->complete($entry, $actor, $this->postDecision(...));

                        continue;
                    }
                    $recorded = Closing::money(abs(Closing::cents($payment->currency_amount ?? $payment->amount)));
                    $audit = $entry->audit ?? BankTransferAudit::query()->create([
                        'cash_box_payment_id' => $entry->id, 'audited_by' => $actor->id,
                        'currency' => $payment->currency->value, 'recorded_amount' => $recorded,
                        'bank_amount' => $recorded, 'exchange_rate' => $payment->exchange_rate ?? 1,
                        'difference' => '0.00', 'outcome' => 'matched', 'audited_at' => now(),
                    ]);
                    $this->postDecision($entry, $audit, $actor);
                }
            }

            return CashBoxAudit::query()->create(['cash_box_id' => $current->id, 'audited_by' => $actor->id, 'audited_at' => now()]);
        });
    }

    private function postDecision(CashBoxPayment $entry, BankTransferAudit $audit, User $actor): void
    {
        if ($audit->isPosted()) {
            return;
        }

        $payment = $entry->transaction;
        $difference = Closing::cents($audit->difference);
        $adjustment = $difference === 0 ? null : $payment->subscription->transactions()->create([
            'branch_id' => $payment->branch_id, 'recorded_by' => $actor->id,
            'reference_transaction_id' => $payment->id,
            'type' => SubscriptionTransaction::TYPE_BANK_AUDIT_ADJUSTMENT,
            'source_key' => 'bank-audit:'.$entry->id,
            'amount' => Closing::money($difference),
            'currency' => $payment->currency,
            'currency_amount' => Closing::money(abs(Closing::cents($audit->recorded_amount) - Closing::cents($audit->bank_amount))),
            'exchange_rate' => $audit->exchange_rate,
            'payment_method' => $payment->payment_method,
            'notes' => $audit->reason,
        ]);
        $audit->update(['adjustment_transaction_id' => $adjustment?->id, 'posted_at' => now()]);
    }

    /** @param list<int> $expectedBoxIds */
    public function completePeriod(int $branchId, string $week, User $actor, array $expectedBoxIds, string $snapshot): void
    {
        abort_unless(self::allowed($actor, AuditAction::ApprovePeriods) && self::allowed($actor, AuditAction::ApproveBoxes), 403);
        abort_unless($actor->auditIncludesBranch($branchId), 404);

        BranchLock::run($branchId, function () use ($branchId, $week, $actor, $expectedBoxIds, $snapshot): void {
            $this->require($this->boxes->weekOf(ClosingPeriods::date($week), $branchId) === $week, __('The period\'s boundaries changed; refresh the page and review the period again.'));
            $rows = $this->boxes->rows($branchId, $actor, 'closed', week: $week);
            $this->require($rows->isNotEmpty() && array_diff($expectedBoxIds, $rows->pluck('id')->all()) === [], __('The selected boxes are not in this period and branch.'));
            $current = $this->boxes->periodAudit($rows, $branchId, $week);
            if ($current['boxes'] === 0) {
                return;
            }
            sort($expectedBoxIds);
            $this->require($expectedBoxIds === $current['box_ids'] && hash_equals($current['snapshot'], $snapshot), __('The period\'s boxes or their reviews changed since the preview; refresh the page and review the summary before approving.'));
            foreach ($current['box_ids'] as $boxId) {
                $this->complete(CashBox::query()->findOrFail($boxId), $actor);
            }
        });
    }
}
