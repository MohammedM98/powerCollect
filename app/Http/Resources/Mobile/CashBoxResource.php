<?php

namespace App\Http\Resources\Mobile;

use App\Models\CashBox;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One of the collector's cash boxes as the field app shows it: still open
 * (with no closing time) while it can be edited, its stage and totals, and
 * its entries. The expected counts are only sent once the collector has
 * counted the box.
 *
 * @property-read CashBox $resource
 */
class CashBoxResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $box = $this->resource;
        $editable = $box->isEditable();

        return [
            'id' => $box->id,
            'number' => $box->number,
            'branch_id' => $box->branch_id,
            'user_id' => $box->user_id,
            'kind' => $box->kind,
            'open_key' => $box->open_key,
            'closing_id' => $box->closing_id,
            'status' => $editable ? 'open' : $box->status,
            'opened_at' => $box->opened_at,
            'closed_at' => $editable ? null : $box->closed_at,
            'close_reason' => $box->close_reason,
            'collector_counts' => $box->collector_counts,
            'head_counts' => $box->head_counts,
            'expected_counts' => $box->collector_counts ? $box->expected_counts : null,
            'decisions' => $box->decisions,
            'reason' => $box->reason,
            'received_by' => $box->received_by,
            'received_at' => $box->received_at,
            'confirmed_at' => $box->confirmed_at,
            'created_at' => $box->created_at,
            'updated_at' => $box->updated_at,
            'type' => $box->type,
            'collector_submitted_at' => $box->collector_submitted_at,
            'received_in_closing_id' => $box->received_in_closing_id,
            'sent_at' => $box->sent_at,
            'sent_by' => $box->sent_by,
            'send_note' => $box->send_note,
            'payments' => CashBoxEntryResource::collection($box->payments),
            'stage' => $box->stage(),
            'totals' => $box->totals(),
        ];
    }
}
