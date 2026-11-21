<?php

namespace App\Http\Controllers;

use App\Enums\ChargeType;
use App\Http\Requests\StoreSubscriptionChargeRequest;
use App\Models\Subscription;
use App\Notifications\ActionCompleted;
use App\Support\Ledger\LedgerAmounts;
use App\Support\Ledger\WebPaymentOperation;
use Illuminate\Http\RedirectResponse;

class SubscriptionChargeController extends Controller
{
    /**
     * Record a manual charge, raising the subscription's balance straight away;
     * once per form, so a double click records one charge.
     */
    public function store(StoreSubscriptionChargeRequest $request, Subscription $subscription, WebPaymentOperation $operation): RedirectResponse
    {
        $type = ChargeType::from($request->validated('type'));
        $charge = $operation->recordCharge($subscription, $request->user(), $request->validated());

        // A retried request returns the charge already recorded; it was announced then.
        if ($charge->wasRecentlyCreated) {
            $request->user()->notify(new ActionCompleted(
                'charge-recorded',
                sprintf('%s — %s %s شيكل', $subscription->displayName(), __($type->label()), LedgerAmounts::formatAmount($charge->amount)),
            ));
        }

        return back()->with('status', 'charge-recorded');
    }
}
