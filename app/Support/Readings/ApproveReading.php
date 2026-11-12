<?php

namespace App\Support\Readings;

use App\Enums\CorrectionReason;
use App\Enums\MeterReadingStatus;
use App\Models\MeterReading;
use App\Models\StandingDiscount;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Ledger\CancelLine;
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

            ApproveReading::recordChargeLine($reading, $approver);
            ApproveReading::recordDiscountLine($reading, $approver);

            $meterReading->setRawAttributes($reading->getAttributes(), true);

            return true;
        });
    }

    /**
     * Bill the reading with the subscription's standing discount as it is now
     * (none when it was stopped), at the prices the reading was recorded
     * with. An approved reading's lines are rebilled to match — the old ones
     * cancelled with a reversal, kept on the statement, and the new ones
     * recorded under them — so the subscription's transactions show the change
     * straight away; a pending one's shows when it is approved.
     */
    public static function applyStandingDiscount(MeterReading $meterReading, ?StandingDiscount $discount, User $recorder): void
    {
        DB::transaction(function () use ($discount, $recorder, $meterReading): void {
            $reading = MeterReading::query()->lockForUpdate()->findOrFail($meterReading->id);

            $reading->update([
                'discount_method' => $discount?->method,
                'discount_value' => $discount?->value,
                'discount_segment' => $discount?->segment,
                ...($reading->requires_reentry
                    ? ['reading_fee' => '0.00', 'discount_amount' => '0.00', 'amount_due' => '0.00']
                    : ReadingCharges::chargesFor($reading->consumption, $reading->unit_price, $reading->minimum_payment, $discount?->method, $discount?->value)),
            ]);

            if (! $reading->isPending()) {
                $charge = ApproveReading::currentLine($reading, SubscriptionTransaction::TYPE_METER_READING);
                $discountLine = ApproveReading::currentLine($reading, SubscriptionTransaction::TYPE_READING_DISCOUNT);
                $chargeNeedsRebilling = $charge && $charge->amount !== ReadingCharges::amountBeforeDiscount($reading);

                if ($chargeNeedsRebilling) {
                    CancelLine::cancelForReading($charge, $recorder, CorrectionReason::StandingDiscountChanged);
                }

                if ($discountLine !== null) {
                    CancelLine::cancelForReading($discountLine, $recorder, CorrectionReason::StandingDiscountChanged);
                }

                if ($chargeNeedsRebilling) {
                    ApproveReading::recordChargeLine($reading, $recorder);
                }

                ApproveReading::recordDiscountLine($reading, $recorder);
            }

            $meterReading->setRawAttributes($reading->getAttributes(), true);
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
