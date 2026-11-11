<?php

namespace App\Http\Resources\Mobile;

use App\Models\SubscriptionTransaction;
use App\Support\Ledger\LinePresenter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A payment recorded from the field app. The amount is in the currency it
 * was paid in; amount_in_shekels is what it took off the balance.
 *
 * @property-read SubscriptionTransaction $resource
 */
class CollectionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $transaction = $this->resource;

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
