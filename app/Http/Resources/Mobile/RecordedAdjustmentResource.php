<?php

namespace App\Http\Resources\Mobile;

use App\Models\SubscriptionTransaction;
use App\Support\Ledger\LinePresenter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A charge, discount or clearing recorded from the field app, with the
 * subscription's balance after it.
 *
 * @property-read SubscriptionTransaction $resource
 */
class RecordedAdjustmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $transaction = $this->resource;

        return [
            'id' => $transaction->id,
            'type' => $transaction->type,
            'amount' => $transaction->amount,
            'voucher_number' => LinePresenter::displayVoucherNumber($transaction),
            'balance_after' => $transaction->subscription->balance(),
        ];
    }
}
