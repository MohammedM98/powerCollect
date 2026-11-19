<?php

namespace App\Support\Ledger;

use App\Enums\ChargeType;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Closing\BranchClosingWorkflow;
use Illuminate\Support\Str;

/**
 * Records a charge entered by hand on a subscription's account.
 */
class RecordCharge
{
    /**
     * Record a manual charge on the subscription's account.
     */
    public static function handle(Subscription $subscription, User $recorder, ChargeType $type, float|string $amount, ?string $notes): SubscriptionTransaction
    {
        // Under the branch lock, as payments are, so each line's balance_after counts the one before it.
        return app(BranchClosingWorkflow::class)->locked($subscription->branch_id, fn (): SubscriptionTransaction => $subscription->transactions()->create([
            'recorded_by' => $recorder->id,
            'type' => $type->value,
            'source_key' => 'charge:'.Str::ulid(),
            'amount' => Money::amount($amount),
            'notes' => $notes,
        ]));
    }
}
