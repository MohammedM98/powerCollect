<?php

namespace App\Http\Resources\Mobile;

use App\Models\MeterReading;
use App\Support\Readings\ReadingConsumption;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A weekly reading recorded from the field app, and whether it waits for a reviewer.
 *
 * @property-read MeterReading $resource
 */
class MeterReadingResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $reading = $this->resource;

        return [
            'id' => $reading->id,
            'mobile_operation_id' => $reading->mobile_operation_id,
            'status' => $reading->status->value,
            'current_reading' => $reading->current_reading,
            // Far above what the subscription usually uses: it waits for a reviewer to confirm it.
            'unusual_consumption' => ReadingConsumption::isUnusual($reading),
        ];
    }
}
