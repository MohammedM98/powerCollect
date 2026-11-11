<?php

namespace App\Support\Disconnections;

use App\Enums\DisconnectionEventType;
use App\Enums\DisconnectionItemStatus;
use App\Enums\DisconnectionReason;
use App\Models\Branch;
use App\Models\DisconnectionEvent;
use App\Models\DisconnectionList;
use App\Models\DisconnectionListItem;
use App\Models\MeterBox;
use App\Models\SubArea;
use App\Models\User;
use App\Support\Queries\DataTableFilters;
use App\Support\Reports\DailySeries;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

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
            DataTableFilters::filterGroup('status', 'الحالة', DisconnectionItemStatus::options()),
            DataTableFilters::filterGroup('timing', 'الموعد', [
                ['value' => 'overdue', 'label' => 'متأخر — بانتظار إجراء'],
                ['value' => 'today', 'label' => 'موعده اليوم'],
                ['value' => 'upcoming', 'label' => 'موعده لاحقًا'],
            ]),
            DataTableFilters::filterGroup('reason', 'سبب القطع', DisconnectionReason::options()),
            DataTableFilters::filterGroup('balance', 'الرصيد', [
                ['value' => 'owing', 'label' => 'عليه رصيد مستحق'],
                ['value' => 'paid', 'label' => 'سدّد كامل رصيده'],
                ['value' => 'reduced', 'label' => 'قلّ رصيده منذ الإدراج'],
            ]),
            DataTableFilters::filterGroup('warned', 'الإنذارات', [
                ['value' => '1', 'label' => 'أُرسل له إنذار'],
                ['value' => '0', 'label' => 'لم يُنذر بعد'],
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
}
