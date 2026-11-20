<?php

namespace App\Http\Controllers;

use App\Enums\ChargeType;
use App\Enums\DiscountMethod;
use App\Enums\PaymentMethod;
use App\Enums\PermissionKey;
use App\Http\Requests\StoreSplitPaymentRequest;
use App\Models\Bank;
use App\Models\CashBox;
use App\Models\StandingDiscount;
use App\Models\Subscription;
use App\Models\User;
use App\Support\Closing\BranchClosingWorkflow;
use App\Support\Closing\CashBoxPresenter;
use App\Support\Ledger\PaymentPage;
use App\Support\Ledger\StatementBuilder;
use App\Support\Queries\DataTableFilters;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class PaymentController extends Controller
{
    public function __construct(private BranchClosingWorkflow $workflow) {}

    /** The most subscriptions the split form's search lists; a longer list asks the user to narrow the search. */
    public const RESULT_LIMIT = 12;

    /**
     * The quick payments page: the subscribers of the user's branch in a table
     * (search, filters and sort, with each one's balance) with a button on each
     * to record their payment and a menu for the account's other lines
     * (charge, discount, clearing, a split transfer), and a button for one
     * transfer shared between several subscribers; what the user collected
     * is on the summary page. It takes only the "Record Collections"
     * permission, so it works for someone who cannot open the subscriptions
     * list; the charge, discount and clearing need "Adjust Balances" too.
     */
    public function index(Request $request): InertiaResponse
    {
        $this->authorize('recordAnyPayment', Subscription::class);

        $actor = $request->user();
        $canAddDiscounts = $actor->hasPermission(PermissionKey::AddDiscounts);
        $query = Subscription::query()
            ->select('subscriptions.*')
            ->selectRaw("COALESCE(NULLIF(subscription_name, ''), full_name) as display_name")
            ->visibleTo($actor)
            ->with(['branch', 'meterBox.subArea', 'circuitBreaker', 'profile', ...($canAddDiscounts ? ['standingDiscount.grantedBy'] : [])])
            ->withSum('transactions as outstanding_balance', 'amount');
        PaymentPage::applyTableFilters($query, $request);

        return Inertia::render('Payments/Index', [
            'subscriptions' => fn () => $query->paginate(DataTableFilters::dataTablePerPage($request))
                ->withQueryString()
                ->through(fn (Subscription $subscription): array => [
                    ...PaymentPage::row($subscription),
                    'canAddCharge' => $actor->can('addCharge', $subscription),
                    'canAddDiscount' => $actor->can('addDiscount', $subscription),
                    'canAddClearing' => $actor->can('addClearing', $subscription),
                    'standingDiscount' => $canAddDiscounts ? StatementBuilder::statementStandingDiscount($subscription->standingDiscount) : null,
                ]),
            'scopeLabel' => $actor->isSuperAdmin() ? 'كل الفروع' : ($actor->workBranch()?->name ?? '—'),
            'filters' => DataTableFilters::dataTableState($request, 'display_name'),
            'filterOptions' => fn () => PaymentPage::filterOptions($actor, $request),
            // A subscriber's statement, opened over the list from their row.
            'statement' => fn () => StatementBuilder::requestedStatement($request, $actor),
            'pendingCount' => fn () => CashBoxPresenter::collectionCounts($actor)['pendingCount'],
            'collectionUrls' => CashBoxPresenter::collectionUrls(),
            // The ways this user may take a payment: what the payment form offers.
            'paymentMethods' => PaymentMethod::options($actor->allowedPaymentMethods()),
            'canSplitPayments' => $actor->can('recordSplitPayment', Subscription::class),
            'transferBanks' => fn () => Bank::receiverNames(),
            'senderBanks' => fn () => Bank::senderNames(),
            'chargeTypes' => ChargeType::formOptions(),
            'discountMethods' => DiscountMethod::options(),
            'discountSegments' => fn () => $canAddDiscounts ? StandingDiscount::segmentSuggestions() : [],
        ]);
    }

    /**
     * The collector's summary: what they collected today and their latest
     * payments, what waits on them (a handover to confirm, audit notes,
     * debts), and the boxes open now with every entry in them, filtered by
     * `?filter[type]=` to one type of box and searched as the branch's
     * entries are. The entries of a closed box are looked over inside it.
     */
    public function summary(Request $request): InertiaResponse
    {
        $this->authorize('viewOwnCashBoxes', Subscription::class);

        $actor = $request->user();
        $cashBox = PaymentPage::ownCashBoxes($actor);

        return Inertia::render('Payments/Summary', [
            'today' => PaymentPage::todaysPayments($actor),
            'recentDays' => PaymentPage::recentDays($actor),
            'cashBox' => $cashBox,
            'current' => $cashBox['current'],
            ...CashBoxPresenter::entryList($request, PaymentPage::ownOpenEntries($actor), fn (CashBox $box): string => route('payments.cash-boxes.show', $box)),
            'needsAction' => $cashBox['needsAction'],
            ...CashBoxPresenter::collectionCounts($actor),
            'collectionUrls' => CashBoxPresenter::collectionUrls(),
        ]);
    }

    /**
     * The split payment form's search, as JSON: the subscriptions matching
     * `?search=`, or — with `?siblings_of=` — the other subscriptions under
     * the same identity number as that one, so a payer's accounts are added
     * to the split together.
     */
    public function search(Request $request): JsonResponse
    {
        $this->authorize('recordAnyPayment', Subscription::class);

        $actor = $request->user();
        $siblingsOf = $request->query('siblings_of');

        if (is_string($siblingsOf) && ctype_digit($siblingsOf)) {
            $source = Subscription::query()->visibleTo($actor)->findOrFail($siblingsOf);
            $found = $source->subscriber_profile_id === null ? collect() : Subscription::query()
                ->visibleTo($actor)
                ->with(['branch', 'meterBox', 'circuitBreaker', 'profile'])
                ->withSum('transactions as outstanding_balance', 'amount')
                ->where('subscriber_profile_id', $source->subscriber_profile_id)
                ->whereKeyNot($source->id)
                ->orderBy('account_number')
                ->limit(StoreSplitPaymentRequest::MAX_PARTS)
                ->get();

            return response()->json(['subscriptions' => $found->map(fn (Subscription $subscription): array => PaymentPage::row($subscription))->values(), 'hasMore' => false]);
        }

        $search = trim((string) $request->query('search', ''));
        $found = $search === '' ? collect() : PaymentPage::matching($actor, $search);

        return response()->json([
            'subscriptions' => $found->take(self::RESULT_LIMIT)->map(fn (Subscription $subscription): array => PaymentPage::row($subscription))->values(),
            'hasMore' => $found->count() > self::RESULT_LIMIT,
        ]);
    }
}
