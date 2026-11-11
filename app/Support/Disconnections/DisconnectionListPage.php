<?php

namespace App\Support\Disconnections;

use App\Enums\DisconnectionEventType;
use App\Enums\DisconnectionItemStatus;
use App\Enums\DisconnectionReason;
use App\Enums\MessageChannel;
use App\Enums\MessageKind;
use App\Enums\PermissionKey;
use App\Http\Controllers\DisconnectionListController;
use App\Models\Branch;
use App\Models\DisconnectionEvent;
use App\Models\DisconnectionList;
use App\Models\DisconnectionListItem;
use App\Models\MessageTemplate;
use App\Models\MeterBox;
use App\Models\SubArea;
use App\Models\User;
use App\Support\Branches\BranchScope;
use App\Support\Messaging\MessageComposer;
use App\Support\Messaging\SmsGateway;
use App\Support\Queries\DataTableFilters;
use App\Support\Queries\DisconnectionItemsQuery;
use App\Support\Reports\DailySeries;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Builds the disconnection list pages: candidates, lists and their items.
 */
class DisconnectionListPage
{
    /**
     * Where the user's lists stand together: active lists, waiting and
     * overdue subscriptions, the week ahead, warnings, disconnections and the
     * fees they charged this month — of one branch when `$branchId` is given.
     *
     * @return array<string, int|string>
     */
    public static function summary(User $actor, ?int $branchId = null): array
    {
        $today = DailySeries::today();
        $monthStart = $today->startOfMonth()->setTimezone('UTC');
        $items = fn (): Builder => DisconnectionListItem::query()->visibleTo($actor)->when($branchId, fn (Builder $query) => $query->where('branch_id', $branchId));
        $scheduled = fn (): Builder => $items()->where('status', DisconnectionItemStatus::Scheduled);

        return [
            'openLists' => DisconnectionList::query()->visibleTo($actor)->when($branchId, fn (Builder $query) => $query->where('branch_id', $branchId))->whereNull('closed_at')->count(),
            'scheduled' => $scheduled()->count(),
            'overdue' => $scheduled()->whereDate('scheduled_for', '<', $today->toDateString())->count(),
            'upcoming' => $scheduled()->whereDate('scheduled_for', '>=', $today->toDateString())->whereDate('scheduled_for', '<=', $today->addDays(7)->toDateString())->count(),
            'warningsThisMonth' => DisconnectionEvent::query()
                ->where('type', DisconnectionEventType::Warned)
                ->where('created_at', '>=', $monthStart)
                ->whereHas('item', fn (Builder $item) => $item->visibleTo($actor)->when($branchId, fn (Builder $query) => $query->where('branch_id', $branchId)))
                ->count(),
            'disconnectedThisMonth' => $items()->where('status', DisconnectionItemStatus::Disconnected)->where('disconnected_at', '>=', $monthStart)->count(),
            'feesThisMonth' => number_format((float) $items()->where('status', DisconnectionItemStatus::Disconnected)->where('disconnected_at', '>=', $monthStart)->sum('fee_amount'), 2, '.', ''),
        ];
    }

    /**
     * Where one list's subscriptions stand, with the count of each reason.
     *
     * @return array<string, mixed>
     */
    public static function listSummary(DisconnectionList $list): array
    {
        $today = DailySeries::today()->toDateString();
        $counts = $list->items()->toBase()
            ->selectRaw('status, count(*) as total, coalesce(sum(fee_amount), 0) as fees, coalesce(sum(warnings_count), 0) as warnings, coalesce(sum(extensions_count), 0) as extensions')
            ->groupBy('status')
            ->get()
            ->keyBy('status');
        $count = fn (DisconnectionItemStatus $status): int => (int) ($counts[$status->value]->total ?? 0);

        return [
            'total' => (int) $counts->sum('total'),
            'scheduled' => $count(DisconnectionItemStatus::Scheduled),
            'overdue' => $list->items()->overdue()->count(),
            'dueToday' => $list->items()->where('status', DisconnectionItemStatus::Scheduled)->whereDate('scheduled_for', $today)->count(),
            'disconnected' => $count(DisconnectionItemStatus::Disconnected),
            'removed' => $count(DisconnectionItemStatus::Removed),
            'warnings' => (int) $counts->sum('warnings'),
            'extensions' => (int) $counts->sum('extensions'),
            'feesTotal' => number_format((float) $counts->sum('fees'), 2, '.', ''),
            'reasons' => collect(DisconnectionReason::cases())->map(fn (DisconnectionReason $reason) => [
                'value' => $reason->value,
                'label' => __($reason->label()),
                'count' => $list->items()->where('reason', $reason)->count(),
            ])->all(),
        ];
    }

    /**
     * The list page's Filter menu.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function itemFilterOptions(User $actor, Request $request): array
    {
        return [
            DataTableFilters::filterGroup('status', __('Status'), DisconnectionItemStatus::options()),
            DataTableFilters::filterGroup('timing', __('Due date'), [
                ['value' => 'overdue', 'label' => __('Overdue — awaiting action')],
                ['value' => 'today', 'label' => __('Due today')],
                ['value' => 'upcoming', 'label' => __('Due later')],
            ]),
            DataTableFilters::filterGroup('reason', __('Disconnection reason'), DisconnectionReason::options()),
            DataTableFilters::filterGroup('balance', 'الرصيد', [
                ['value' => 'owing', 'label' => __('Has a balance owed')],
                ['value' => 'paid', 'label' => __('Paid the full balance')],
                ['value' => 'reduced', 'label' => __('Balance went down since listing')],
            ]),
            DataTableFilters::filterGroup('warned', __('Warnings'), [
                ['value' => '1', 'label' => __('Was sent a warning')],
                ['value' => '0', 'label' => __('Not warned yet')],
            ]),
            DataTableFilters::subAreaFilterGroup(SubArea::query()->visibleTo($actor)->orderBy('name')->get()),
            ...DataTableFilters::meterBoxFilterGroupsFor($actor, $request, $actor->isSuperAdmin() ? fn (MeterBox $box): string => $box->branch->name : null),
        ];
    }

    /**
     * One item's history, oldest first.
     *
     * @return array<string, mixed>|null
     */
    public static function history(DisconnectionList $list, int $itemId): ?array
    {
        $item = $list->items()->with(['subscription', 'events.user', 'events.message'])->find($itemId);

        if ($item === null) {
            return null;
        }

        $timezone = config('app.business_timezone');

        return [
            'id' => $item->id,
            'name' => $item->subscription->displayName(),
            'accountNumber' => $item->subscription->account_number,
            'events' => $item->events->sortBy('id')->values()->map(fn (DisconnectionEvent $event) => [
                'id' => $event->id,
                'type' => $event->type->value,
                'typeLabel' => __($event->type->label()),
                'old' => $event->old_values,
                'new' => $event->new_values,
                'reason' => $event->reason,
                'userName' => $event->user?->name,
                'at' => $event->created_at->timezone($timezone)->format('Y-m-d H:i'),
                'message' => $event->message ? [
                    'body' => $event->message->body,
                    'phone' => $event->message->phone,
                    'status' => $event->message->status->value,
                    'statusLabel' => __($event->message->status->label()),
                    'error' => $event->message->error,
                ] : null,
            ])->all(),
        ];
    }

    public static function index(Request $request): InertiaResponse
    {

        $actor = $request->user();
        $today = DailySeries::today()->toDateString();
        $scheduled = fn (Builder $items) => $items->where('status', DisconnectionItemStatus::Scheduled);

        $query = DisconnectionList::query()
            ->visibleTo($actor)
            ->with(['branch', 'createdBy', 'closedBy'])
            ->withCount([
                'items',
                'items as scheduled_count' => $scheduled,
                'items as overdue_count' => fn (Builder $items) => $scheduled($items)->whereDate('scheduled_for', '<', $today),
                'items as disconnected_count' => fn (Builder $items) => $items->where('status', DisconnectionItemStatus::Disconnected),
                'items as removed_count' => fn (Builder $items) => $items->where('status', DisconnectionItemStatus::Removed),
            ])
            ->withSum('items as fees_total', 'fee_amount')
            ->withMin(['items as next_date' => $scheduled], 'scheduled_for');
        DataTableFilters::applyDataTableFilters($query, $request, ['title', 'notes'], ['created_at', 'title'], 'created_at', 'desc');
        DataTableFilters::applyDataTableFilterSelects($query, $request, ['branch_id']);

        $state = ((array) $request->input('filter', []))['state'] ?? null;
        $query->when($state === 'open', fn (Builder $lists) => $lists->whereNull('closed_at'))
            ->when($state === 'closed', fn (Builder $lists) => $lists->whereNotNull('closed_at'));

        $lists = $query->paginate(DataTableFilters::dataTablePerPage($request))
            ->withQueryString()
            ->through(fn (DisconnectionList $list) => [
                'id' => $list->id,
                'title' => $list->title,
                'notes' => $list->notes,
                'branchName' => $list->branch->name,
                'createdBy' => $list->createdBy?->name,
                'createdAt' => $list->created_at->toIso8601String(),
                'isClosed' => $list->isClosed(),
                'closedAt' => $list->closed_at?->toIso8601String(),
                'itemsCount' => (int) $list->items_count,
                'scheduledCount' => (int) $list->scheduled_count,
                'overdueCount' => (int) $list->overdue_count,
                'disconnectedCount' => (int) $list->disconnected_count,
                'removedCount' => (int) $list->removed_count,
                'feesTotal' => number_format((float) $list->fees_total, 2, '.', ''),
                'nextDate' => $list->next_date ? substr((string) $list->next_date, 0, 10) : null,
            ]);

        $filterOptions = [
            DataTableFilters::filterGroup('state', __('Status'), [['value' => 'open', 'label' => __('Open list')], ['value' => 'closed', 'label' => __('Closed list')]]),
        ];

        if ($actor->isSuperAdmin()) {
            $filterOptions[] = DataTableFilters::branchFilterGroup();
        }

        // The Super Admin narrows the page to one branch in the banner: the figures above the lists follow it.
        $branchId = $actor->isSuperAdmin() && is_numeric($request->input('filter.branch_id')) ? (int) $request->input('filter.branch_id') : null;

        return Inertia::render('Disconnections/Index', [
            'lists' => $lists,
            'summary' => DisconnectionListPage::summary($actor, $branchId),
            'branchScope' => fn () => BranchScope::shownTo($actor) ? BranchScope::forFilter($actor, $branchId) : null,
            'canCreate' => $actor->can('create', DisconnectionList::class),
            'branchOptions' => $actor->isSuperAdmin() ? DataTableFilters::modelOptions(Branch::orderBy('name')->get()) : [],
            'filters' => DataTableFilters::dataTableState($request, 'created_at', 'desc'),
            'filterOptions' => $filterOptions,
        ]);
    }

    public static function show(Request $request, DisconnectionList $disconnectionList): InertiaResponse
    {

        $actor = $request->user();
        $list = $disconnectionList->load(['branch', 'createdBy', 'closedBy']);
        $canWarn = $actor->can('warn', $list);

        $items = DisconnectionItemsQuery::filteredDisconnectionItems($list, $request)
            ->with(DisconnectionItemPresenter::disconnectionItemRelations())
            ->paginate(DataTableFilters::dataTablePerPage($request, 25))
            ->withQueryString()
            ->through(fn (DisconnectionListItem $item) => DisconnectionItemPresenter::disconnectionItemRow($item, $canWarn));

        return Inertia::render('Disconnections/Show', [
            'list' => [
                'id' => $list->id,
                'title' => $list->title,
                'notes' => $list->notes,
                'branchName' => $list->branch->name,
                'createdBy' => $list->createdBy?->name,
                'createdAt' => $list->created_at->toIso8601String(),
                'isClosed' => $list->isClosed(),
                'closedAt' => $list->closed_at?->toIso8601String(),
                'closedBy' => $list->closedBy?->name,
            ],
            'items' => $items,
            'summary' => DisconnectionListPage::listSummary($list),
            'abilities' => [
                'manage' => $actor->can('manage', $list) && ! $list->isClosed(),
                'manageList' => $actor->can('manage', $list),
                'warn' => $canWarn && ! $list->isClosed(),
                'execute' => $actor->can('execute', $list) && ! $list->isClosed(),
                'changeFee' => $actor->hasPermission(PermissionKey::ChangeDisconnectionFee),
            ],
            'reasonOptions' => DisconnectionReason::options(),
            'channelOptions' => MessageChannel::options(),
            'smsDeliversMessages' => app(SmsGateway::class)->deliversMessages(),
            'warningTemplates' => MessageTemplate::query()->where('kind', MessageKind::DisconnectionWarning)->orderBy('name')->get(['id', 'name', 'body']),
            'defaultWarning' => DisconnectionListController::DEFAULT_WARNING,
            'placeholders' => MessageComposer::placeholdersFor(MessageKind::DisconnectionWarning),
            'today' => DailySeries::today()->toDateString(),
            'usualFee' => DisconnectionListItem::usualFee(),
            'filters' => DataTableFilters::dataTableState($request, 'scheduled_for', 'asc', 25),
            'filterOptions' => DisconnectionListPage::itemFilterOptions($actor, $request),
            'history' => Inertia::optional(fn () => DisconnectionListPage::history($list, $request->integer('history'))),
        ]);
    }
}
