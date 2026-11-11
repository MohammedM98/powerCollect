<?php

namespace App\Http\Controllers;

use App\Enums\DiscountMethod;
use App\Http\Requests\StoreSubscriptionDiscountRequest;
use App\Models\Subscription;
use App\Notifications\ActionCompleted;
use App\Support\Ledger\LedgerAmounts;
use App\Support\Ledger\RecordDiscount;
use Illuminate\Http\RedirectResponse;

class SubscriptionDiscountController extends Controller
{
    /**
     * Take a discount off what the subscription owes, by percentage,
     * kilowatts or shekels; it lowers the balance straight away.
     */
    public function store(StoreSubscriptionDiscountRequest $request, Subscription $subscription): RedirectResponse
    {
        $discount = RecordDiscount::handle(
            $subscription,
            $request->user(),
            DiscountMethod::from($request->validated('method')),
            $request->validated('value'),
            $request->validated('notes'),
        );

        $request->user()->notify(new ActionCompleted(
            'discount-recorded',
            sprintf('%s — %s شيكل', $subscription->displayName(), LedgerAmounts::formatAmount(ltrim($discount->amount, '-'))),
        ));

        return back()->with('status', 'discount-recorded');
    }
}
