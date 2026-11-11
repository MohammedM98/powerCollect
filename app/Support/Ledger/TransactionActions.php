<?php

namespace App\Support\Ledger;

use App\Enums\CorrectionReason;
use App\Enums\PermissionKey;
use App\Enums\TransactionAction;
use App\Models\CashBoxPayment;
use App\Models\Closing;
use App\Models\MeterReading;
use App\Models\SplitPayment;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Money;
use Brick\Math\RoundingMode;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The canonical actions on a ledger line (edit, edit details, delete, cancel, refund): which ones the user may take now, and applying one, across every part of a split transfer.
 */
class TransactionActions
{
    /**
     * The canonical actions the current user may submit for this transaction.
     * Business rules and permissions are both decided on the server.
     *
     * @return array<int, string>
     */
    public static function availableActions(SubscriptionTransaction $transaction, User $actor, ?bool $isLast = null, ?bool $hasPayment = null, bool $lockForUpdate = false, bool $withSplitParts = true): array
    {
        if ($transaction->type === SubscriptionTransaction::TYPE_BANK_AUDIT_ADJUSTMENT || LineHistory::isInClosedDay($transaction, $lockForUpdate)) {
            return [];
        }

        if (! $actor->isSuperAdmin() && $transaction->subscription->branch_id !== $actor->workBranchId()) {
            return [];
        }

        $isLast ??= LineHistory::isLastTransaction($transaction, $lockForUpdate);
        $hasPayment ??= LineHistory::hasAppliedPayment($transaction, $lockForUpdate);
        $businessActions = TransactionActions::businessAvailableActions($transaction, $isLast, $hasPayment, $lockForUpdate);

        if (! LineRules::isAmendable($transaction, $lockForUpdate)) {
            $businessActions = array_values(array_filter(
                $businessActions,
                fn (TransactionAction $action): bool => $action !== TransactionAction::EditMetadata,
            ));
        }

        if (LineHistory::isPermanentDeletionLocked($transaction, $lockForUpdate)) {
            $businessActions = array_values(array_filter(
                $businessActions,
                fn (TransactionAction $action): bool => ! $action->isPermanentDeletion(),
            ));
        }

        // An action on a part of a split transfer is applied to all its parts (applyAction()), so only when each of them may take it.
        $splitPaymentId = $withSplitParts ? TransactionActions::mutationSplitPayment($transaction)?->id : null;

        return collect(TransactionAction::ordered())
            ->filter(fn (TransactionAction $action): bool => in_array($action, $businessActions, true) && TransactionActions::actorMay($transaction, $actor, $action)
                && ($splitPaymentId === null || TransactionActions::splitPartsAllow($splitPaymentId, $actor, $action, $lockForUpdate)))
            ->map(fn (TransactionAction $action): string => $action->value)
            ->values()
            ->all();
    }

    /**
     * Apply one of the five canonical actions after locking and validating
     * the transaction against a freshly computed available-actions list.
     *
     * @param  array<string, mixed>  $data
     */
    public static function applyAction(SubscriptionTransaction $transaction, User $actor, TransactionAction $action, array $data): ?SubscriptionTransaction
    {
        $split = TransactionActions::mutationSplitPayment($transaction);
        if ($split !== null && $action === TransactionAction::EditMetadata) {
            if (! $transaction->isPayment() || $transaction->fresh()->isCancelled()) {
                throw ValidationException::withMessages(['action' => 'هذه الدفعة ملغاة أو مُرجعة.']);
            }
            $split->revise($actor, [...array_intersect_key($data, array_flip(SubscriptionTransaction::AMENDABLE_FIELDS)), 'amendment_reason' => $data['amendment_reason']]);

            return $transaction->refresh();
        }
        if ($split === null || ! in_array($action, [TransactionAction::Refund, TransactionAction::Cancel, TransactionAction::Delete, TransactionAction::DeleteTree, TransactionAction::DeleteReversal], true)) {
            return TransactionActions::applySingleAction($transaction, $actor, $action, $data);
        }

        return $split->withPaymentsLocked($actor, function (Collection $parts) use ($actor, $action, $data, $transaction): ?SubscriptionTransaction {
            $selected = SubscriptionTransaction::query()->with('subscription')->lockForUpdate()->findOrFail($transaction->id);
            if (! in_array($action->value, TransactionActions::availableActions($selected, $actor, lockForUpdate: true), true)) {
                throw ValidationException::withMessages(['action' => 'هذا الإجراء غير مسموح لهذه الحركة.']);
            }
            if (in_array($action, [TransactionAction::Delete, TransactionAction::DeleteTree], true)) {
                TransactionActions::deleteSplitParts($transaction, $actor, $parts, $data);

                return null;
            }
            $targets = [];
            foreach ($parts as $part) {
                $target = $part;
                $partAction = $action;
                if (in_array($action, [TransactionAction::Refund, TransactionAction::Cancel], true) && $part->isCancelled()) {
                    continue;
                }
                if ($action === TransactionAction::DeleteReversal) {
                    if (! $part->isCancelled() || $parts->contains('corrects_id', $part->id)) {
                        continue;
                    }
                    $linkedReversals = SubscriptionTransaction::query()->where('subscription_id', $part->subscription_id)
                        ->where(fn (Builder $query): Builder => $query->where('reverses_id', $part->id)->orWhere('reference_transaction_id', $part->id))
                        ->whereIn('type', SubscriptionTransaction::REVERSAL_TYPES)->lockForUpdate()->get();
                    if ($linkedReversals->count() !== 1) {
                        throw ValidationException::withMessages(['action' => 'لهذه الحوالة إرجاعات جزئية سابقة؛ لا يمكن حذف إرجاع واحد وإعادة الحوالة كاملة.']);
                    }
                    $target = $linkedReversals->first();
                }
                if ($target === null || ! in_array($partAction->value, TransactionActions::availableActions($target, $actor, lockForUpdate: true), true)) {
                    throw ValidationException::withMessages(['action' => 'لا يمكن تنفيذ العملية على جميع أجزاء الحوالة المقسّمة؛ تحقق من صلاحياتك وحالة الصناديق والحركات اللاحقة.']);
                }
                $targets[] = [$target, $partAction];
            }
            $result = null;
            foreach ($targets as [$target, $partAction]) {
                $changed = TransactionActions::applySingleAction($target, $actor, $partAction, $data);
                if ($target->id === $transaction->id) {
                    $transaction->setRawAttributes($target->getAttributes(), true);
                    $result = $changed;
                }
            }

            return $result;
        });
    }

    /**
     * Remove the complete transfer history without reinstating an earlier,
     * corrected share. Validate every line before deleting any of them.
     *
     * @param  Collection<int, SubscriptionTransaction>  $parts
     * @param  array<string, mixed>  $data
     */
    public static function deleteSplitParts(SubscriptionTransaction $transaction, User $actor, Collection $parts, array $data, bool $legacy = false): void
    {
        foreach ($parts as $part) {
            if (! $actor->hasPermission(PermissionKey::ForceDeleteTransactions) || ! TransactionActions::isDeletableSplitPart($part, $parts, $legacy, lockForUpdate: true)) {
                throw ValidationException::withMessages(['action' => 'لا يمكن حذف الحوالة المقسّمة: أحد أجزائها مغلق أو غير مسموح بحذفه.']);
            }
        }
        foreach ($parts as $part) {
            if (! $part->isCancelled()) {
                self::applyHardDelete($part->refresh(), $actor, $data);
            }
        }
    }

    /**
     * Whether one part of a split transfer may be deleted with the others:
     * replaced by a correction, fully reversed when cancelled (its last
     * reversal erasable, for the legacy erase), otherwise the last line of
     * its own statement, with nothing of it in a closed box or a sent
     * closing.
     *
     * @param  Collection<int, SubscriptionTransaction>  $parts
     */
    public static function isDeletableSplitPart(SubscriptionTransaction $part, Collection $parts, bool $legacy, bool $lockForUpdate): bool
    {
        $reversals = SubscriptionTransaction::query()->where('subscription_id', $part->subscription_id)
            ->where(fn (Builder $query): Builder => $query->where('reverses_id', $part->id)->orWhere('reference_transaction_id', $part->id))
            ->whereIn('type', SubscriptionTransaction::REVERSAL_TYPES)->orderBy('id')
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())->get();
        $canDelete = $parts->contains('corrects_id', $part->id) || ($part->isCancelled()
            ? ($legacy ? ($reversals->last() !== null && EraseLine::isErasable($reversals->last(), $lockForUpdate, withSplitParts: false)) : LineHistory::isFullyReversed($part, $lockForUpdate))
            : LineHistory::isLastTransaction($part, $lockForUpdate));

        return $canDelete
            && ! LineHistory::isInClosedDay($part, $lockForUpdate) && ! LineHistory::isPermanentDeletionLocked($part, $lockForUpdate)
            && ! $reversals->contains(fn (SubscriptionTransaction $reversal): bool => LineHistory::isInClosedDay($reversal, $lockForUpdate));
    }

    /**
     * Whether every part of the split transfer can take the action applied
     * to all of them from one part, as applyAction() applies it: refunded,
     * its details edited, its refund deleted or deleted with the others.
     */
    public static function splitPartsAllow(int $splitPaymentId, User $actor, TransactionAction $action, bool $lockForUpdate): bool
    {
        $parts = SubscriptionTransaction::query()->acrossBranches()
            ->where('split_payment_id', $splitPaymentId)->where('type', SubscriptionTransaction::TYPE_PAYMENT)->orderBy('id')
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())->get();
        $standing = $parts->reject(fn (SubscriptionTransaction $part): bool => $part->isCancelled());
        $replaced = fn (SubscriptionTransaction $part): bool => $parts->contains('corrects_id', $part->id);
        $offers = fn (SubscriptionTransaction $line): bool => in_array($action->value, TransactionActions::availableActions($line, $actor, lockForUpdate: $lockForUpdate, withSplitParts: false), true);

        if ($parts->contains(fn (SubscriptionTransaction $part): bool => ! $actor->isSuperAdmin() && $part->branch_id !== $actor->workBranchId())) {
            return false;
        }

        return match ($action) {
            TransactionAction::EditMetadata => ! $parts->contains(fn (SubscriptionTransaction $part): bool => $part->isCancelled() && ! $replaced($part))
                && $standing->every(fn (SubscriptionTransaction $part): bool => LineRules::isAmendable($part, $lockForUpdate) && $actor->can('amend', $part)),
            TransactionAction::Refund, TransactionAction::Cancel => $standing->every($offers),
            TransactionAction::DeleteReversal => $parts->filter(fn (SubscriptionTransaction $part): bool => $part->isCancelled() && ! $replaced($part))
                ->every(function (SubscriptionTransaction $part) use ($offers): bool {
                    $reversals = SubscriptionTransaction::query()->where('subscription_id', $part->subscription_id)
                        ->where(fn (Builder $query): Builder => $query->where('reverses_id', $part->id)->orWhere('reference_transaction_id', $part->id))
                        ->whereIn('type', SubscriptionTransaction::REVERSAL_TYPES)->get();

                    return $reversals->count() === 1 && $offers($reversals->first());
                }),
            TransactionAction::Delete, TransactionAction::DeleteTree => $parts->every(fn (SubscriptionTransaction $part): bool => TransactionActions::isDeletableSplitPart($part, $parts, legacy: false, lockForUpdate: $lockForUpdate)),
            default => true,
        };
    }

    public static function mutationSplitPayment(SubscriptionTransaction $transaction): ?SplitPayment
    {
        $payment = $transaction->isPayment() ? $transaction : ($transaction->isReversal() ? $transaction->reverses : null);

        return $payment?->isPayment() ? $payment->splitPayment : null;
    }

    /** @param array<string, mixed> $data */
    public static function applySingleAction(SubscriptionTransaction $transaction, User $actor, TransactionAction $action, array $data): ?SubscriptionTransaction
    {
        return $transaction->withMutationLock(function () use ($actor, $action, $data, $transaction): ?SubscriptionTransaction {
            $line = SubscriptionTransaction::query()->with('subscription')->lockForUpdate()->findOrFail($transaction->id);
            $isLast = LineHistory::isLastTransaction($line, lockForUpdate: true);
            $hasPayment = LineHistory::hasAppliedPayment($line, lockForUpdate: true);

            if (! in_array($action->value, TransactionActions::availableActions($line, $actor, $isLast, $hasPayment, lockForUpdate: true), true)) {
                throw ValidationException::withMessages(['action' => 'هذا الإجراء غير مسموح لهذه الحركة.']);
            }

            $result = match ($action) {
                TransactionAction::Edit => TransactionActions::applyAmountEdit($line, $actor, $data),
                TransactionAction::EditMetadata => TransactionActions::applyMetadataEdit($line, $actor, $data),
                TransactionAction::Delete => TransactionActions::applyHardDelete($line, $actor, $data),
                TransactionAction::DeleteReversal => TransactionActions::applyHardDelete($line, $actor, $data),
                TransactionAction::DeleteTree => TransactionActions::applyTreeDelete($line, $actor, $data),
                TransactionAction::Cancel => TransactionActions::applyCancellation($line, $actor, $data),
                TransactionAction::Refund => TransactionActions::applyRefund($line, $actor, $data),
            };

            $transaction->setRawAttributes($line->getAttributes(), true);

            return $result;
        });
    }

    /** @return array<int, TransactionAction> */
    public static function businessAvailableActions(SubscriptionTransaction $transaction, bool $isLast, bool $hasPayment, bool $lockForUpdate): array
    {
        $metadataActions = $transaction->isPayment() ? [TransactionAction::EditMetadata] : [];

        if ($transaction->currentStatus() !== SubscriptionTransaction::STATUS_ACTIVE) {
            return [];
        }

        if (in_array($transaction->type, SubscriptionTransaction::INVOICE_LIKE_TYPES, true)) {
            // A weekly reading's charge changes only by correcting the reading, so the two always agree.
            $amountEdit = $transaction->isBilledByReading() ? [] : [TransactionAction::Edit];

            return $isLast && ! $hasPayment && ! LineHistory::replacesReadingBill($transaction)
                ? [...$amountEdit, ...$metadataActions, TransactionAction::Delete]
                : [...$metadataActions, TransactionAction::Cancel];
        }

        if ($transaction->isPayment()) {
            if ($transaction->split_payment_id !== null) {
                return [...$metadataActions, ...($isLast ? [TransactionAction::Delete] : []), TransactionAction::Refund];
            }

            return $isLast
                ? [...$metadataActions, TransactionAction::Delete]
                : [...$metadataActions, TransactionAction::Refund];
        }

        // A weekly reading's discount stands or falls with its reading: cancelling the reading takes it too.
        if ($transaction->type === SubscriptionTransaction::TYPE_READING_DISCOUNT) {
            return [];
        }

        if (in_array($transaction->type, SubscriptionTransaction::PAYMENT_LIKE_TYPES, true)) {
            if ($transaction->isClearing() && LineHistory::isInClosedDay($transaction, $lockForUpdate)) {
                return [];
            }
            if ($transaction->isClearing() && CashBoxPayment::query()->where('subscription_transaction_id', $transaction->id)->where('status', 'rejected')->exists() && ! LineHistory::isInClosedDay($transaction, $lockForUpdate)) {
                return [TransactionAction::Cancel];
            }

            return $isLast ? [TransactionAction::Delete] : [TransactionAction::Cancel];
        }

        if (in_array($transaction->type, SubscriptionTransaction::REVERSAL_TYPES, true)) {
            return [];
        }

        return $metadataActions;
    }

    public static function actorMay(SubscriptionTransaction $transaction, User $actor, TransactionAction $action): bool
    {
        return match ($action) {
            TransactionAction::Edit => $actor->hasPermission(PermissionKey::CorrectTransactions),
            TransactionAction::EditMetadata => $actor->hasPermission(PermissionKey::AmendTransactionDetails),
            TransactionAction::Delete, TransactionAction::DeleteReversal, TransactionAction::DeleteTree => $actor->hasPermission(PermissionKey::ForceDeleteTransactions),
            TransactionAction::Cancel => $actor->hasPermission(PermissionKey::DeleteTransactions),
            TransactionAction::Refund => $actor->hasPermission(PermissionKey::RefundPayments),
        };
    }

    /** @param array<string, mixed> $data */
    public static function applyAmountEdit(SubscriptionTransaction $transaction, User $actor, array $data): SubscriptionTransaction
    {
        $oldAmount = $transaction->amount;
        $amount = Money::amount($data['amount']);
        $balanceBefore = Money::sum(SubscriptionTransaction::query()
            ->where('subscription_id', $transaction->subscription_id)
            ->whereKeyNot($transaction->id)
            ->pluck('amount'));

        $transaction->update([
            'amount' => $amount,
            'currency_amount' => $transaction->currency_amount === null ? null : $amount,
            'balance_after' => Money::add($balanceBefore, $amount),
        ]);
        $transaction->amendments()->create([
            'user_id' => $actor->id,
            'changes' => ['amount' => [$oldAmount, $amount]],
            'reason' => trim((string) $data['amendment_reason']),
        ]);

        return $transaction;
    }

    /** @param array<string, mixed> $data */
    public static function applyMetadataEdit(SubscriptionTransaction $transaction, User $actor, array $data): SubscriptionTransaction
    {
        $fields = array_intersect_key($data, array_flip(SubscriptionTransaction::AMENDABLE_FIELDS));
        AmendLine::amend($transaction, $actor, $fields, filled($data['amendment_reason'] ?? null) ? trim((string) $data['amendment_reason']) : 'تعديل بيانات الحركة');

        return $transaction;
    }

    /** @param array<string, mixed> $data */
    public static function applyHardDelete(SubscriptionTransaction $transaction, User $actor, array $data): ?SubscriptionTransaction
    {
        if ($transaction->isReversal() || $transaction->isCancelled()) {
            throw ValidationException::withMessages(['action' => 'لا يمكن حذف السجل المالي أو حركات الإلغاء.']);
        }

        return $transaction->isPayment()
            ? TransactionActions::applyRefund($transaction, $actor, $data)
            : CancelLine::cancel($transaction, $actor, CorrectionReason::tryFrom((string) ($data['correction_reason'] ?? '')) ?? CorrectionReason::Other, $data['correction_notes'] ?? null, (bool) ($data['reopen_reading'] ?? false));
    }

    /**
     * When this is a weekly reading's charge that no longer stands, send the
     * reading back for approval, so its week can be corrected and billed
     * afresh when it is approved again.
     */
    public static function reopenReading(SubscriptionTransaction $transaction): void
    {
        if ($transaction->type === SubscriptionTransaction::TYPE_METER_READING && $transaction->isBilledByReading()) {
            MeterReading::query()->lockForUpdate()->find($transaction->meter_reading_id)?->reopen();
        }
    }

    /** @param array<string, mixed> $data */
    public static function applyTreeDelete(SubscriptionTransaction $transaction, User $actor, array $data): ?SubscriptionTransaction
    {
        throw ValidationException::withMessages(['action' => 'لا يمكن حذف السجل المالي أو حركات الإلغاء.']);
    }

    /** @param array<string, mixed> $data */
    public static function applyCancellation(SubscriptionTransaction $transaction, User $actor, array $data): SubscriptionTransaction
    {
        $reason = CorrectionReason::tryFrom((string) ($data['correction_reason'] ?? '')) ?? CorrectionReason::Other;

        $transaction->update([
            'status' => SubscriptionTransaction::STATUS_CANCELLED,
            'cancelled_at' => now(),
            'cancelled_by' => $actor->id,
            'cancellation_reason' => $reason,
            'cancellation_notes' => $data['correction_notes'] ?? null,
            'active_reference' => null,
            ...($transaction->isBilledByReading() && ($data['reopen_reading'] ?? false) ? ['source_key' => $transaction->source_key.':cancelled:'.$transaction->id] : []),
        ]);

        $cancellation = $transaction->subscription->transactions()->create([
            'recorded_by' => $actor->id,
            'reverses_id' => $transaction->id,
            'reference_transaction_id' => $transaction->id,
            'type' => SubscriptionTransaction::TYPE_CANCELLATION,
            'status' => SubscriptionTransaction::STATUS_ACTIVE,
            'source_key' => 'cancellation:'.$transaction->id.':'.Str::ulid(),
            'amount' => Money::negate($transaction->amount),
            'currency' => $transaction->currency,
            'currency_amount' => $transaction->currency_amount,
            'exchange_rate' => $transaction->exchange_rate,
            'payment_method' => $transaction->payment_method,
        ]);

        // A weekly reading's standing discount only stands beside its charge, so it is cancelled with it.
        $standingDiscount = LineHistory::readingDiscountStanding($transaction);
        if ($standingDiscount !== null) {
            self::applyCancellation($standingDiscount, $actor, $data);
        }

        if ($data['reopen_reading'] ?? false) {
            TransactionActions::reopenReading($transaction);
        }

        return $cancellation;
    }

    /**
     * Refund the payment in full: everything of it not refunded yet (all of
     * it, unless an older partial refund took some back), with a linked
     * refund line, and mark it refunded. A wrong amount is put right by
     * recording the right payment afterwards, never by a partial refund.
     *
     * @param  array<string, mixed>  $data
     */
    public static function applyRefund(SubscriptionTransaction $transaction, User $actor, array $data): SubscriptionTransaction
    {
        $exchangeRate = Money::decimal($transaction->exchange_rate);
        if (! $exchangeRate->isPositive()) {
            throw ValidationException::withMessages(['action' => 'سعر الصرف المسجّل لهذه الدفعة غير صالح؛ صحّح السجل قبل إرجاعها.']);
        }

        $earlierRefunds = SubscriptionTransaction::query()
            ->where('reference_transaction_id', $transaction->id)
            ->where('type', SubscriptionTransaction::TYPE_REFUND)
            ->lockForUpdate()
            ->get();
        $refunded = Money::sum($earlierRefunds->map(fn (SubscriptionTransaction $refund): string => Money::amount(Money::decimal($refund->amount)->abs())));
        $amount = Money::subtract(Money::amount(Money::decimal($transaction->amount)->abs()), $refunded);

        if ($amount <= 0) {
            throw ValidationException::withMessages(['action' => 'أُرجعت هذه الدفعة بالكامل من قبل.']);
        }

        $currencyAmount = $transaction->currency_amount === null
            ? Money::amount(Money::decimal($amount)->dividedBy($exchangeRate, 2, RoundingMode::HalfUp))
            : Money::subtract($transaction->currency_amount, Money::sum($earlierRefunds->map(fn (SubscriptionTransaction $refund): string => $refund->currency_amount
                ?? Money::amount(Money::decimal($refund->amount)->abs()->dividedBy($exchangeRate, 2, RoundingMode::HalfUp)))));

        $refund = $transaction->subscription->transactions()->create([
            'recorded_by' => $actor->id,
            'reverses_id' => $transaction->id,
            'reference_transaction_id' => $transaction->id,
            'type' => SubscriptionTransaction::TYPE_REFUND,
            'status' => SubscriptionTransaction::STATUS_ACTIVE,
            'source_key' => 'refund:'.$transaction->id.':'.Str::ulid(),
            'amount' => Money::amount($amount),
            'currency' => $transaction->currency,
            'currency_amount' => $currencyAmount,
            'exchange_rate' => $transaction->exchange_rate,
            'payment_method' => $transaction->payment_method,
        ]);

        $transaction->update([
            'status' => SubscriptionTransaction::STATUS_LINKED_CANCELLATION,
            'cancelled_at' => now(),
            'cancelled_by' => $actor->id,
            'cancellation_reason' => CorrectionReason::PaymentRefunded,
            'cancellation_notes' => $data['correction_notes'] ?? null,
            'active_reference' => null,
        ]);

        return $refund;
    }
}
