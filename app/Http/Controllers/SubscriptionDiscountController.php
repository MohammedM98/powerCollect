<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSubscriptionDiscountRequest;
use App\Models\Subscription;
use App\Notifications\ActionCompleted;
use App\Support\Ledger\LedgerAmounts;
use App\Support\Ledger\WebPaymentOperation;
use Illuminate\Http\RedirectResponse;

class SubscriptionDiscountController extends Controller
{
    /**
     * Take a discount off what the subscription owes, by percentage,
     * kilowatts or shekels; it lowers the balance straight away.
     */
    public function store(StoreSubscriptionDiscountRequest $request, Subscription $subscription, WebPaymentOperation $operation): RedirectResponse
    {
        $discount = $operation->recordDiscount($subscription, $request->user(), $request->validated());

        // A retried request returns the discount already recorded; it was announced then.
        if ($discount->wasRecentlyCreated) {
            $request->user()->notify(new ActionCompleted(
                'discount-recorded',
                sprintf('%s — %s شيكل', $subscription->displayName(), LedgerAmounts::formatAmount(ltrim($discount->amount, '-'))),
            ));
        }

        return back()->with('status', 'discount-recorded');
    }
}
