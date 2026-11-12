<?php

namespace App\Models;

use Database\Factories\SubscriptionArchiveEventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One time a subscription was archived (its service ended) or restored,
 * who did it and why. Rows are only ever added.
 */
#[Fillable(['subscription_id', 'action', 'user_id', 'user_name', 'reason', 'service_ended_on'])]
class SubscriptionArchiveEvent extends Model
{
    /** @use HasFactory<SubscriptionArchiveEventFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    public const ARCHIVE = 'archive';

    public const RESTORE = 'restore';

    protected function casts(): array
    {
        return [
            'service_ended_on' => 'date:Y-m-d',
            'created_at' => 'datetime',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The event as the archive notice lists it.
     *
     * @return array<string, mixed>
     */
    public function historyEntry(): array
    {
        return array_filter([
            'action' => $this->action,
            'at' => $this->created_at?->toIso8601String(),
            'user_id' => $this->user_id,
            'user_name' => $this->user_name,
            'reason' => $this->reason,
            'service_ended_on' => $this->service_ended_on?->toDateString(),
        ], fn (mixed $value): bool => $value !== null);
    }
}
