<?php

namespace App\Http\Controllers;

use App\Enums\DisconnectionItemStatus;
use App\Enums\DisconnectionReason;
use App\Enums\SubscriptionStatus;
use App\Http\Requests\StoreDisconnectionListRequest;
use App\Http\Requests\UpdateDisconnectionListRequest;
use App\Models\Branch;
use App\Models\DisconnectionList;
use App\Models\SubArea;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\ActionCompleted;
use App\Support\Disconnections\DisconnectionListPage;
use App\Support\Queries\DataTableFilters;
use App\Support\Reports\DailySeries;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * The disconnection lists of each branch: the lists themselves, one list's
 * subscriptions with their dates, warnings and disconnections, and the page
 * where subscriptions are picked to be put on a list. Nothing here
 * disconnects anyone or sends anything by itself.
 */
class DisconnectionListController extends Controller
{
    /** The warning offered when none of the saved wordings is picked. */
    public const DEFAULT_WARNING = 'عزيزنا المشترك {الاسم}، رقم الاشتراك {رقم_الاشتراك}: عليك رصيد مستحق قدره {الرصيد} شيكل. سيتم قطع الخدمة بتاريخ {موعد_القطع} ما لم يتم السداد. {الفرع}';

    /**
     * Every list the user may see, newest first, with where each stands, and
     * the totals across them.
     */
    public function index(Request $request): InertiaResponse
    {
        $this->authorize('viewAny', DisconnectionList::class);

        return DisconnectionListPage::index($request);
    }

    /**
     * Open a new list for the user's branch (the chosen one for the Super Admin).
     */
    public function store(StoreDisconnectionListRequest $request): RedirectResponse
    {
        $actor = $request->user();

        $list = DisconnectionList::create([
            'branch_id' => $actor->isSuperAdmin() ? $request->validated('branch_id') : $actor->workBranchId(),
            'title' => $request->validated('title'),
            'notes' => $request->validated('notes'),
            'created_by' => $actor->id,
        ]);

        $actor->notify(new ActionCompleted('disconnection-list-created', $list->title));

        return redirect()->route('disconnection-lists.show', $list)->with('status', 'disconnection-list-created');
    }

    /**
     * One list: its subscriptions with the search and filters applied, what
     * the user may do with them, and one item's history on request
     * (`?history=` with `only: ['history']`).
     */
    public function show(Request $request, DisconnectionList $disconnectionList): InertiaResponse
    {
        $this->authorize('view', $disconnectionList);

        return DisconnectionListPage::show($request, $disconnectionList);
    }

    /**
     * Rename the list, change its notes, or close or reopen it.
     */
    public function update(UpdateDisconnectionListRequest $request, DisconnectionList $disconnectionList): RedirectResponse
    {
        $actor = $request->user();
        $data = $request->safe()->only(['title', 'notes']);

        if ($request->has('closed')) {
            $closing = $request->boolean('closed');
            $data += $closing
                ? ($disconnectionList->isClosed() ? [] : ['closed_at' => now(), 'closed_by' => $actor->id])
                : ['closed_at' => null, 'closed_by' => null];
        }

        $disconnectionList->update($data);
        $status = match (true) {
            $request->has('closed') && $request->boolean('closed') => 'disconnection-list-closed',
            $request->has('closed') => 'disconnection-list-reopened',
            default => 'disconnection-list-updated',
        };
        $actor->notify(new ActionCompleted($status, $disconnectionList->title));

        return back()->with('status', $status);
    }

    /**
     * The branch's subscriptions to pick from for the list: active ones, with
     * what they owe and whether they already wait on a list. What they owe is
     * shown and can be filtered on, but never decides who may be added.
     */
    public function candidates(Request $request, DisconnectionList $disconnectionList): InertiaResponse
    {
        $this->authorize('manage', $disconnectionList);

        $actor = $request->user();
        $list = $disconnectionList->load('branch');

        $subscriptions = $this->candidateQuery($list, $request)
            ->with(['meterBox.subArea', 'disconnectionItems' => fn ($items) => $items->where('status', DisconnectionItemStatus::Scheduled)->with('list:id,title')])
            ->paginate(DataTableFilters::dataTablePerPage($request, 25))
            ->withQueryString()
            ->through(function (Subscription $subscription) use ($list): array {
                $waiting = $subscription->disconnectionItems->first();

                return [
                    'id' => $subscription->id,
                    'name' => $subscription->displayName(),
                    'accountNumber' => $subscription->account_number,
                    'meterBoxNumber' => $subscription->meterBox?->box_number,
                    'meterBoxName' => $subscription->meterBox?->displayName(),
                    'subAreaName' => $subscription->meterBox?->subArea?->name,
                    'balance' => number_format((float) $subscription->balance, 2, '.', ''),
                    'waitingOn' => $waiting ? ['id' => $waiting->list->id, 'title' => $waiting->list->title, 'isThisList' => $waiting->list->id === $list->id] : null,
                ];
            });

        return Inertia::render('Disconnections/Candidates', [
            'list' => ['id' => $list->id, 'title' => $list->title, 'branchName' => $list->branch->name, 'isClosed' => $list->isClosed()],
            'subscriptions' => $subscriptions,
            'reasonOptions' => DisconnectionReason::options(),
            'today' => DailySeries::today()->toDateString(),
            'filters' => DataTableFilters::dataTableState($request, 'display_name', 'asc', 25),
            'filterOptions' => [
                DataTableFilters::filterGroup('listed', 'قوائم القطع', [
                    ['value' => 'none', 'label' => 'غير مدرج في قائمة'],
                    ['value' => 'listed', 'label' => 'مدرج في قائمة'],
                ]),
                DataTableFilters::filterGroup('balance', 'الرصيد', [
                    ['value' => 'owing', 'label' => 'عليه رصيد مستحق'],
                    ['value' => 'clear', 'label' => 'لا رصيد عليه'],
                ]),
                DataTableFilters::subAreaFilterGroup(SubArea::query()->visibleTo($actor)->orderBy('name')->get()),
                ...DataTableFilters::meterBoxFilterGroupsFor($actor, $request),
            ],
        ]);
    }

    /**
     * The list's branch's active subscriptions matching the candidates page's
     * search and filters; shared with adding every match to the list.
     */
    public static function candidateQuery(DisconnectionList $list, Request $request): Builder
    {
        $filter = (array) $request->input('filter', []);
        $balance = '(select coalesce(sum(amount), 0) from subscription_transactions where subscription_transactions.subscription_id = subscriptions.id)';
        $search = trim((string) $request->input('search'));
        $minimumBalance = $filter['min_balance'] ?? null;

        $query = Subscription::query()
            ->select('subscriptions.*')
            ->selectRaw("COALESCE(NULLIF(subscription_name, ''), full_name) as display_name")
            ->selectRaw("{$balance} as balance")
            ->where('branch_id', $list->branch_id)
            ->where('status', SubscriptionStatus::Active)
            ->when($search !== '', fn (Builder $subscriptions) => $subscriptions->matchingSearch($search))
            ->when(($filter['balance'] ?? null) === 'owing', fn (Builder $subscriptions) => $subscriptions->whereRaw("{$balance} > 0"))
            ->when(($filter['balance'] ?? null) === 'clear', fn (Builder $subscriptions) => $subscriptions->whereRaw("{$balance} <= 0"))
            ->when(is_numeric($minimumBalance), fn (Builder $subscriptions) => $subscriptions->whereRaw("{$balance} >= ?", [(float) $minimumBalance]))
            ->when(($filter['listed'] ?? null) === 'none', fn (Builder $subscriptions) => $subscriptions->whereDoesntHave('disconnectionItems', fn (Builder $items) => $items->where('status', DisconnectionItemStatus::Scheduled)))
            ->when(($filter['listed'] ?? null) === 'listed', fn (Builder $subscriptions) => $subscriptions->whereHas('disconnectionItems', fn (Builder $items) => $items->where('status', DisconnectionItemStatus::Scheduled)));

        if (is_string($filter['sub_area_id'] ?? null) && ctype_digit($filter['sub_area_id'])) {
            $query->whereHas('meterBox', fn (Builder $box) => $box->where('sub_area_id', (int) $filter['sub_area_id']));
        }

        if (is_string($filter['meter_box_name'] ?? null) && $filter['meter_box_name'] !== '') {
            $query->whereHas('meterBox', fn (Builder $box) => $box->where('name', $filter['meter_box_name']));
        }

        if (is_string($filter['meter_box_id'] ?? null) && ctype_digit($filter['meter_box_id'])) {
            $query->where('meter_box_id', (int) $filter['meter_box_id']);
        }

        $sort = (string) $request->string('sort');
        $direction = $request->string('direction')->lower()->value() === 'desc' ? 'desc' : 'asc';

        return match ($sort) {
            'balance' => $query->orderBy('balance', $direction)->orderBy('subscriptions.id'),
            'account_number' => $query->orderBy('account_number', $direction),
            default => $query->orderBy('display_name', $direction)->orderBy('subscriptions.id'),
        };
    }
}
