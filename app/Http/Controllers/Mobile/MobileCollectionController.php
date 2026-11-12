<?php

namespace App\Http\Controllers\Mobile;

use App\Enums\PaymentMethod;
use App\Enums\PermissionKey;
use App\Http\Controllers\Controller;
use App\Http\Requests\CheckMobileReferenceRequest;
use App\Http\Requests\ListMobileSubscriptionsRequest;
use App\Http\Requests\ListMobileTransactionsRequest;
use App\Http\Requests\StoreMobileCollectionRequest;
use App\Http\Resources\Mobile\CollectionResource;
use App\Http\Resources\Mobile\RecordedCollectionResource;
use App\Models\Closing;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Support\ArabicSearch;
use App\Support\Closing\BranchClosingWorkflow;
use App\Support\Closing\ClosingPeriods;
use App\Support\Ledger\LinePresenter;
use App\Support\Ledger\MobileCollectionData;
use App\Support\Ledger\Money;
use App\Support\Ledger\PaymentReferences;
use App\Support\Ledger\RecordPayment;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MobileCollectionController extends Controller
{
    /** How many of the latest statement lines the subscription page shows. */
    public const RECENT_TRANSACTIONS = 10;

    public function subscriptions(ListMobileSubscriptionsRequest $request): JsonResponse
    {

        $validated = $request->validated();
        $search = trim($validated['search'] ?? '');
        // Any subscription of the branch can pay, as on the website: a
        // suspended or disconnected one may still be settling their debt.
        $subscriptions = Subscription::query()
            ->whereNull('subscriptions.archived_at')
            ->visibleTo($request->user())
            ->with('meterBox:id,box_number')
            ->withSum('transactions as balance', 'amount')
            ->matchingSearch($search)
            // The account typed in full comes first, ahead of longer numbers containing it.
            ->when($search !== '', fn ($query) => $query->orderByRaw('case when account_number = ? then 0 else 1 end', [ArabicSearch::normalize($search)]))
            ->orderByDesc('balance')
            ->orderBy('id')
            ->paginate(25);

        return response()->json([
            'data' => $subscriptions->getCollection()->map(fn (Subscription $subscription): array => [
                'id' => $subscription->id,
                'full_name' => $subscription->displayName(),
                'account_number' => $subscription->account_number,
                'meter_box_number' => $subscription->meterBox?->box_number,
                'balance' => $subscription->balance ?? '0.00',
                'status' => $subscription->status->value,
                'status_label' => __($subscription->status->label()),
            ])->all(),
            'current_page' => $subscriptions->currentPage(),
            'last_page' => $subscriptions->lastPage(),
        ]);
    }

    /**
     * One subscription's account as the collector sees it before taking a
     * payment: who they are, what they owe, their last payment and the
     * latest lines of their statement, newest first.
     */
    public function show(Request $request, string $subscription): JsonResponse
    {
        return MobileCollectionData::show($request, $subscription);
    }

    public function transactions(ListMobileTransactionsRequest $request, string $subscription): JsonResponse
    {
        $subscription = Subscription::query()->visibleTo($request->user())->findOrFail($subscription);
        $this->authorize('view', $subscription);
        $transactions = $subscription->transactions()
            ->with(['meterReading', 'referenceTransaction', 'bankTransferAudit'])
            ->latest()->latest('id')->paginate(25);
        $first = $transactions->first();
        $balanceAfterInCents = $first ? Closing::cents($subscription->transactions()
            ->where(fn ($query) => $query->where('created_at', '<', $first->created_at)
                ->orWhere(fn ($sameTime) => $sameTime->where('created_at', $first->created_at)->where('id', '<=', $first->id)))
            ->sum('amount')) : 0;
        $lines = $transactions->getCollection()->map(function (SubscriptionTransaction $transaction) use (&$balanceAfterInCents): array {
            return MobileCollectionData::statementLine($transaction, $balanceAfterInCents);
        });

        return response()->json([
            'data' => $lines->all(),
            'balance' => Closing::money(Closing::cents($subscription->balance())),
            'current_page' => $transactions->currentPage(),
            'last_page' => $transactions->lastPage(),
            'total' => $transactions->total(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission(PermissionKey::RecordCollections), 403);

        // Today is the business day of the user's branch (in the business's time zone, up to its closing cut-off), not the UTC date.
        $periods = ClosingPeriods::for($request->user()->branch_id);
        $day = $periods->dayOf(now());
        [$from, $until] = $periods->utcRange($day, $day);

        $collections = SubscriptionTransaction::query()
            ->where('recorded_by', $request->user()->id)
            ->where('type', SubscriptionTransaction::TYPE_PAYMENT)
            ->whereNull('cancelled_at')
            ->where('created_at', '>=', $from)
            ->where('created_at', '<', $until)
            ->with('subscription:id,full_name,subscription_name,account_number')
            ->latest()
            ->latest('id')
            ->get();

        // Totals are in shekels, as the account is, whatever currency each payment came in.
        $methods = $request->user()->allowedPaymentMethods();

        return response()->json([
            'total' => Money::negate(Money::sum($collections->pluck('amount'))),
            'payment_methods' => array_map(fn (PaymentMethod $method): string => $method->value, $methods),
            ...(in_array(PaymentMethod::Cash, $methods, true) ? ['cash_total' => Money::negate(Money::sum($collections->filter(fn (SubscriptionTransaction $transaction): bool => $transaction->payment_method === PaymentMethod::Cash)->pluck('amount')))] : []),
            ...(in_array(PaymentMethod::BankTransfer, $methods, true) ? ['bank_transfer_total' => Money::negate(Money::sum($collections->filter(fn (SubscriptionTransaction $transaction): bool => $transaction->payment_method === PaymentMethod::BankTransfer)->pluck('amount')))] : []),
            'data' => $collections->map(fn (SubscriptionTransaction $transaction): CollectionResource => new CollectionResource($transaction))->all(),
        ]);
    }

    /**
     * Whether a transfer's reference is free or already on a payment, for the
     * app to say as it is typed. A repeated one is still recorded once the
     * collector confirms it (`confirm_duplicate_reference`).
     */
    public function referenceStatus(CheckMobileReferenceRequest $request): JsonResponse
    {

        $validated = $request->validated();
        $conflict = PaymentReferences::activeReferenceConflict($validated['reference_number']);
        $mayDiscloseConflict = $conflict !== null && PaymentReferences::mayDiscloseReferenceTo($conflict, $request->user());

        return response()->json([
            'available' => $conflict === null,
            'message' => $conflict === null ? 'الرقم المرجعي متاح.' : 'الرقم المرجعي مكرر: مسجَّل مسبقًا على دفعة أخرى.',
            'conflict' => $conflict ? [
                'voucher_number' => $mayDiscloseConflict ? LinePresenter::displayVoucherNumber($conflict) : null,
                'subscription_name' => $mayDiscloseConflict ? $conflict->subscription->displayName() : null,
            ] : null,
        ]);
    }

    public function store(StoreMobileCollectionRequest $request): JsonResponse
    {
        if ($existingTransaction = $request->existingTransaction()) {
            return response()->json(new RecordedCollectionResource($existingTransaction), 201);
        }

        $subscription = Subscription::query()->visibleTo($request->user())->findOrFail($request->integer('subscription_id'));
        $this->authorize('recordPayment', $subscription);
        $validated = $request->validated();

        try {
            $transaction = DB::transaction(function () use ($subscription, $request, $validated): SubscriptionTransaction {
                $transaction = RecordPayment::handle($subscription, $request->user(), [
                    'mobile_operation_id' => $validated['mobile_operation_id'],
                    'amount' => $validated['amount'],
                    'currency' => $validated['currency'],
                    'exchange_rate' => $validated['exchange_rate'] ?? null,
                    'payment_method' => $validated['payment_method'],
                    'bank_name' => $validated['bank_name'] ?? null,
                    'bank_received_on' => $validated['bank_received_on'] ?? null,
                    'sender_bank_name' => $validated['sender_bank_name'] ?? null,
                    'sender_name' => $validated['sender_name'] ?? null,
                    'reference_number' => $validated['reference_number'] ?? null,
                    'confirm_duplicate_reference' => (bool) ($validated['confirm_duplicate_reference'] ?? false),
                    'manual_voucher_number' => $validated['manual_voucher_number'] ?? null,
                    'cash_box' => $validated['cash_box'] ?? null,
                    'notes' => $validated['notes'] ?? null,
                ]);
                if (filled($validated['collected_at'] ?? null)) {
                    app(BranchClosingWorkflow::class)->syncOriginalTime($transaction, CarbonImmutable::parse($validated['collected_at']));
                }

                return $transaction;
            });
        } catch (UniqueConstraintViolationException $exception) {
            $transaction = $request->existingTransaction();

            if (! $transaction) {
                throw $exception;
            }

            abort_unless($transaction->recorded_by === $request->user()->id, 403);
        }

        return response()->json(new RecordedCollectionResource($transaction), 201);
    }
}
