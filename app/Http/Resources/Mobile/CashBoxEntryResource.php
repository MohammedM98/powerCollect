<?php

namespace App\Http\Resources\Mobile;

use App\Models\CashBoxPayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An entry in a collector's cash box, with the payment it stands for and
 * that payment's subscription.
 *
 * @property-read CashBoxPayment $resource
 */
class CashBoxEntryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $entry = $this->resource;
        $transaction = $entry->transaction;

        return [
            'id' => $entry->id,
            'cash_box_id' => $entry->cash_box_id,
            'subscription_transaction_id' => $entry->subscription_transaction_id,
            'currency' => $entry->currency,
            'amount' => $entry->amount,
            'method' => $entry->method,
            'status' => $entry->status,
            'occurred_at' => $entry->occurred_at,
            'synced_at' => $entry->synced_at,
            'is_late' => $entry->is_late,
            'confirmed_in_closing_id' => $entry->confirmed_in_closing_id,
            'confirmed_by' => $entry->confirmed_by,
            'confirmed_at' => $entry->confirmed_at,
            'created_at' => $entry->created_at,
            'updated_at' => $entry->updated_at,
            'transaction' => $transaction === null ? null : [
                'id' => $transaction->id,
                'subscription_id' => $transaction->subscription_id,
                'reference_number' => $transaction->reference_number,
                'bank_name' => $transaction->bank_name,
                'sender_bank_name' => $transaction->sender_bank_name,
                'voucher_number' => $transaction->voucher_number,
                'notes' => $transaction->notes,
                'status' => $transaction->status,
                'subscription' => $transaction->subscription === null ? null : [
                    'id' => $transaction->subscription->id,
                    'full_name' => $transaction->subscription->full_name,
                    'subscription_name' => $transaction->subscription->subscription_name,
                    'account_number' => $transaction->subscription->account_number,
                ],
            ],
        ];
    }
}
