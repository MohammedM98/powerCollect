<?php

namespace App\Http\Resources\Mobile;

use App\Models\SplitPayment;
use App\Models\SubscriptionTransaction;
use App\Support\Ledger\LinePresenter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A bank transfer split across subscriptions from the field app, with each
 * share, its receipt and its subscription's balance after it.
 *
 * @property-read SplitPayment $resource
 */
class RecordedSplitPaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $split = $this->resource;

        return [
            'id' => $split->id,
            'status' => 'recorded',
            'total_amount' => $split->total_amount,
            'reference_number' => $split->reference_number,
            'bank_name' => $split->bank_name,
            'sender_bank_name' => $split->sender_bank_name,
            'sender_name' => $split->sender_name,
            'notes' => $split->notes,
            'bank_received_on' => $split->bank_received_on?->toDateString(),
            'parts' => $split->payments()->with('subscription')->get()->map(fn (SubscriptionTransaction $payment): array => [
                'id' => $payment->id,
                'subscription_id' => $payment->subscription_id,
                'subscription' => $payment->subscription->displayName(),
                'amount' => $payment->currency_amount,
                'balance_after' => $payment->subscription->balance(),
                'voucher_number' => LinePresenter::printedVoucherNumber($payment),
            ]),
        ];
    }
}
