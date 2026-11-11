<?php

namespace App\Support\Ledger;

use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Closing\BranchClosingWorkflow;
use Illuminate\Support\Str;

/**
 * Records a clearing (مقاصة): a service the subscription gave the company, taken off what they owe, with a voucher number like a cash payment.
 */
class RecordClearing
{
    /**
     * Take the value of a service the subscription gave the company off what
     * they owe; `$service` says what it was. It may leave them in credit. It
     * gets a voucher number, and keeps the paper voucher's number if given.
     */
    public static function handle(Subscription $subscription, User $recorder, float|string $amount, string $service, ?string $manualVoucherNumber = null): SubscriptionTransaction
    {
        return app(BranchClosingWorkflow::class)->locked($subscription->branch_id, fn (): SubscriptionTransaction => $subscription->transactions()->create([
            'recorded_by' => $recorder->id,
            'type' => SubscriptionTransaction::TYPE_CLEARING,
            'source_key' => 'clearing:'.Str::ulid(),
            'amount' => Money::negate($amount),
            'notes' => $service,
            // A clearing is vouched for like a cash payment: a number from the same sequence, and the paper voucher's if there is one.
            'voucher_number' => ClaimVoucherNumber::next(),
            'manual_voucher_number' => filled($manualVoucherNumber) ? trim($manualVoucherNumber) : null,
        ]));
    }
}
