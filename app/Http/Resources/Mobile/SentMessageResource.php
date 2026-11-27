<?php

namespace App\Http\Resources\Mobile;

use App\Models\SubscriptionMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A message queued from the field app and where it stands.
 *
 * @property-read SubscriptionMessage $resource
 */
class SentMessageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'status' => $this->resource->status->value,
            'phone' => $this->resource->phone,
            'error' => $this->resource->error,
        ];
    }
}
