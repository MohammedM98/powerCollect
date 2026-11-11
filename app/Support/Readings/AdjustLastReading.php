<?php

namespace App\Support\Readings;

use App\Enums\CorrectionReason;
use App\Enums\MeterReadingStatus;
use App\Models\MeterReading;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Ledger\CancelLine;
use Illuminate\Support\Facades\DB;

/**
 * Corrects a subscription's last reading, records the adjustment, and asks for the current reading again when needed.
 */
class AdjustLastReading
{
    /**
     * Correct the reading and recalculate its charges at the prices and
     * standing discount captured when it was recorded. An approved reading
     * goes back to review: its charge and discount lines are cancelled with
     * a reversal — kept on the statement — until it is approved again, when
     * the new lines are recorded under them. Returns whether that happened.
     */
    public static function correct(MeterReading $reading, float $currentReading, ?string $notes, User $editor): bool
    {
        return DB::transaction(function () use ($currentReading, $notes, $editor, $reading): bool {
            $before = ['currentReading' => $reading->requires_reentry ? null : $reading->current_reading];
            $changed = $reading->requires_reentry || round($currentReading, 2) !== round($reading->current_reading, 2);
            $reopened = RepriceReading::recalculate($reading, $reading->previous_reading, $currentReading, $notes, $editor);
            if ($changed) {
                AdjustLastReading::recordAdjustment($reading, 'reading_correction', $before, ['currentReading' => $currentReading], $editor);
            }

            return $reopened;
        });
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    public static function recordAdjustment(MeterReading $reading, string $kind, array $before, array $after, User $editor, ?string $reason = null): void
    {
        $reading->update(['adjustment_history' => [
            ...($reading->adjustment_history ?? []),
            ['kind' => $kind, 'before' => $before, 'after' => $after, 'reason' => $reason,
                'userId' => $editor->id, 'userName' => $editor->name, 'at' => now()->toIso8601String()],
        ]]);
    }

    /** Keep the old entry in the audit trail, but never bill it from a new baseline. */
    public static function requireCurrentReadingAgain(MeterReading $reading, float $previousReading, User $editor): void
    {
        AdjustLastReading::recordAdjustment($reading, 'current_reading_cleared', [
            'previousReading' => $reading->previous_reading, 'currentReading' => $reading->current_reading,
            'consumption' => $reading->consumption, 'amountDue' => $reading->amount_due,
        ], ['previousReading' => $previousReading, 'currentReading' => null], $editor);

        foreach ([SubscriptionTransaction::TYPE_METER_READING, SubscriptionTransaction::TYPE_READING_DISCOUNT] as $type) {
            $currentLine = ApproveReading::currentLine($reading, $type);
            if ($currentLine !== null) {
                CancelLine::cancelForReading($currentLine, $editor, CorrectionReason::ReadingCorrected);
            }
        }

        $reading->update([
            'previous_reading' => $previousReading, 'requires_reentry' => true,
            'consumption' => 0, 'reading_fee' => 0, 'amount_due' => 0, 'discount_amount' => 0,
            'usual_consumption' => null, 'status' => MeterReadingStatus::Pending,
            'approved_by' => null, 'approved_at' => null,
        ]);
    }
}
