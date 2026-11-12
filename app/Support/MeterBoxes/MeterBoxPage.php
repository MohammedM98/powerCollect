<?php

namespace App\Support\MeterBoxes;

use App\Enums\SubscriptionStatus;
use App\Models\Area;
use App\Models\Branch;
use App\Models\Governorate;
use App\Models\MeterBox;
use App\Models\SubArea;
use App\Models\Subscription;
use App\Models\User;
use App\Support\Queries\DataTableFilters;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Builds the meter boxes pages: the list, its filters and the printed subscriber lists.
 */
class MeterBoxPage
{
    public const SORTABLE = ['name', 'box_number', 'created_at', 'subscriptions_count'];

    /**
     * The boxes the list shows, with their visible subscribers counted, in
     * the table's search, filters and order. Grouped by region
     * (`group=region`), each region's boxes come together, regions by
     * name and the boxes without one last, so a region never splits
     * across pages.
     *
     * @return Builder<MeterBox>
     */
    public static function matchingBoxes(Request $request, User $actor): Builder
    {
        $subscriptions = Subscription::query()->visibleTo($actor)
            ->select(['subscriptions.id', 'meter_box_id', 'status']);
        $totals = DB::query()->fromSub($subscriptions, 'visible_subscriptions')
            ->select('meter_box_id')
            ->selectRaw('COUNT(*) AS subscriptions_count')
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS active_subscriptions_count', [SubscriptionStatus::Active->value])
            ->groupBy('meter_box_id');

        $query = MeterBox::query()->visibleTo($actor)
            ->leftJoinSub($totals, 'subscription_totals', 'meter_boxes.id', '=', 'subscription_totals.meter_box_id')
            ->select('meter_boxes.*')
            ->selectRaw('COALESCE(subscription_totals.subscriptions_count, 0) AS subscriptions_count')
            ->selectRaw('COALESCE(subscription_totals.active_subscriptions_count, 0) AS active_subscriptions_count')
            ->with('branch.governorate', 'branch.area', 'subArea');
        $query->matchingLabel(DataTableFilters::searchTerm($request));
        if ($request->input('group') === 'region') {
            $query->orderByRaw('meter_boxes.sub_area_id IS NULL')
                ->orderBy(SubArea::query()->select('name')->whereColumn('sub_areas.id', 'meter_boxes.sub_area_id'));
        }
        DataTableFilters::applyDataTableFilters($query, $request, [], self::SORTABLE, 'box_number');
        if ($request->input('sort') === 'name') {
            $query->orderBy('name_suffix', DataTableFilters::sortDirection($request));
        }
        $query->orderBy('meter_boxes.id');
        DataTableFilters::applyDataTableFilterSelects($query, $request, ['branch_id', 'sub_area_id']);
        $name = $request->input('filter.meter_box_name');
        if (is_string($name) && $name !== '') {
            $query->where('meter_boxes.name', $name);
        }
        $boxId = $request->input('filter.meter_box_id');
        if (filled($boxId)) {
            $query->where('meter_boxes.id', $boxId);
        }

        return $query;
    }

    /**
     * A meter box's editable fields — used both for the dedicated edit
     * page and for the edit modal's initial form data on the index page.
     *
     * @return array<string, mixed>
     */
    public static function editableFields(MeterBox $meterBox): array
    {
        return [
            'id' => $meterBox->id,
            'name' => $meterBox->name,
            'name_suffix' => $meterBox->name_suffix,
            'display_name' => $meterBox->displayName(),
            'box_number' => $meterBox->box_number,
            'branch_id' => $meterBox->branch_id,
            'sub_area_id' => $meterBox->sub_area_id,
            'location' => $meterBox->location,
        ];
    }

    /**
     * The branch options for the create/edit forms, and whether the actor
     * may choose the branch themselves. A Super Admin also gets every
     * governorate and area, purely to narrow down the branch picker with
     * a cascading select — a meter box's area/governorate always come
     * from whichever branch it belongs to, never stored on the meter box
     * itself. Everyone else has their branch forced server-side, so they
     * don't need any of this — except their own branch's area, so the
     * sub-area picker can still be scoped to it.
     *
     * @return array{branches: Collection, canChooseBranch: bool, canCreateSubArea: bool, governorates: Collection, areas: Collection, subAreas: Collection, currentBranchAreaId: ?int}
     */
    public static function formOptions(): array
    {
        $actor = auth()->user();
        $canChooseBranch = $actor->isSuperAdmin();

        return [
            'branches' => $canChooseBranch ? Branch::with(['governorate', 'area'])->orderBy('name')->get() : collect(),
            'canChooseBranch' => $canChooseBranch,
            'canCreateSubArea' => $actor->can('create', SubArea::class),
            'governorates' => $canChooseBranch ? Governorate::orderBy('name')->get() : collect(),
            'areas' => $canChooseBranch ? Area::orderBy('name')->get() : collect(),
            'subAreas' => SubArea::orderBy('name')->get(),
            'currentBranchAreaId' => $canChooseBranch ? null : $actor->workBranch()?->area_id,
        ];
    }

    /**
     * The Filter menu's dropdown groups for the index page. The branch
     * filter only makes sense for a Super Admin — everyone else's list is
     * already scoped to their own single branch.
     *
     * @return array<int, array{key: string, label: string, options: array<int, array{value: string, label: string}>}>
     */
    public static function filterOptions(User $actor, Request $request, ?Branch $selectedBranch = null): array
    {
        $groups = [
            DataTableFilters::subAreaFilterGroup(SubArea::visibleTo($actor)
                ->when($selectedBranch, fn (Builder $query): Builder => $query->where('area_id', $selectedBranch->area_id))
                ->orderBy('name')->get()),
            ...DataTableFilters::meterBoxFilterGroupsFor($actor, $request, $actor->isSuperAdmin() ? fn (MeterBox $box): string => $box->branch->name : null),
        ];

        if ($actor->isSuperAdmin()) {
            $groups[] = DataTableFilters::branchFilterGroup();
        }

        return $groups;
    }
}
