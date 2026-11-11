<?php

namespace App\Support\Ledger;

use App\Enums\Currency;
use App\Enums\PaymentMethod;
use App\Models\Bank;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\BranchClosingWorkflow;
use App\Support\Money;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Records a payment on a subscription's account: converted to shekels, with the next voucher number for cash, its bank details for a transfer, and a refusal of a reference another payment already holds.
 */
class RecordPayment
{
    /**
     * Record a payment on the subscription's account, converted to shekels
     * at `exchange_rate` (always 1 for shekels), with the next voucher
     * number (cash only). A transfer keeps its bank, sender and reference; cash keeps
     * its cash box and paper voucher. A reference already on another payment
     * is refused unless the collector confirmed the duplicate.
     *
     * A payment that is part of a split transfer (`split_payment_id`) may share the reference
     * with the split's other parts, which is not a duplicate.
     *
     * @param  array{amount: float|string, currency: string, exchange_rate?: float|string|null, payment_method: string, bank_name?: ?string, sender_bank_name?: ?string, sender_name?: ?string, reference_number?: ?string, manual_voucher_number?: ?string, cash_box?: ?string, notes?: ?string, mobile_operation_id?: ?string, confirm_duplicate_reference?: bool, split_payment_id?: ?int}  $payment
     */
    public static function handle(Subscription $subscription, User $collector, array $payment): SubscriptionTransaction
    {
        $currency = Currency::from($payment['currency']);
        $method = PaymentMethod::from($payment['payment_method']);
        $exchangeRate = $currency === Currency::Shekel ? '1.0000' : $payment['exchange_rate'];
        $inShekels = Money::multiply($payment['amount'], $exchangeRate);
        $referenceNumber = $method === PaymentMethod::Cash ? null : trim((string) ($payment['reference_number'] ?? ''));
        $activeReference = PaymentReferences::normalizeReference($referenceNumber);

        return app(BranchClosingWorkflow::class)->locked($subscription->branch_id, function () use ($subscription, $collector, $payment, $currency, $method, $exchangeRate, $inShekels, $referenceNumber, $activeReference): SubscriptionTransaction {
            $lateToken = $payment['late_payment_token'] ?? null;
            $lateFingerprint = $lateToken ? hash('sha256', json_encode([
                'amount' => Money::amount($payment['amount']),
                'currency' => $currency->value, 'method' => $method->value,
                'paid_on' => $payment['paid_on'], 'late_reason' => $payment['late_reason'],
                'bank' => $payment['bank_name'] ?? null, 'sender_bank' => $payment['sender_bank_name'] ?? null,
                'sender' => $payment['sender_name'] ?? null, 'reference' => $activeReference,
                'voucher' => $payment['manual_voucher_number'] ?? null, 'notes' => $payment['notes'] ?? null,
            ], JSON_THROW_ON_ERROR)) : null;
            if ($lateToken && $existing = SubscriptionTransaction::query()->where('late_payment_token', $lateToken)->first()) {
                if ($existing->subscription_id !== $subscription->id || $existing->recorded_by !== $collector->id
                    || ! hash_equals($existing->late_payment_fingerprint, $lateFingerprint)) {
                    throw ValidationException::withMessages(['late_payment_token' => 'تم استخدام طلب التسجيل هذا مسبقًا ببيانات مختلفة. أعد فتح النموذج لدفعة جديدة.']);
                }

                return $existing;
            }
            if (! ($payment['confirm_duplicate_reference'] ?? false)) {
                PaymentReferences::ensureReferenceIsAvailable($activeReference, $payment['split_payment_id'] ?? null);
            }

            // Only cash payments get a voucher number; a transfer is identified by its bank reference.
            $voucherNumber = $method === PaymentMethod::Cash ? ClaimVoucherNumber::next() : null;

            return $subscription->transactions()->create([
                'recorded_by' => $collector->id,
                'type' => SubscriptionTransaction::TYPE_PAYMENT,
                'source_key' => 'payment:'.($voucherNumber ?? Str::ulid()),
                'mobile_operation_id' => $payment['mobile_operation_id'] ?? null,
                'amount' => Money::negate($inShekels),
                'currency' => $currency,
                'currency_amount' => $payment['amount'],
                'exchange_rate' => $exchangeRate,
                'payment_method' => $method,
                'bank_name' => $method->throughBank() ? $payment['bank_name'] : null,
                'bank_received_on' => $method->throughBank() ? ($payment['bank_received_on'] ?? null) : null,
                'sender_bank_name' => $method->throughBank() ? ($payment['sender_bank_name'] ?? null) : null,
                'sender_name' => $method->throughBank() ? ($payment['sender_name'] ?? null) : null,
                'reference_number' => $referenceNumber ?: null,
                'active_reference' => $activeReference,
                'split_payment_id' => $payment['split_payment_id'] ?? null,
                'voucher_number' => $voucherNumber,
                'manual_voucher_number' => $method === PaymentMethod::Cash ? ($payment['manual_voucher_number'] ?? null) : null,
                'cash_box' => $method === PaymentMethod::Cash ? ($payment['cash_box'] ?? null) : null,
                'notes' => $payment['notes'] ?? null,
                'paid_on' => $lateToken ? $payment['paid_on'] : null,
                'late_reason' => $lateToken ? $payment['late_reason'] : null,
                'late_payment_token' => $lateToken,
                'late_payment_fingerprint' => $lateFingerprint,
            ]);
        });
    }
}
