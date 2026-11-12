<?php

namespace App\Http\Resources\Mobile;

use App\Enums\ReadingSubmissionStatus;
use App\Enums\SubscriptionStatus;
use App\Models\MeterReading;
use App\Models\ReadingAssignment;
use App\Models\ReadingSubmission;
use App\Models\Subscription;
use App\Support\Readings\FieldReadingAuthorization;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A meter box assigned to a reader for a reading week: the cycle's entry window, the box, and each subscription's last readings.
 *
 * @property-read ReadingAssignment $resource
 */
class ReadingAssignmentResource extends JsonResource
{
    /** `today` is the business day the app is on, which decides whether the cycle's entry is open. */
    public function __construct(ReadingAssignment $assignment, private string $today)
    {
        parent::__construct($assignment);
    }

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $assignment = $this->resource;

        $cycle = $assignment->cycle;
        $weekStart = $cycle->week_start;
        $subscriptions = Subscription::query()
            ->where('branch_id', $assignment->branch_id)
            ->where('meter_box_id', $assignment->meter_box_id)
            ->where('status', SubscriptionStatus::Active)
            ->whereNull('archived_at')
            ->with(['meterReadings' => fn ($query) => $query->whereDate('week_start', '<=', $weekStart->toDateString())->orderByDesc('week_start')->limit(4)])
            ->orderBy('account_number')
            ->get();
        $held = ReadingSubmission::query()->where('reading_assignment_id', $assignment->id)->where('user_id', $assignment->user_id)
            ->where('status', ReadingSubmissionStatus::NeedsReview)->latest('id')->get()->unique('subscription_id')->keyBy('subscription_id');

        return [
            'id' => $assignment->id,
            'version' => $assignment->version,
            'authorization' => FieldReadingAuthorization::issue($assignment),
            'cycle' => [
                'id' => $cycle->id,
                'week_start' => $weekStart->toDateString(),
                'week_end' => $cycle->week_end->toDateString(),
                'reading_date' => $cycle->reading_date->toDateString(),
                'entry_open' => $cycle->reading_date->toDateString() === $this->today,
                'entry_starts_at' => $cycle->reading_date->copy()->shiftTimezone(config('app.business_timezone'))->startOfDay()->toIso8601String(),
                'entry_ends_at' => $cycle->reading_date->copy()->shiftTimezone(config('app.business_timezone'))->endOfDay()->toIso8601String(),
                'sync_deadline' => $cycle->syncDeadline()->toIso8601String(),
            ],
            'meter_box' => [
                'id' => $assignment->meterBox->id,
                'number' => $assignment->meterBox->box_number,
                'name' => $assignment->meterBox->displayName(),
                'location' => $assignment->meterBox->location,
                'sub_area_id' => $assignment->meterBox->sub_area_id,
                'sub_area_name' => $assignment->meterBox->subArea?->name,
            ],
            'subscriptions' => $subscriptions->map(function (Subscription $subscription) use ($weekStart, $held): array {
                $current = $subscription->meterReadings->first(fn (MeterReading $reading): bool => $reading->week_start->equalTo($weekStart));
                $previous = $subscription->meterReadings->first(fn (MeterReading $reading): bool => $reading->week_start->lt($weekStart));
                $heldReading = $held->get($subscription->id);

                return [
                    'id' => $subscription->id,
                    'name' => $subscription->displayName(),
                    'account_number' => $subscription->account_number,
                    'previous_reading' => $current?->previous_reading ?? $previous?->nextPreviousReading() ?? $subscription->initial_reading,
                    'already_read' => $current !== null || $heldReading !== null,
                    'current_reading' => $current?->requires_reentry ? null : ($current?->current_reading ?? $heldReading?->current_reading),
                    'reading_status' => $current?->status?->value ?? ($heldReading === null ? null : ReadingSubmissionStatus::NeedsReview->value),
                    'recent_readings' => $subscription->meterReadings->filter(fn (MeterReading $reading): bool => $reading->week_start->lt($weekStart))->take(3)
                        ->map(fn (MeterReading $reading): array => ['week_start' => $reading->week_start->toDateString(), 'current_reading' => $reading->current_reading, 'consumption' => $reading->consumption])->values(),
                ];
            })->values(),
        ];
    }
}
