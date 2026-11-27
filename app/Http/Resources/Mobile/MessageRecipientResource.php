<?php

namespace App\Http\Resources\Mobile;

use App\Models\Subscription;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A subscriber the collector can message, with the phone it goes to.
 *
 * @property-read Subscription $resource
 */
class MessageRecipientResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'full_name' => $this->resource->displayName(),
            'account_number' => $this->resource->account_number,
            'phone' => $this->resource->contactPhone(),
        ];
    }
}
