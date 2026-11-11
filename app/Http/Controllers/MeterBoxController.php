<?php

namespace App\Http\Controllers;

use App\Http\Requests\PrintMeterBoxSubscriptionsRequest;
use App\Http\Requests\StoreMeterBoxRequest;
use App\Http\Requests\UpdateMeterBoxRequest;
use App\Models\Branch;
use App\Models\MessageBatch;
use App\Models\MeterBox;
use App\Models\MeterReading;
use App\Models\Subscription;
use App\Notifications\ActionCompleted;
use App\Support\Branches\BranchDomainContext;
use App\Support\Branches\BranchScope;
use App\Support\MeterBoxes\MeterBoxPage;
use App\Support\Queries\DataTableFilters;
use App\Support\RecordDeletion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class MeterBoxController extends Controller
{
    /**
     * The most subscribers one printout of the boxes and their subscribers holds.
     */
    public const PRINT_SUBSCRIBERS_LIMIT = 5000;

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): InertiaResponse
    {
        $this->authorize('viewAny', MeterBox::class);

        $actor = auth()->user();

        $canViewSubscriptions = $actor->can('viewAny', Subscription::class);
        $query = MeterBoxPage::matchingBoxes($request, $actor);

        $branchId = BranchDomainContext::id() ?? ($actor->isSuperAdmin() ? $request->input('filter.branch_id') : $actor->workBranchId());
        $selectedBranch = filled($branchId) ? Branch::query()->find((int) $branchId, ['id', 'area_id']) : null;

        $summary = DB::query()->fromSub((clone $query)->reorder(), 'matching_boxes')
            ->selectRaw('COUNT(*) AS total, COALESCE(SUM(subscriptions_count), 0) AS subscriptions')
            ->selectRaw('COALESCE(SUM(active_subscriptions_count), 0) AS active')
            ->selectRaw('COALESCE(SUM(CASE WHEN subscriptions_count = 0 THEN 1 ELSE 0 END), 0) AS empty_boxes')
            ->selectRaw('COUNT(DISTINCT sub_area_id) AS regions, COALESCE(SUM(CASE WHEN sub_area_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS located_boxes')
            ->first();

        $meterBoxes = $query->paginate(DataTableFilters::dataTablePerPage($request))
            ->withQueryString()
            ->through(fn (MeterBox $meterBox) => [
                ...MeterBoxPage::editableFields($meterBox),
                'branchName' => $meterBox->branch->name,
                'governorateName' => $meterBox->branch->governorate?->name,
                'areaName' => $meterBox->branch->area?->name,
                'subAreaName' => $meterBox->subArea?->name,
                'subscriptionsCount' => (int) $meterBox->subscriptions_count,
                'activeSubscriptionsCount' => (int) $meterBox->active_subscriptions_count,
                'canUpdate' => $actor->can('update', $meterBox),
                'canDelete' => $actor->can('delete', $meterBox),
            ]);

        return Inertia::render('MeterBoxes/Index', [
            'meterBoxes' => $meterBoxes,
            'canCreate' => $actor->can('create', MeterBox::class),
            'canViewSubscriptions' => $canViewSubscriptions,
            'canRecordReadings' => $actor->can('create', MeterReading::class),
            'canSendMessages' => $actor->can('create', MessageBatch::class),
            'summary' => [
                'total' => (int) $summary->total,
                'subscriptions' => (int) $summary->subscriptions,
                'active' => (int) $summary->active,
                'empty' => (int) $summary->empty_boxes,
                'regions' => (int) $summary->regions,
                'located' => (int) $summary->located_boxes,
            ],
            'filters' => DataTableFilters::dataTableState($request, 'box_number'),
            'filterOptions' => MeterBoxPage::filterOptions($actor, $request, $selectedBranch),
            'selectedBranch' => $selectedBranch?->only(['id', 'area_id']),
            'groupByRegion' => $request->input('group') === 'region',
            // The Super Admin reads, large above the list, which branch's boxes it holds.
            'branchScope' => fn () => BranchScope::shownTo($actor) ? BranchScope::forFilter($actor, $request->input('filter.branch_id')) : null,
            ...MeterBoxPage::formOptions(),
        ]);
    }

    /**
     * The boxes the list shows with their subscribers, a row each, for the
     * print designer: grouped by the box's region, then by the box, each
     * written once on a centred line of its own above its subscribers, who
     * keep the order chosen on the list. Boxes without subscribers are left
     * out and counted in the printout's summary.
     */
    public function printSubscriptions(PrintMeterBoxSubscriptionsRequest $request): InertiaResponse|RedirectResponse
    {

        if (! $request->boolean('print')) {
            return redirect()->route('meter-boxes.index', $request->except(['subscription_sort', 'subscription_direction']));
        }

        $validated = $request->validated();
        $actor = $request->user();
        $boxes = MeterBoxPage::matchingBoxes($request, $actor)->get();
        $subscriptions = Subscription::query()->visibleTo($actor)
            ->whereIntegerInRaw('meter_box_id', $boxes->modelKeys())
            ->orderedInMeterBox($validated['subscription_sort'] ?? 'name', $validated['subscription_direction'] ?? 'asc')
            ->with('circuitBreaker:id,ampere', 'latestMeterReading')
            ->get()
            ->groupBy('meter_box_id');

        $labels = ['#', 'المشترك', 'رقم الحساب', 'القراءة السابقة', 'القاطع', 'الحالة'];
        $fields = ['subAreaName' => 'منطقة الطبلون', 'boxLabel' => 'الطبلون', 'boxName' => 'اسم الطبلون', 'boxNumber' => 'رقم الطبلون', 'location' => 'موقع الطبلون', 'branchName' => 'الفرع', 'phone' => 'رقم الجوال'];
        $rows = [];
        foreach ($boxes as $box) {
            foreach ($subscriptions->get($box->id, collect())->values() as $index => $subscription) {
                if (count($rows) === self::PRINT_SUBSCRIBERS_LIMIT) {
                    break 2;
                }
                $cells = [
                    '#' => $index + 1,
                    'المشترك' => $subscription->displayName(),
                    'رقم الحساب' => $subscription->account_number,
                    'القراءة السابقة' => $subscription->latestMeterReading?->nextPreviousReading() ?? $subscription->initial_reading,
                    'القاطع' => $subscription->circuitBreaker ? $subscription->circuitBreaker->ampere.' أمبير' : '',
                    'الحالة' => __($subscription->status->label()),
                    'field:subAreaName' => $box->subArea?->name ?? 'بلا منطقة',
                    'field:boxLabel' => $box->displayName().' — '.$box->box_number,
                    'field:boxName' => $box->displayName(),
                    'field:boxNumber' => $box->box_number,
                    'field:location' => $box->location,
                    'field:branchName' => $box->branch->name,
                    'field:phone' => $subscription->contactPhone(),
                ];
                $rows[] = ['type' => 'row', 'cells' => array_map(fn (mixed $value): string => (string) ($value ?? ''), $cells)];
            }
        }

        $branchId = BranchDomainContext::id() ?? ($actor->isSuperAdmin() ? $request->input('filter.branch_id') : $actor->workBranchId());
        $branchName = filled($branchId) ? Branch::query()->whereKey((int) $branchId)->value('name') : null;
        $total = $subscriptions->sum(fn (Collection $boxSubscriptions): int => $boxSubscriptions->count());
        $emptyBoxes = $boxes->filter(fn (MeterBox $box): bool => ! $subscriptions->has($box->id))->count();

        return Inertia::render('Print/ReadingReport', ['printData' => [
            'columns' => [
                ...array_map(fn (string $label): array => ['key' => $label, 'label' => $label], $labels),
                ...array_map(fn (string $key, string $label): array => ['key' => 'field:'.$key, 'label' => $label, 'extra' => true], array_keys($fields), array_values($fields)),
            ],
            'rows' => $rows,
            'total' => $total,
            'allRowsOnly' => true,
            'summary' => collect([
                number_format($boxes->count() - $emptyBoxes).' طبلون',
                number_format($total).' مشترك',
                $emptyBoxes > 0 ? number_format($emptyBoxes).' طبلون بلا مشتركين لم يُطبع' : null,
            ])->filter()->implode(' · '),
            'context' => ['templatePage' => '/meter-boxes/subscriptions-print', 'title' => 'الطبلونات ومشتركوها', 'branchName' => $branchName ?? ($actor->isSuperAdmin() ? 'كل الفروع' : '')],
            'defaults' => [
                'group' => ['key' => 'field:subAreaName', 'then' => ['field:boxLabel'], 'headings' => 'stacked', 'align' => 'center', 'labels' => false, 'subtotals' => false, 'unit' => 'مشترك', 'repeatHeader' => true],
            ],
        ]]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(): InertiaResponse
    {
        $this->authorize('create', MeterBox::class);

        return Inertia::render('MeterBoxes/Create', MeterBoxPage::formOptions());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreMeterBoxRequest $request): RedirectResponse
    {
        $actor = auth()->user();
        $data = $request->validated();

        if (! $actor->isSuperAdmin()) {
            $data['branch_id'] = $actor->workBranchId();
        }

        $meterBox = MeterBox::create($data);
        $request->user()->notify(new ActionCompleted('meter-box-created', $meterBox->displayName()));

        return redirect()->route('meter-boxes.index')->with('status', 'meter-box-created');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(MeterBox $meterBox): InertiaResponse
    {
        $this->authorize('update', $meterBox);

        return Inertia::render('MeterBoxes/Edit', [
            'meterBox' => MeterBoxPage::editableFields($meterBox),
            ...MeterBoxPage::formOptions(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateMeterBoxRequest $request, MeterBox $meterBox): RedirectResponse
    {
        $meterBox->update($request->validated());
        $request->user()->notify(new ActionCompleted('meter-box-updated', $meterBox->displayName()));

        return redirect()->route('meter-boxes.index')->with('status', 'meter-box-updated');
    }

    /**
     * Delete the meter box, once nothing uses it any more.
     */
    public function destroy(Request $request, MeterBox $meterBox): RedirectResponse
    {
        return RecordDeletion::deleteRecord($request, $meterBox, 'meter-box-deleted', $meterBox->displayName());
    }
}
