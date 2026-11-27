<?php

namespace App\Support\Readings;

use App\Enums\MeterReadingStatus;
use App\Models\MeterReading;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Closing\BranchLock;
use App\Support\Ledger\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Approves a reading and bills it: the charge line and, when there is one, the standing discount beside it.
 */
class ApproveReading
{
    /**
     * Approve the reading: it is locked from then on, and its amount is
     * charged to the subscription's transactions — the week's full bill, with
     * its standing discount beside it as a line of its own (خصم القراءات الأسبوعية). A
     * reading that is already approved is left as it is, and so is an unusual
     * one the approver has not confirmed. Returns whether this approved it.
     */
    public static function handle(MeterReading $meterReading, User $approver, bool $confirmUnusual = false): bool
    {
        return DB::transaction(function () use ($approver, $confirmUnusual, $meterReading): bool {
            $reading = MeterReading::query()->lockForUpdate()->findOrFail($meterReading->id);

            if ($reading->requires_reentry || ! $reading->isPending() || (ReadingConsumption::isUnusual($reading) && ! $confirmUnusual)) {
                return false;
            }

            $reading->update([
                'status' => MeterReadingStatus::Approved,
                'approved_by' => $approver->id,
                'approved_at' => now(),
            ]);

            // The bill lines are written under the branch lock, as payments are, so each line's balance_after counts the one before it.
            BranchLock::run($reading->subscription->branch_id, function () use ($reading, $approver): void {
                ApproveReading::recordChargeLine($reading, $approver);
                ApproveReading::recordDiscountLine($reading, $approver);
            });

            $meterReading->setRawAttributes($reading->getAttributes(), true);

            return true;
        });
    }

    /**
     * Charge the reading's week to the subscription's account: the full bill,
     * before its standing discount.
     */
    public static function recordChargeLine(MeterReading $reading, User $recorder): void
    {
        if (ApproveReading::sourceWasBilled($reading, ReadingCharges::chargeSourceKey($reading))) {
            return;
        }

        $reading->subscription->transactions()->create([
            'recorded_by' => $recorder->id,
            'meter_reading_id' => $reading->id,
            'corrects_id' => ApproveReading::lastCancelledLineId($reading, SubscriptionTransaction::TYPE_METER_READING),
            'type' => SubscriptionTransaction::TYPE_METER_READING,
            'source_key' => ReadingCharges::chargeSourceKey($reading),
            'amount' => ReadingCharges::amountBeforeDiscount($reading),
            'currency_amount' => ReadingCharges::amountBeforeDiscount($reading),
            'billed_consumption' => $reading->consumption,
        ]);
    }

    /**
     * Take the reading's standing discount off the subscription's account as
     * a line of its own (خصم القراءات الأسبوعية) beside the reading's charge, naming the
     * customer segment it was given to in its details; a reading billed
     * without one takes nothing off.
     */
    public static function recordDiscountLine(MeterReading $reading, User $recorder): void
    {
        if (! Money::decimal($reading->discount_amount)->isPositive()
            || ApproveReading::sourceWasBilled($reading, ReadingCharges::discountSourceKey($reading))
            || ApproveReading::currentLine($reading, SubscriptionTransaction::TYPE_METER_READING, lockForUpdate: true) === null) {
            return;
        }

        $reading->subscription->transactions()->create([
            'recorded_by' => $recorder->id,
            'meter_reading_id' => $reading->id,
            'corrects_id' => ApproveReading::lastCancelledLineId($reading, SubscriptionTransaction::TYPE_READING_DISCOUNT),
            'type' => SubscriptionTransaction::TYPE_READING_DISCOUNT,
            'source_key' => ReadingCharges::discountSourceKey($reading),
            'amount' => Money::negate($reading->discount_amount),
            'currency_amount' => $reading->discount_amount,
            'discount_method' => $reading->discount_method,
            'discount_value' => $reading->discount_value,
            'notes' => $reading->discount_segment,
        ]);
    }

    /**
     * A line deleted by hand keeps its source key so this reading can never
     * bill that component again. Automatic reading corrections free the key
     * before recording their replacement.
     */
    public static function sourceWasBilled(MeterReading $reading, string $sourceKey): bool
    {
        return SubscriptionTransaction::query()->where('source_key', $sourceKey)->exists();
    }

    /**
     * The reading's charge or standing-discount line that stands on the
     * subscription's account, if it has been billed.
     */
    public static function currentLine(MeterReading $reading, string $type, bool $lockForUpdate = false): ?SubscriptionTransaction
    {
        return SubscriptionTransaction::query()
            ->where('meter_reading_id', $reading->id)
            ->where('type', $type)
            ->whereNull('cancelled_at')
            ->when($lockForUpdate, fn (Builder $query): Builder => $query->lockForUpdate())
            ->first();
    }

    /**
     * The reading's last cancelled line of the given type that nothing has
     * replaced yet, which the line billed next corrects.
     */
    public static function lastCancelledLineId(MeterReading $reading, string $type): ?int
    {
        return SubscriptionTransaction::query()
            ->where('meter_reading_id', $reading->id)
            ->where('type', $type)
            ->whereNotNull('cancelled_at')
            ->whereDoesntHave('correction')
            ->latest('id')
            ->value('id');
    }
}
