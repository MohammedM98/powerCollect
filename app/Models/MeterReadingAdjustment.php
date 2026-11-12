<?php

namespace App\Models;

use Database\Factories\MeterReadingAdjustmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One change made to a reading after it was recorded: a correction of its
 * current reading, a baseline reset or a price change, with the values
 * before and after, who made it and why. Rows are only ever added.
 */
#[Fillable(['meter_reading_id', 'user_id', 'user_name', 'kind', 'before', 'after', 'reason'])]
class MeterReadingAdjustment extends Model
{
    /** @use HasFactory<MeterReadingAdjustmentFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'before' => 'array',
            'after' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function reading(): BelongsTo
    {
        return $this->belongsTo(MeterReading::class, 'meter_reading_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The entry as the reading history shows it.
     *
     * @return array{kind: string, before: array<string, mixed>, after: array<string, mixed>, reason: ?string, userId: ?int, userName: ?string, at: ?string}
     */
    public function historyEntry(): array
    {
        return [
            'kind' => $this->kind,
            'before' => $this->before,
            'after' => $this->after,
            'reason' => $this->reason,
            'userId' => $this->user_id,
            'userName' => $this->user_name,
            'at' => $this->created_at?->toIso8601String(),
        ];
    }
}
