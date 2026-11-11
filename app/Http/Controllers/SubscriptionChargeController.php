<?php

namespace App\Http\Controllers;

use App\Enums\ChargeType;
use App\Http\Requests\StoreSubscriptionChargeRequest;
use App\Models\Subscription;
use App\Notifications\ActionCompleted;
use App\Support\Ledger\LedgerAmounts;
use App\Support\Ledger\RecordCharge;
use Illuminate\Http\RedirectResponse;

class SubscriptionChargeController extends Controller
{
    /**
     * Record a manual charge, raising the subscription's balance straight away.
     */
    public function store(StoreSubscriptionChargeRequest $request, Subscription $subscription): RedirectResponse
    {
        $type = ChargeType::from($request->validated('type'));
        $charge = RecordCharge::handle($subscription, $request->user(), $type, $request->validated('amount'), $request->validated('notes'));

        $request->user()->notify(new ActionCompleted(
            'charge-recorded',
            sprintf('%s — %s %s شيكل', $subscription->displayName(), __($type->label()), LedgerAmounts::formatAmount($charge->amount)),
        ));

        return back()->with('status', 'charge-recorded');
    }
}
