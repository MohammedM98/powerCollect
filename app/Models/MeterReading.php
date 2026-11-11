<?php

namespace App\Models;

use App\Enums\DiscountMethod;
use App\Enums\MeterReadingStatus;
use App\Enums\PermissionKey;
use App\Enums\UserRole;
use App\Models\Concerns\BelongsToBranch;
use Carbon\CarbonInterface;
use Database\Factories\MeterReadingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'subscription_id', 'branch_id', 'week_start', 'week_end', 'previous_reading', 'current_reading',
    'consumption', 'usual_consumption', 'unit_price', 'reading_fee', 'minimum_payment', 'discount_method', 'discount_value', 'discount_segment', 'discount_amount',
    'amount_due', 'status', 'recorded_by', 'notes', 'approved_by', 'approved_at', 'mobile_operation_id',
    'next_previous_reading', 'requires_reentry',
])]
class MeterReading extends Model
{
    /** @use HasFactory<MeterReadingFactory> */
    use BelongsToBranch, HasFactory;

    protected function casts(): array
    {
        return [
            'next_previous_reading' => 'float',
            'requires_reentry' => 'boolean',
            'week_start' => 'date',
            'week_end' => 'date',
            'previous_reading' => 'float',
            'current_reading' => 'float',
            'consumption' => 'float',
            'usual_consumption' => 'float',
            'status' => MeterReadingStatus::class,
            'unit_price' => 'decimal:2',
            'reading_fee' => 'decimal:2',
            'minimum_payment' => 'decimal:2',
            'discount_method' => DiscountMethod::class,
            'discount_value' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'amount_due' => 'decimal:2',
            'approved_at' => 'datetime',
        ];
    }

    /** The next week's baseline can differ from this week's billed meter. */
    public function nextPreviousReading(): float
    {
        return $this->next_previous_reading ?? $this->current_reading;
    }

    public function isPending(): bool
    {
        return $this->status === MeterReadingStatus::Pending;
    }

    /**
     * The active users who may approve this reading: those holding the
     * permission in its branch, and every Super Admin.
     *
     * @return Collection<int, User>
     */
    public function approvers(): Collection
    {
        return User::query()
            ->where('is_active', true)
            ->where(fn (Builder $query) => $query
                ->where('role', UserRole::SuperAdmin)
                ->orWhere(fn (Builder $inBranch) => $inBranch
                    ->where('branch_id', $this->branch_id)
                    ->whereHas('permissions', fn (Builder $permission) => $permission->where('key', PermissionKey::ApproveMeterReadings->value))))
            ->get();
    }

    /** Batch the successor count for lists; mutations still query their freshly loaded reading. */
    public function scopeWithLaterReadingsCount(Builder $query): void
    {
        $laterModel = new static;
        $laterModel->setTable('later_readings');
        $laterReadings = $laterModel->newQuery()->from('meter_readings as later_readings')
            ->whereColumn('later_readings.subscription_id', 'meter_readings.subscription_id')
            ->whereColumn('later_readings.week_start', '>', 'meter_readings.week_start');
        $query->addSelect([
            'later_readings_count' => (clone $laterReadings)->selectRaw('COUNT(*)'),
            'next_reading_week_start' => (clone $laterReadings)->selectRaw('MIN(week_start)'),
        ]);
    }

    public function laterReadingsCount(): int
    {
        return array_key_exists('later_readings_count', $this->attributes)
            ? (int) $this->attributes['later_readings_count']
            : $this->subscription->meterReadings()->where('week_start', '>', $this->week_start)->count();
    }

    public function hasLaterReadingBefore(CarbonInterface $weekStart): bool
    {
        if (array_key_exists('next_reading_week_start', $this->attributes)) {
            $next = $this->attributes['next_reading_week_start'];

            return $next !== null && $next < $weekStart->toDateString();
        }

        return $this->subscription->meterReadings()->where('week_start', '>', $this->week_start)
            ->where('week_start', '<', $weekStart)->exists();
    }

    /** The changes made to the reading after it was recorded, oldest first. */
    public function adjustments(): HasMany
    {
        return $this->hasMany(MeterReadingAdjustment::class)->orderBy('id');
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    /**
     * The reading's charge on the subscription's account while it stands:
     * none for a pending reading, or for one whose bill was cancelled.
     */
    public function chargeLine(): HasOne
    {
        return $this->hasOne(SubscriptionTransaction::class)
            ->where('type', SubscriptionTransaction::TYPE_METER_READING)
            ->whereNull('cancelled_at');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
