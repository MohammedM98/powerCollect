<?php

namespace App\Support\Ledger;

use App\Models\Bank;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Branches\BranchDomainContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Bank references as transfers are compared, and the payment already holding one.
 */
class PaymentReferences
{
    /**
     * A bank reference as transfers are compared: upper case, without
     * spaces, dashes, slashes or dots, so FT-100, ft 100 and FT/100 are one.
     */
    public static function normalizeReference(mixed $reference): ?string
    {
        $normalized = Str::upper((string) preg_replace('/[\s\p{Pd}\/.]+/u', '', trim((string) $reference)));

        return $normalized !== '' ? $normalized : null;
    }

    /**
     * The payment already holding the reference, other than `$ignoreTransactionId`
     * and the parts of the split transfer `$ignoreSplitPaymentId`, which share it.
     */
    public static function activeReferenceConflict(mixed $reference, ?int $ignoreTransactionId = null, ?int $ignoreSplitPaymentId = null): ?SubscriptionTransaction
    {
        $normalized = PaymentReferences::normalizeReference($reference);

        if ($normalized === null) {
            return null;
        }

        return SubscriptionTransaction::query()->acrossBranches()
            ->where('active_reference', $normalized)
            ->when($ignoreTransactionId, fn (Builder $query): Builder => $query->whereKeyNot($ignoreTransactionId))
            ->when($ignoreSplitPaymentId, fn (Builder $query): Builder => $query->where(fn (Builder $other) => $other->whereNull('split_payment_id')->orWhere('split_payment_id', '!=', $ignoreSplitPaymentId)))
            ->with(['subscription' => fn (BelongsTo $query) => $query->acrossBranches()])
            ->first();
    }

    public static function ensureReferenceIsAvailable(?string $activeReference, ?int $splitPaymentId = null): void
    {
        $conflict = PaymentReferences::activeReferenceConflict($activeReference, null, $splitPaymentId);

        if ($conflict) {
            throw PaymentReferences::referenceConflictException($conflict);
        }
    }

    public static function mayDiscloseReferenceTo(SubscriptionTransaction $transaction, ?User $actor): bool
    {
        if (BranchDomainContext::id() !== null && $transaction->subscription->branch_id !== BranchDomainContext::id()) {
            return false;
        }

        return $actor !== null && ($actor->can('view', $transaction->subscription) || $actor->can('recordPayment', $transaction->subscription));
    }

    public static function referenceConflictException(SubscriptionTransaction $conflict): ValidationException
    {
        if (! PaymentReferences::mayDiscloseReferenceTo($conflict, request()->user())) {
            return ValidationException::withMessages(['reference_number' => __('This reference number is already recorded on another payment.')]);
        }

        return ValidationException::withMessages([
            'reference_number' => sprintf(
                __('This reference number is already recorded on another payment%s for subscriber %s.'),
                LinePresenter::displayVoucherNumber($conflict) ? __(' — voucher ').LinePresenter::displayVoucherNumber($conflict) : '',
                $conflict->subscription->displayName(),
            ),
        ]);
    }
}
