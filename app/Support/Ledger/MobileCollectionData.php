<?php

namespace App\Support\Ledger;

use App\Enums\AccountingType;
use App\Enums\ChargeType;
use App\Enums\PaymentMethod;
use App\Enums\PermissionKey;
use App\Http\Controllers\Mobile\MobileCollectionController;
use App\Http\Resources\Mobile\CollectionResource;
use App\Models\Closing;
use App\Models\MessageBatch;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Support\Messaging\SmsGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request; /**
 * The collections data the field app receives: subscriptions, their statements and today's payments.
 */
class MobileCollectionData
{
    /** @return array<string, mixed> */
    public static function statementLine(SubscriptionTransaction $transaction, int &$balanceAfterInCents): array
    {
        $entry = [
            'id' => $transaction->id,
            'date' => $transaction->created_at->copy()->setTimezone(config('app.business_timezone'))->toDateString(),
            'recorded_at' => $transaction->created_at->copy()->setTimezone(config('app.business_timezone'))->format('Y-m-d H:i'),
            'bank_received_on' => $transaction->bank_received_on?->toDateString(),
            'type' => $transaction->type,
            'type_label' => LinePresenter::typeLabel($transaction),
            'description' => LinePresenter::description($transaction),
            'notes' => $transaction->notes,
            'voucher_number' => LinePresenter::displayVoucherNumber($transaction),
            'reference_number' => $transaction->reference_number,
            'amount' => Closing::money(abs(Closing::cents($transaction->amount))),
            'is_credit' => (float) $transaction->amount < 0,
            'is_cancelled' => $transaction->isCancelled(),
            'balance_after' => Closing::money($balanceAfterInCents),
        ];
        $balanceAfterInCents -= Closing::cents($transaction->amount);

        return $entry;
    }

    public static function show(Request $request, string $subscription): JsonResponse
    {
        abort_unless($request->user()->can('recordAnyPayment', Subscription::class)
            || $request->user()->can('viewAny', Subscription::class)
            || $request->user()->hasAnyPermission(PermissionKey::AddCharges, PermissionKey::AddDiscounts, PermissionKey::AddClearings), 403);

        $subscription = Subscription::query()
            ->whereNull('subscriptions.archived_at')
            ->visibleTo($request->user())
            ->with(['branch.area', 'meterBox.subArea', 'tariff', 'circuitBreaker', 'latestMeterReading'])
            ->findOrFail($subscription);
        $lastReading = $subscription->latestMeterReading;
        $balanceInCents = Closing::cents($subscription->balance());
        $canViewHistory = $request->user()->can('view', $subscription);
        $lastPayment = $canViewHistory ? $subscription->transactions()
            ->where('type', SubscriptionTransaction::TYPE_PAYMENT)
            ->whereNull('cancelled_at')
            ->latest()
            ->latest('id')
            ->first() : null;
        $recentTransactions = $canViewHistory ? $subscription->transactions()
            ->with(['meterReading', 'referenceTransaction', 'bankTransferAudit'])
            ->latest()
            ->latest('id')
            ->limit(MobileCollectionController::RECENT_TRANSACTIONS)
            ->get() : collect();

        // Walk back from the current balance, so each line shows the balance it left.
        $balanceAfterInCents = $balanceInCents;
        $transactions = $recentTransactions->map(function (SubscriptionTransaction $transaction) use (&$balanceAfterInCents): array {
            return MobileCollectionData::statementLine($transaction, $balanceAfterInCents);
        });

        return response()->json([
            'subscription' => [
                'id' => $subscription->id,
                'full_name' => $subscription->displayName(),
                'subscriber_name' => $subscription->full_name,
                'subscription_name' => $subscription->subscription_name,
                'national_id' => $subscription->national_id,
                'personal_phone' => $subscription->phone,
                'account_number' => $subscription->account_number,
                'meter_box_number' => $subscription->meterBox?->box_number,
                'meter_box_name' => $subscription->meterBox?->displayName(),
                'meter_box_location' => $subscription->meterBox?->location,
                'phone' => $subscription->contactPhone(),
                'address' => $subscription->address,
                'area_name' => $subscription->branch?->area?->name,
                'sub_area_name' => $subscription->meterBox?->subArea?->name,
                'balance' => Closing::money($balanceInCents),
                'status' => $subscription->status->value,
                'status_label' => __($subscription->status->label()),
                'accounting_type' => $subscription->accounting_type->value,
                'accounting_type_label' => match ($subscription->accounting_type) {
                    AccountingType::Weekly => __('Weekly', locale: 'ar'),
                    AccountingType::Monthly => __('Monthly', locale: 'ar'),
                },
                'subscription_date' => $subscription->subscription_date?->toDateString(),
                'tariff_name' => __($subscription->tariff->category->label()),
                'kilowatt_price' => $subscription->kilowattPrice(),
                'minimum_payment' => number_format((float) $subscription->weeklyMinimumPayment(), 2, '.', ''),
                'circuit_breaker_ampere' => $subscription->circuitBreaker?->ampere,
                'initial_reading' => $subscription->initial_reading,
            ],
            'last_reading' => $lastReading ? [
                'id' => $lastReading->id,
                'week_start' => $lastReading->week_start->toDateString(),
                'week_end' => $lastReading->week_end->toDateString(),
                'previous_reading' => $lastReading->previous_reading,
                'current_reading' => $lastReading->current_reading,
                'consumption' => $lastReading->consumption,
                'status' => $lastReading->status->value,
                'status_label' => __($lastReading->status->label()),
            ] : null,
            'last_payment' => $lastPayment ? new CollectionResource($lastPayment->setRelation('subscription', $subscription)) : null,
            'transactions' => $transactions->all(),
            'permissions' => [
                'view_history' => $canViewHistory,
                'record_payment' => $request->user()->can('recordPayment', $subscription),
                'record_split_payment' => $request->user()->can('recordSplitPayment', Subscription::class) && $request->user()->can('recordPayment', $subscription),
                'add_charge' => $request->user()->can('addCharge', $subscription),
                'add_discount' => $request->user()->can('addDiscount', $subscription),
                'add_clearing' => $request->user()->can('addClearing', $subscription),
                'payment_methods' => array_map(fn (PaymentMethod $method): string => $method->value, $request->user()->allowedPaymentMethods()),
            ],
            'charge_types' => $request->user()->can('addCharge', $subscription) ? ChargeType::formOptions() : [],
            'messaging' => [
                'can_send' => $request->user()->can('create', MessageBatch::class),
                'can_view_history' => $request->user()->can('viewAny', MessageBatch::class),
                'sms_available' => app(SmsGateway::class)->deliversMessages(),
            ],
        ]);
    }
}
