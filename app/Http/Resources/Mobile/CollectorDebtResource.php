<?php

namespace App\Http\Resources\Mobile;

use App\Models\CollectorDebt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * What a collector still owes from an earlier box.
 *
 * @property-read CollectorDebt $resource
 */
class CollectorDebtResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $debt = $this->resource;

        return [
            'id' => $debt->id,
            'cash_box_id' => $debt->cash_box_id,
            'user_id' => $debt->user_id,
            'branch_id' => $debt->branch_id,
            'currency' => $debt->currency,
            'amount' => $debt->amount,
            'remaining' => $debt->remaining,
            'created_at' => $debt->created_at,
            'updated_at' => $debt->updated_at,
        ];
    }
}
