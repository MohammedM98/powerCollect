<?php

namespace App\Support\Ledger;

use App\Models\Closing;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;/**
 * The collections data the field app receives: subscriptions, their statements and today's payments.
 */
class MobileCollectionData
{
    /** @return array<string, mixed> */
    public static function statementLine(SubscriptionTransaction $transaction, int &$balanceAfterInCents): array
    {
        $entry = [
            'id' => $transaction->id,
            'date' => $transaction->created_at->copy()->setTimezone(config('app.business_timezone'))->toDateString(),
            'recorded_at' => $transaction->created_at->copy()->setTimezone(config('app.business_timezone'))->format('Y-m-d H:i'),
            'bank_received_on' => $transaction->bank_received_on?->toDateString(),
            'type' => $transaction->type,
            'type_label' => LinePresenter::typeLabel($transaction),
            'description' => LinePresenter::description($transaction),
            'notes' => $transaction->notes,
            'voucher_number' => LinePresenter::displayVoucherNumber($transaction),
            'reference_number' => $transaction->reference_number,
            'amount' => Closing::money(abs(Closing::cents($transaction->amount))),
            'is_credit' => (float) $transaction->amount < 0,
            'is_cancelled' => $transaction->isCancelled(),
            'balance_after' => Closing::money($balanceAfterInCents),
        ];
        $balanceAfterInCents -= Closing::cents($transaction->amount);

        return $entry;
    }

    /**
     * A payment just recorded, with the subscription's balance after it, as
     * the website's receipt shows it.
     *
     * @return array<string, mixed>
     */
    public static function recordedCollectionData(SubscriptionTransaction $transaction): array
    {
        $transaction->load('subscription');

        return [
            ...self::collectionData($transaction),
            'balance_after' => $transaction->subscription->balance(),
        ];
    }

    /**
     * The amount is in the currency it was paid in; `amount_in_shekels` is
     * what it took off the balance.
     *
     * @return array{id: int, subscription: string, amount: string, currency: string, exchange_rate: ?string, amount_in_shekels: string, payment_method: string, bank_name: ?string, bank_received_on: ?string, sender_bank_name: ?string, status: string, recorded_at: string, voucher_number: ?string, reference_number: ?string, sender_name: ?string, notes: ?string}
     */
    public static function collectionData(SubscriptionTransaction $transaction): array
    {
        return [
            'id' => $transaction->id,
            'subscription' => $transaction->subscription->displayName(),
            'amount' => $transaction->currency_amount,
            'currency' => $transaction->currency->value,
            'exchange_rate' => $transaction->exchange_rate,
            'amount_in_shekels' => number_format(-(float) $transaction->amount, 2, '.', ''),
            'payment_method' => $transaction->payment_method->value,
            'bank_name' => $transaction->bank_name,
            'bank_received_on' => $transaction->bank_received_on?->toDateString(),
            'sender_bank_name' => $transaction->sender_bank_name,
            'status' => 'recorded',
            'recorded_at' => $transaction->created_at->toIso8601String(),
            'voucher_number' => LinePresenter::printedVoucherNumber($transaction),
            'reference_number' => $transaction->reference_number,
            'sender_name' => $transaction->sender_name,
            'notes' => $transaction->notes,
        ];
    }
}
