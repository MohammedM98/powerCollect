<?php

namespace App\Http\Resources\Mobile;

use App\Models\AuditNote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An audit note the branch sent the collector to answer.
 *
 * @property-read AuditNote $resource
 */
class AuditNoteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $note = $this->resource;

        return [
            'id' => $note->id,
            'closing_id' => $note->closing_id,
            'cash_box_id' => $note->cash_box_id,
            'body' => $note->body,
            'differences' => $note->differences,
            'difference_decisions' => $note->difference_decisions,
            'status' => $note->status,
            'assigned_to' => $note->assigned_to,
            'created_at' => $note->created_at,
            'updated_at' => $note->updated_at,
            'cash_box_payment_id' => $note->cash_box_payment_id,
        ];
    }
}
