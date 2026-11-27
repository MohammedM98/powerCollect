<?php

namespace App\Support\Closing;

use App\Enums\CashBoxType;
use App\Enums\Currency;
use App\Models\BankTransferAudit;
use App\Models\CashBoxPayment;
use App\Models\Closing;
use App\Models\SplitPayment;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Branches\BranchDomainContext;
use App\Support\Ledger\Money;
use Closure;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Validation\ValidationException;

class SplitTransferAuditing
{
    use RefusesClosingActions;

    /** @return Collection<int, SubscriptionTransaction> */
    private function parts(int $splitId, int $branchId, User $actor): Collection
    {
        SplitPayment::query()->acrossBranches()->whereKey($splitId)->lockForUpdate()->firstOrFail();
        $parts = SubscriptionTransaction::query()->acrossBranches()
            ->where('split_payment_id', $splitId)->where('type', SubscriptionTransaction::TYPE_PAYMENT)
            ->with([
                'subscription' => fn (BelongsTo $query) => $query->acrossBranches(),
                'boxEntry' => fn (HasOne $query) => $query->acrossBranches(),
                'boxEntry.box' => fn (BelongsTo $query) => $query->acrossBranches(),
                'boxEntry.box.audit', 'boxEntry.audit',
            ])->orderBy('id')->lockForUpdate()->get();
        abort_if($parts->contains(fn (SubscriptionTransaction $part): bool => $part->subscription === null
            || $part->subscription->branch_id !== $branchId || ! $actor->auditIncludesBranch($part->subscription->branch_id)
            || (BranchDomainContext::id() !== null && $part->subscription->branch_id !== BranchDomainContext::id())), 404);
        $this->require(! $parts->contains(fn (SubscriptionTransaction $part): bool => $part->isCancelled() && ! $parts->contains('corrects_id', $part->id)), __('The transfer has a cancelled or refunded part; review the whole transfer before approving it.'));
        $active = $parts->reject(fn (SubscriptionTransaction $part): bool => $part->isCancelled())->values();
        $this->require($active->isNotEmpty(), __('This transfer has no standing shares.'));
        $this->require(! $active->contains(fn (SubscriptionTransaction $part): bool => $part->currency !== Currency::Shekel
            || $part->payment_method?->value !== 'bank_transfer' || ! Money::decimal($part->exchange_rate)->isEqualTo('1') || $part->boxEntry?->box?->status !== 'received'
            || $part->boxEntry->box->type !== CashBoxType::BankTransfer), __('Every box holding a share of the split transfer must be closed before it is audited or approved.'));

        return $active;
    }

    /** @param Collection<int, SubscriptionTransaction> $parts */
    private function revision(Collection $parts): string
    {
        return hash('sha256', json_encode($parts->map(fn (SubscriptionTransaction $part): array => [
            $part->only(['id', 'amount', 'reference_number', 'bank_name', 'sender_bank_name', 'sender_name', 'notes']),
            $part->boxEntry->box->only(['id', 'status']), $part->boxEntry->box->audit?->id,
            $part->boxEntry->audit?->only(['bank_amount', 'reason', 'audited_by', 'audited_at', 'posted_at', 'adjustment_transaction_id']),
        ])->all(), JSON_THROW_ON_ERROR));
    }

    /** @param Collection<int, SubscriptionTransaction> $parts */
    private function requireEditable(Collection $parts): void
    {
        $this->require(! $parts->contains(fn (SubscriptionTransaction $part): bool => $part->boxEntry->box->audit !== null
            || ($part->boxEntry->audit?->isPosted() ?? false)), __('A part of the transfer was approved; its financial review cannot be changed.'));
    }

    /** @return array<string, mixed> */
    public function details(CashBoxPayment $entry, User $actor): array
    {
        return BranchLock::run($entry->box->branch_id, function () use ($entry, $actor): array {
            $parts = $this->parts($entry->transaction->split_payment_id, $entry->box->branch_id, $actor);
            $this->require($parts->contains('id', $entry->subscription_transaction_id), __('This share is cancelled or refunded; refresh the page.'));
            $this->requireEditable($parts);

            return [
                'revision' => $this->revision($parts),
                'total' => Closing::money($parts->sum(fn (SubscriptionTransaction $part): int => abs(Closing::cents($part->amount)))),
                'bank_amount' => Closing::money($parts->sum(fn (SubscriptionTransaction $part): int => Closing::cents($part->boxEntry->audit?->bank_amount ?? Money::amount(Money::decimal($part->amount)->abs())))),
                'reason' => $parts->first(fn (SubscriptionTransaction $part): bool => filled($part->boxEntry->audit?->reason))?->boxEntry->audit->reason ?? '',
                'parts' => $parts->map(fn (SubscriptionTransaction $part): array => [
                    'transaction_id' => $part->id, 'subscriptionName' => $part->subscription->displayName(),
                    'accountNumber' => $part->subscription->account_number, 'boxNumber' => $part->boxEntry->box->number,
                    'recorded' => Closing::money(abs(Closing::cents($part->amount))),
                    'bank_amount' => $part->boxEntry->audit?->bank_amount ?? Closing::money(abs(Closing::cents($part->amount))),
                ])->all(),
            ];
        });
    }

    /**
     * @param  list<array{transaction_id: int, bank_amount: string|int|float}>  $allocations
     * @param  Closure(CashBoxPayment, User, string, ?string): BankTransferAudit  $record
     */
    public function record(CashBoxPayment $entry, User $actor, string $total, ?string $reason, array $allocations, ?string $revision, Closure $record): BankTransferAudit
    {
        return BranchLock::run($entry->box->branch_id, function () use ($entry, $actor, $total, $reason, $allocations, $revision, $record): BankTransferAudit {
            $parts = $this->parts($entry->transaction->split_payment_id, $entry->box->branch_id, $actor);
            $this->require($parts->contains('id', $entry->subscription_transaction_id), __('This share is cancelled or refunded; refresh the page.'));
            $this->require(Closing::cents($total) >= 0 && Closing::cents($total) <= 100000000, __('Enter a valid amount received by the bank.'));
            $amounts = collect($allocations)->keyBy('transaction_id');
            $ids = array_map('intval', $amounts->keys()->all());
            sort($ids);
            if (count($allocations) !== $parts->count() || $ids !== $parts->pluck('id')->all()
                || $amounts->sum(fn (array $part): int => Closing::cents($part['bank_amount'])) !== Closing::cents($total)) {
                throw ValidationException::withMessages(['parts' => __('Distribute the whole amount received over every share of the transfer; the shares must add up to the total received.')]);
            }
            $unchanged = $parts->every(fn (SubscriptionTransaction $part): bool => $part->boxEntry->audit !== null
                && Closing::cents($part->boxEntry->audit->bank_amount) === Closing::cents($amounts[$part->id]['bank_amount'])
                && (string) $part->boxEntry->audit->reason === trim((string) $reason));
            if ($unchanged) {
                return $parts->firstWhere('id', $entry->transaction->id)->boxEntry->audit;
            }
            $this->requireEditable($parts);
            if ($revision === null || ! hash_equals($this->revision($parts), $revision)) {
                throw ValidationException::withMessages(['revision' => __('The transfer or its review changed; close the window and open it again before saving.')]);
            }
            $selected = null;
            foreach ($parts as $part) {
                $audit = $record($part->boxEntry, $actor, (string) $amounts[$part->id]['bank_amount'], $reason);
                if ($part->id === $entry->transaction->id) {
                    $selected = $audit;
                }
            }

            return $selected;
        });
    }

    /**
     * Post the complete reviewed transfer atomically, even across multiple closed boxes.
     *
     * @param  Closure(CashBoxPayment, BankTransferAudit, User): void  $post
     */
    public function complete(CashBoxPayment $entry, User $actor, Closure $post): void
    {
        $parts = $this->parts($entry->transaction->split_payment_id, $entry->box->branch_id, $actor);
        $reviewed = $parts->filter(fn (SubscriptionTransaction $part): bool => $part->boxEntry->audit !== null);
        $this->require($reviewed->isEmpty() || $reviewed->count() === $parts->count(), __('The split transfer\'s review is incomplete; open the transfer\'s edit and review all its shares before approving.'));
        foreach ($parts as $part) {
            $part->boxEntry->setRelation('transaction', $part);
            $audit = $part->boxEntry->audit ?? BankTransferAudit::query()->create([
                'cash_box_payment_id' => $part->boxEntry->id, 'audited_by' => $actor->id,
                'currency' => $part->currency->value, 'recorded_amount' => Money::amount(Money::decimal($part->amount)->abs()),
                'bank_amount' => Money::amount(Money::decimal($part->amount)->abs()), 'exchange_rate' => 1,
                'difference' => '0.00', 'outcome' => 'matched', 'audited_at' => now(),
            ]);
            $post($part->boxEntry, $audit, $actor);
        }
    }
}
