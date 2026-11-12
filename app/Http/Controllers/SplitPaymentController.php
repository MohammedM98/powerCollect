<?php

namespace App\Http\Controllers;

use App\Enums\AuditAction;
use App\Enums\PermissionKey;
use App\Http\Requests\CheckSplitPaymentReferenceRequest;
use App\Http\Requests\StoreSplitPaymentRequest;
use App\Http\Requests\UpdateSplitPaymentRequest;
use App\Models\SplitPayment;
use App\Models\SubscriptionTransaction;
use App\Notifications\ActionCompleted;
use App\Support\Ledger\LedgerAmounts;
use App\Support\Ledger\LineHistory;
use App\Support\Ledger\LinePresenter;
use App\Support\Ledger\Money;
use App\Support\Ledger\PaymentReferences;
use App\Support\Reports\DailySeries;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SplitPaymentController extends Controller
{
    public function edit(Request $request, SplitPayment $splitPayment): JsonResponse
    {
        $this->authorize('update', $splitPayment);

        return response()->json($splitPayment->editingDetails($request->user()));
    }

    public function update(UpdateSplitPaymentRequest $request, SplitPayment $splitPayment): RedirectResponse
    {
        $splitPayment->revise($request->user(), $request->validated());
        $request->user()->notify(new ActionCompleted('transaction-amended', 'تعديل الحوالة المقسّمة '.$splitPayment->reference_number));

        return back()->with('status', 'transaction-amended');
    }

    /**
     * Whether the split transfer's reference is free, or which payment holds
     * it already, for the form to say as it is typed. A reference already
     * used is allowed, once the user confirms it.
     */
    public function referenceStatus(CheckSplitPaymentReferenceRequest $request): JsonResponse
    {

        $validated = $request->validated();
        $conflict = PaymentReferences::activeReferenceConflict($validated['reference_number']);
        $outsideDomain = $conflict && ! PaymentReferences::mayDiscloseReferenceTo($conflict, $request->user());

        return response()->json([
            'available' => $conflict === null,
            'conflict' => $outsideDomain ? ['id' => null, 'voucherNumber' => null, 'subscriptionName' => 'دفعة أخرى مسجّلة مسبقًا', 'url' => null] : ($conflict ? [
                'id' => $conflict->id,
                'voucherNumber' => LinePresenter::displayVoucherNumber($conflict),
                'subscriptionName' => $conflict->subscription->displayName(),
                'url' => route('subscriptions.statement', [$conflict->subscription, 'transaction' => $conflict->id]),
            ] : null),
        ]);
    }

    /**
     * Record one bank transfer divided between several subscriptions: a
     * payment on each, all together or none. The payments page shows what was
     * recorded, with each part's receipt.
     */
    public function store(StoreSplitPaymentRequest $request): RedirectResponse
    {
        $actor = $request->user();
        $split = SplitPayment::record($actor, $request->safe()->except('parts'), $request->parts());
        $payments = $split->payments()->with('subscription')->get();

        $actor->notify(new ActionCompleted(
            'split-payment-recorded',
            sprintf('%s — %s شيكل على %d مشتركين', $split->sender_name, LedgerAmounts::formatAmount($split->total_amount), $payments->count()),
        ));

        Inertia::flash('recordedSplitPayment', [
            'id' => $split->id,
            'total' => LedgerAmounts::formatAmount($split->total_amount),
            'reference' => $split->reference_number,
            'bankName' => $split->bank_name,
            'bankReceivedOn' => $split->bank_received_on?->toDateString(),
            'senderName' => $split->sender_name,
            'parts' => $payments->map(fn (SubscriptionTransaction $payment): array => [
                'subscriptionName' => $payment->subscription->displayName(),
                'accountNumber' => $payment->subscription->account_number,
                'amount' => LedgerAmounts::formatAmount(ltrim($payment->amount, '-')),
                'balance' => $payment->subscription->balance(),
                'receiptUrl' => route('subscriptions.payments.receipt', [$payment->subscription, $payment]),
            ])->values()->all(),
        ]);

        return back()->with('status', 'split-payment-recorded');
    }

    /**
     * A split transfer's details, as the statement, the ledger and the closing
     * show them: what was transferred, who sent it, and the parts it became.
     * A user sees the parts of their own branch's subscriptions (all of them,
     * for the Super Admin and those who review every branch's closings); the
     * others are only counted.
     */
    public function show(Request $request, SplitPayment $splitPayment): JsonResponse
    {
        $this->authorize('view', $splitPayment);

        $actor = $request->user();
        $seesEveryBranch = $actor->isSuperAdmin() || $actor->hasPermission(PermissionKey::ViewAllClosings) || $actor->hasPermission(PermissionKey::AuditClosings);
        $payments = $splitPayment->payments()->with(['subscription', 'cancelledBy'])->get();
        [$visible, $hidden] = $payments->partition(fn (SubscriptionTransaction $payment): bool => $actor->isSuperAdmin() || ($actor->hasFinancialAuditAccess()
            ? ($actor->auditIncludesBranch($payment->subscription->branch_id) && LineHistory::isInClosedDay($payment))
            || ($payment->subscription->branch_id === $actor->workBranchId() && ! $actor->isAuditOnly())
            : ($seesEveryBranch || $payment->subscription->branch_id === $actor->workBranchId())));
        abort_if($actor->hasFinancialAuditAccess() && $visible->isEmpty(), 404);
        $standingTotal = $splitPayment->standingTotal();

        return response()->json([
            'id' => $splitPayment->id,
            'total' => LedgerAmounts::formatAmount($splitPayment->total_amount),
            'standingTotal' => LedgerAmounts::formatAmount($standingTotal),
            // Every part still stands and together they are what was transferred.
            'isComplete' => Money::decimal($standingTotal)->isEqualTo($splitPayment->total_amount),
            'bankName' => $splitPayment->bank_name,
            'bankReceivedOn' => $splitPayment->bank_received_on?->toDateString(),
            'senderName' => $splitPayment->sender_name,
            'referenceNumber' => $splitPayment->reference_number,
            'recordedByName' => $splitPayment->recordedBy?->name,
            'date' => DailySeries::localDate($splitPayment->created_at),
            'time' => DailySeries::localTime($splitPayment->created_at),
            'partsCount' => $payments->count(),
            'parts' => $visible->map(fn (SubscriptionTransaction $payment): array => [
                'id' => $payment->id,
                'subscriptionName' => $payment->subscription->displayName(),
                'accountNumber' => $payment->subscription->account_number,
                'amount' => LedgerAmounts::formatAmount(ltrim($payment->amount, '-')),
                'isCancelled' => $payment->isCancelled(),
                'cancellationLabel' => $payment->cancellation_reason ? __($payment->cancellation_reason->label()) : null,
                'receiptUrl' => (! $actor->hasFinancialAuditAccess() || $actor->canAuditAction(AuditAction::PrintReports)) && ($actor->can('view', $payment->subscription) || $actor->can('recordPayment', $payment->subscription))
                    ? route('subscriptions.payments.receipt', [$payment->subscription, $payment])
                    : null,
            ])->values()->all(),
            'hiddenPartsCount' => $hidden->count(),
            'hiddenPartsAmount' => LedgerAmounts::formatAmount(Money::negate(Money::sum($hidden->reject(fn (SubscriptionTransaction $payment): bool => $payment->isCancelled())->pluck('amount')))),
        ]);
    }
}
