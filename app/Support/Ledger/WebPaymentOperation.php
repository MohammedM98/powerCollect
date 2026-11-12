<?php

namespace App\Support\Ledger;

use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Closing\BranchClosingWorkflow;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WebPaymentOperation
{
    public function __construct(private BranchClosingWorkflow $workflow) {}

    /** @param array<string, mixed> $payment */
    public function record(Subscription $subscription, User $actor, array $payment): SubscriptionTransaction
    {
        try {
            return $this->workflow->locked($subscription->branch_id, function () use ($subscription, $actor, $payment): SubscriptionTransaction {
                if ($existing = $this->replay($subscription, $actor, $payment)) {
                    return $existing;
                }

                $transaction = RecordPayment::handle($subscription, $actor, $payment);
                DB::table('web_payment_operations')->insert([
                    'token' => strtolower($payment['payment_token']),
                    'fingerprint' => $this->fingerprint($subscription, $actor, $payment),
                    'subscription_transaction_id' => $transaction->id,
                ]);

                return $transaction;
            });
        } catch (UniqueConstraintViolationException $exception) {
            if ($existing = $this->replay($subscription, $actor, $payment)) {
                return $existing;
            }

            throw $exception;
        }
    }

    /** @param array<string, mixed> $payment */
    public function replay(Subscription $subscription, User $actor, array $payment): ?SubscriptionTransaction
    {
        $existing = DB::table('web_payment_operations')->where('token', strtolower($payment['payment_token']))->first();
        if ($existing === null) {
            return null;
        }

        if (! hash_equals($existing->fingerprint, $this->fingerprint($subscription, $actor, $payment)) || $existing->subscription_transaction_id === null) {
            throw ValidationException::withMessages(['payment_token' => __('This recording request was already used with different details. Reopen the form for a new payment.')]);
        }

        return SubscriptionTransaction::query()->acrossBranches()->findOrFail($existing->subscription_transaction_id);
    }

    /** @param array<string, mixed> $payment */
    private function fingerprint(Subscription $subscription, User $actor, array $payment): string
    {
        $data = ['subscription' => $subscription->id, 'branch' => $subscription->branch_id, 'actor' => $actor->id];
        foreach (['amount', 'currency', 'payment_method', 'bank_name', 'sender_bank_name', 'bank_received_on', 'sender_name', 'reference_number', 'cash_box', 'manual_voucher_number', 'notes'] as $field) {
            $data[$field] = $payment[$field] ?? null;
        }
        $data['amount'] = Money::amount($payment['amount']);

        return hash('sha256', json_encode($data, JSON_THROW_ON_ERROR));
    }
}
