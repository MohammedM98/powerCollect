<?php

namespace App\Http\Controllers;

use App\Enums\SubscriptionStatus;
use App\Http\Requests\StoreSubscriptionRequest;
use App\Http\Requests\UpdateSubscriptionRequest;
use App\Models\Branch;
use App\Models\MessageBatch;
use App\Models\MeterReading;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Notifications\ActionCompleted;
use App\Support\Branches\BranchScope;
use App\Support\Ledger\StatementBuilder;
use App\Support\Navigation\DashboardReturn;
use App\Support\Queries\DataTableFilters;
use App\Support\Queries\SubscriptionListQuery;
use App\Support\Readings\ReadingWeeks;
use App\Support\RecordDeletion;
use App\Support\Reports\DailySeries;
use App\Support\Subscriptions\SubscriptionForm;
use App\Support\Subscriptions\SubscriptionPage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class SubscriptionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): InertiaResponse
    {
        $this->authorize('viewAny', Subscription::class);

        $actor = auth()->user();
        $showArchived = $request->boolean('filter.archived');

        if ($showArchived) {
            $this->authorize('viewArchived', Subscription::class);
        }

        $query = Subscription::query()
            ->select('subscriptions.*')
            ->selectRaw("COALESCE(NULLIF(subscription_name, ''), full_name) as display_name")
            ->readableTo($actor)
            ->with(['branch.area', 'branch.governorate', 'meterBox.subArea', 'tariff', 'tariffSegment', 'circuitBreaker', 'standingDiscount', 'registeredBy', 'archiveEvents'])
            // A row needs only its latest weeks; the whole history is sent when its reading window opens (readingHistory).
            ->with(['meterReadings' => fn ($readings) => $readings->chaperone()->withLaterReadingsCount()->with(['recordedBy', 'adjustments'])
                ->orderByDesc('week_start')->limit(SubscriptionPage::ROW_READINGS)])
            ->withCount('meterReadings')
            ->with(['profile' => fn ($query) => $query->withCount(['subscriptions' => fn ($subscriptions) => $subscriptions->readableTo($actor)])])
            ->withSum('transactions as outstanding_balance', 'amount')
            ->withExists(['transactions as has_subscription_fee' => fn (Builder $transactions) => $transactions->where('type', SubscriptionTransaction::TYPE_SUBSCRIPTION_FEE)]);
        $showArchived ? $query->whereNotNull('subscriptions.archived_at') : $query->whereNull('subscriptions.archived_at');
        SubscriptionListQuery::applySubscriptionListFilters($query, $request, includeArchived: true);

        $canRecordReadings = $actor->can('create', MeterReading::class);

        $subscriptions = fn () => $query->paginate(DataTableFilters::dataTablePerPage($request))
            ->withQueryString()
            ->through(fn (Subscription $subscription) => SubscriptionPage::indexRow($subscription, $actor, $canRecordReadings));

        return Inertia::render('Subscriptions/Index', [
            'subscriptions' => $subscriptions,
            'canCreate' => $actor->can('create', Subscription::class),
            'canViewArchived' => $actor->can('viewArchived', Subscription::class),
            'showArchived' => $showArchived,
            'archiveToday' => DailySeries::today()->toDateString(),
            'canRecordReadings' => $canRecordReadings,
            'bulkActions' => [
                'minimumCharge' => $actor->can('bulkUpdate', [Subscription::class, 'minimum_charge']),
                'status' => $actor->can('bulkUpdate', [Subscription::class, 'status']),
                'meterBox' => $actor->can('bulkUpdate', [Subscription::class, 'meter_box_id']),
                'message' => $actor->can('create', MessageBatch::class),
            ],
            'statusOptions' => SubscriptionStatus::options(),
            'listSummary' => fn () => SubscriptionPage::listSummary($actor, $request, $showArchived),
            'filters' => DataTableFilters::dataTableState($request, 'display_name'),
            'filterOptions' => fn () => SubscriptionPage::filterOptions($actor, $request),
            // Whoever sees every branch's subscribers reads, large above the table, which branch the list holds.
            'branchScope' => fn () => BranchScope::shownTo($actor) ? BranchScope::forFilter($actor, $request->input('filter.branch_id')) : null,
            // New reading forms offer only the latest week of each branch.
            'readingWeekOptions' => fn () => ReadingWeeks::recentWeekOptionsFor($actor, 1),
            'statement' => fn () => StatementBuilder::requestedStatement($request, $actor),
            'readingHistory' => fn () => SubscriptionPage::requestedReadingHistory($request, $actor),
            ...SubscriptionForm::subscriptionFormOptions(),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(): InertiaResponse
    {
        $this->authorize('create', Subscription::class);

        return Inertia::render('Subscriptions/Create', SubscriptionForm::subscriptionFormOptions());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreSubscriptionRequest $request): RedirectResponse
    {
        $actor = auth()->user();
        $data = $request->safe()->except(['charge_subscription_fee', 'source_subscription_id']);
        $chargeSubscriptionFee = $request->boolean('charge_subscription_fee');
        $sourceSubscription = $request->sourceSubscription();

        if (! $actor->isSuperAdmin()) {
            $data['branch_id'] = $actor->workBranchId();
        }

        $data['registered_by'] = $actor->id;
        // A subscription connected when registered starts today, unless a date was picked.
        if ($data['status'] === SubscriptionStatus::Active->value && blank($data['subscription_date'] ?? null)) {
            $data['subscription_date'] = DailySeries::today()->toDateString();
        }
        $data = SubscriptionPage::enforceMinimumChargePermission($actor, $data);
        $data = SubscriptionPage::enforceKilowattPricePermission($actor, $data);

        $subscription = DB::transaction(function () use ($data, $actor, $chargeSubscriptionFee, $sourceSubscription): Subscription {
            $subscription = new Subscription($data);

            if ($sourceSubscription !== null) {
                $profile = $sourceSubscription->profile()->lockForUpdate()->firstOrFail();
                $subscription->profile()->associate($profile);
            }

            $subscription->save();

            if ($chargeSubscriptionFee) {
                SubscriptionPage::chargeSubscriptionFee($subscription, $actor);
            }

            return $subscription;
        });

        $actor->notify(new ActionCompleted('subscription-created', $subscription->displayName()));

        return DashboardReturn::redirectAfterSave($request, 'subscriptions.index', 'subscription-created');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Subscription $subscription): InertiaResponse
    {
        $this->authorize('update', $subscription);

        return Inertia::render('Subscriptions/Edit', [
            'subscription' => [
                ...SubscriptionForm::subscriptionEditableFields($subscription),
                'subscriptionCount' => $subscription->profile->subscriptions()->readableTo(auth()->user())->count(),
            ],
            ...SubscriptionForm::subscriptionFormOptions(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateSubscriptionRequest $request, Subscription $subscription): RedirectResponse
    {
        $data = $request->safe()->except(['charge_subscription_fee']);
        $data = SubscriptionPage::enforceMinimumChargePermission(auth()->user(), $data, $subscription);
        $data = SubscriptionPage::enforceKilowattPricePermission(auth()->user(), $data, $subscription);
        // Only a subscription without the fee on the account is validated for charging it.
        $chargeSubscriptionFee = (bool) $request->validated('charge_subscription_fee', false);

        // Activating a subscription who was not active starts their subscription today, unless a date was picked;
        // one who had been active before is connected again, keeping the day they first subscribed.
        if ($data['status'] === SubscriptionStatus::Active->value && $subscription->status !== SubscriptionStatus::Active) {
            $dates = $subscription->datesWhenActivated();
            $datePicked = ($data['subscription_date'] ?? null) !== $subscription->subscription_date?->format('Y-m-d');
            $data = [...$data, ...($datePicked ? Arr::except($dates, 'subscription_date') : $dates)];
        }

        DB::transaction(function () use ($subscription, $data, $chargeSubscriptionFee, $request): void {
            Subscription::query()->whereKey($subscription->id)->lockForUpdate()->firstOrFail();
            $subscription->refresh();
            $this->authorize('update', $subscription);
            $subscription->profile()->lockForUpdate()->firstOrFail();
            $subscription->update($data);

            if ($chargeSubscriptionFee) {
                SubscriptionPage::chargeSubscriptionFee($subscription, $request->user());
            }
        });
        $request->user()->notify(new ActionCompleted('subscription-updated', $subscription->displayName()));

        return DashboardReturn::redirectAfterSave($request, 'subscriptions.index', 'subscription-updated');
    }

    /**
     * Delete the subscription, once nothing uses it any more.
     */
    public function destroy(Request $request, Subscription $subscription): RedirectResponse
    {
        return RecordDeletion::deleteRecord($request, $subscription, 'subscription-deleted', $subscription->displayName(), fn () => $subscription->deleteWithSubscriptionFee());
    }
}
