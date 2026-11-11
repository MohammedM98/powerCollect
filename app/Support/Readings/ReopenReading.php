<?php

namespace App\Support\Readings;

use App\Enums\MeterReadingStatus;
use App\Models\MeterReading;

/**
 * Sends an approved reading back for review, so its week can be corrected and billed afresh.
 */
class ReopenReading
{
    /**
     * Send an approved reading back to review, as when its charge was
     * cancelled with the reading reopened. Its week can then be corrected,
     * and billed afresh once it is approved again. A reading still pending
     * is left as it is.
     */
    public static function handle(MeterReading $reading): void
    {
        if ($reading->isPending()) {
            return;
        }

        $reading->update(['status' => MeterReadingStatus::Pending, 'approved_by' => null, 'approved_at' => null]);
    }
}
