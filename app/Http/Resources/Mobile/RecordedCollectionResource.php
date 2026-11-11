<?php

namespace App\Http\Resources\Mobile;

use Illuminate\Http\Request;

/**
 * A payment just recorded from the field app, with the subscription's balance after it, as the website's receipt shows it.
 */
class RecordedCollectionResource extends CollectionResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing('subscription');

        return [
            ...parent::toArray($request),
            'balance_after' => $this->resource->subscription->balance(),
        ];
    }
}
