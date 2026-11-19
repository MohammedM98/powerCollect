<?php

namespace App\Models;

use App\Enums\ReadingSubmissionStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A reading as the field app uploaded it, kept whatever became of it: saved
 * as the week's reading, held for a supervisor, or refused, and why.
 */
#[Fillable([
    'reading_cycle_id', 'reading_assignment_id', 'subscription_id', 'user_id', 'operation_id', 'assignment_version', 'current_reading', 'notes',
    'captured_at', 'received_at', 'device_id', 'status', 'issue', 'meter_reading_id', 'reviewed_by', 'reviewed_at', 'review_note',
])]
class ReadingSubmission extends Model
{
    /** Why an upload was held or refused, and how it reads. */
    public const ISSUES = [
        'not_your_assignment' => 'This meter box is not assigned to you',
        'invalid_authorization' => 'The work authorization is not valid; download the assignments again',
        'not_on_box' => 'The subscriber is not on this meter box or their service is not active',
        'assignment_changed' => 'The meter box was reassigned after it was downloaded; the reading is kept for review',
        'outside_reading_day' => 'The reading was recorded outside the reading day',
        'untrusted_clock' => 'The device\'s time does not match the server\'s',
        'late_sync' => 'The reading arrived after the sync deadline',
        'cycle_closed' => 'The reading cycle is closed',
        'week_locked' => 'Only the latest week\'s readings can be saved; earlier weeks are view only.',
        'already_read' => 'The subscriber already has a reading this week',
        'later_week_read' => 'The subscriber has a reading for a later week',
        'reentry_pending' => 'Enter the pending current reading before recording a new week.',
        'below_previous' => 'The reading is below the previous reading',
        'impossible_consumption' => 'The consumption is above any possible weekly consumption',
    ];

    protected function casts(): array
    {
        return [
            'status' => ReadingSubmissionStatus::class,
            'current_reading' => 'float',
            'captured_at' => 'datetime',
            'received_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(ReadingCycle::class, 'reading_cycle_id');
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(ReadingAssignment::class, 'reading_assignment_id');
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function meterReading(): BelongsTo
    {
        return $this->belongsTo(MeterReading::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function issueMessage(): ?string
    {
        return $this->issue === null ? null : (isset(self::ISSUES[$this->issue]) ? __(self::ISSUES[$this->issue]) : $this->issue);
    }
}
