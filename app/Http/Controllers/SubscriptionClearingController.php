<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSubscriptionClearingRequest;
use App\Models\Subscription;
use App\Notifications\ActionCompleted;
use App\Support\Ledger\LedgerAmounts;
use App\Support\Ledger\LinePresenter;
use App\Support\Ledger\WebPaymentOperation;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class SubscriptionClearingController extends Controller
{
    /**
     * Record a clearing (مقاصة): the subscription gave the company a service,
     * and its value comes off what they owe straight away. Its voucher, to
     * print, is flashed back.
     */
    public function store(StoreSubscriptionClearingRequest $request, Subscription $subscription, WebPaymentOperation $operation): RedirectResponse
    {
        $clearing = $operation->recordClearing($subscription, $request->user(), $request->validated());

        // A retried request returns the clearing already recorded, with its voucher; it was announced then.
        if ($clearing->wasRecentlyCreated) {
            $request->user()->notify(new ActionCompleted(
                'clearing-recorded',
                sprintf('%s — مقاصة %s شيكل', $subscription->displayName(), LedgerAmounts::formatAmount(ltrim($clearing->amount, '-'))),
            ));
        }

        Inertia::flash('recordedClearing', [
            'voucherNumber' => LinePresenter::displayVoucherNumber($clearing),
            'receiptUrl' => route('subscriptions.payments.receipt', [$subscription, $clearing]),
        ]);

        return back()->with('status', 'clearing-recorded');
    }
}
