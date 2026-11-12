<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSubscriptionClearingRequest;
use App\Models\Subscription;
use App\Notifications\ActionCompleted;
use App\Support\Ledger\LedgerAmounts;
use App\Support\Ledger\LinePresenter;
use App\Support\Ledger\RecordClearing;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class SubscriptionClearingController extends Controller
{
    /**
     * Record a clearing (مقاصة): the subscription gave the company a service,
     * and its value comes off what they owe straight away. Its voucher, to
     * print, is flashed back.
     */
    public function store(StoreSubscriptionClearingRequest $request, Subscription $subscription): RedirectResponse
    {
        $clearing = RecordClearing::handle($subscription, $request->user(), $request->validated('amount'), $request->validated('notes'), $request->validated('manual_voucher_number'));

        $request->user()->notify(new ActionCompleted(
            'clearing-recorded',
            sprintf('%s — مقاصة %s شيكل', $subscription->displayName(), LedgerAmounts::formatAmount(ltrim($clearing->amount, '-'))),
        ));

        Inertia::flash('recordedClearing', [
            'voucherNumber' => LinePresenter::displayVoucherNumber($clearing),
            'receiptUrl' => route('subscriptions.payments.receipt', [$subscription, $clearing]),
        ]);

        return back()->with('status', 'clearing-recorded');
    }
}
