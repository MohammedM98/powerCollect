<?php

namespace App\Support\Readings;

use App\Enums\MeterReadingStatus;
use App\Enums\PermissionKey;
use App\Enums\ReadingEntryMode;
use App\Enums\SubscriptionStatus;
use App\Http\Controllers\MeterReadingController;
use App\Http\Requests\ListMeterReadingsRequest;
use App\Models\Area;
use App\Models\Branch;
use App\Models\MessageBatch;
use App\Models\MeterReading;
use App\Models\ReadingEntrySetting;
use App\Models\StandingDiscount;
use App\Models\SubArea;
use App\Models\Subscription;
use App\Models\Tariff;
use App\Models\User;
use App\Support\Branches\BranchDomainContext;
use App\Support\Branches\BranchScope;
use App\Support\Queries\DataTableFilters;
use App\Support\Queries\ReadingSheetQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Builds the weekly readings pages: the sheet, its columns and who recorded each reading.
 */
class MeterReadingPage
{
    /**
     * How many of the week's readings on the sheet (search and filters
     * applied) still wait for approval, and what they add up to.
     *
     * @return array{count: int, unusualCount: int, amountDue: string}
     */
    public static function pendingApprovalSummary(Request $request, User $actor, string $week): array
    {
        $pending = ReadingSheetQuery::pendingInSheet($request, $actor, $week);

        return [
            'count' => (clone $pending)->count(),
            'unusualCount' => (clone $pending)->whereNotNull('usual_consumption')->count(),
            'amountDue' => number_format((float) $pending->sum('amount_due'), 2, '.', ''),
        ];
    }

    /**
     * Whether the reading entry window of the actor's branch is open, and
     * whether it restricts this actor at all: only people who enter readings
     * are held to it, and the Super Admin may enter them any time.
     *
     * @return array{isOpen: bool, appliesToActor: bool, openDays: array<int, int>, opensAt: string, closesAt: string, nextOpensOn: ?string}
     */
    public static function entryWindow(User $actor): array
    {
        $setting = ReadingEntrySetting::forBranch($actor->workBranchId());

        return [
            'isOpen' => $setting->isOpen(),
            'appliesToActor' => ! $actor->isSuperAdmin() && $actor->hasPermission(PermissionKey::RecordMeterReadings),
            'openDays' => $setting->mode === ReadingEntryMode::Automatic
                ? array_map('intval', $setting->open_days)
                : [],
            'opensAt' => substr($setting->opens_at, 0, 5),
            'closesAt' => substr($setting->closes_at, 0, 5),
            'nextOpensOn' => $setting->nextOpening()?->toDateString(),
        ];
    }

    /**
     * Counts for the status tabs retain search and location filters, without
     * narrowing the other tabs to the currently selected status or page.
     *
     * @return array{total: int, pending: int, approved: int, missing: int}
     */
    public static function statusSummary(Builder $query, string $week): array
    {
        $counts = MeterReading::query()
            ->whereIn('subscription_id', (clone $query)->reorder()->select('subscriptions.id'))
            ->whereDate('week_start', $week)
            ->selectRaw('status, COUNT(*) as reading_count')
            ->groupBy('status')
            ->toBase()->pluck('reading_count', 'status');
        $total = (clone $query)->count();
        $pending = (int) ($counts[MeterReadingStatus::Pending->value] ?? 0);
        $approved = (int) ($counts[MeterReadingStatus::Approved->value] ?? 0);

        return ['total' => $total, 'pending' => $pending, 'approved' => $approved, 'missing' => $total - $pending - $approved];
    }

    /**
     * Whether the actor sees who recorded and approved each reading on the
     * sheet: those who may read the audit log (the Super Admin, and Branch
     * Admins by default), not the staff who only enter the readings.
     */
    public static function seesWhoRecorded(User $actor): bool
    {
        return $actor->hasPermission(PermissionKey::ViewTransactionAudit);
    }

    /**
     * One sheet row. A reading already entered for the week shows the
     * prices and standing discount captured with it; otherwise the
     * subscription's current price, minimum and discount are shown for the
     * live calculation.
     *
     * @return array<string, mixed>
     */
    public static function sheetRow(Subscription $subscription, Carbon $weekStart, User $actor, bool $printing = false): array
    {
        $reading = $subscription->meterReadings->first(fn (MeterReading $r) => $r->week_start->equalTo($weekStart));
        $lastBefore = $subscription->meterReadings->first(fn (MeterReading $r) => $r->week_start->lessThan($weekStart));
        [$discountMethod, $discountValue, $discountSegment] = $reading
            ? [$reading->discount_method, $reading->discount_value, $reading->discount_segment]
            : [$subscription->standingDiscount?->method, $subscription->standingDiscount?->value, $subscription->standingDiscount?->segment];

        return [
            ...($printing ? ['printDetails' => ['branchName' => $subscription->branch?->name, 'tariffName' => __($subscription->tariff->category->label()), 'breakerAmpere' => $subscription->circuitBreaker?->ampere, 'notes' => $reading?->notes]] : []),
            'id' => $subscription->id,
            'accountNumber' => $subscription->account_number,
            'fullName' => $subscription->displayName(),
            'meterBoxNumber' => $subscription->meterBox?->box_number,
            'meterBoxName' => $subscription->meterBox?->displayName(),
            'phone' => $subscription->contactPhone(),
            'subAreaName' => $subscription->meterBox?->subArea?->name,
            'previousReading' => $reading?->previous_reading ?? ($lastBefore?->nextPreviousReading() ?? (float) ($subscription->initial_reading ?? 0)),
            'unitPrice' => (string) ($reading?->unit_price ?? $subscription->kilowattPrice()),
            'minimumPayment' => (string) ($reading?->minimum_payment ?? $subscription->weeklyMinimumPayment()),
            'discount' => $discountMethod ? [
                'method' => $discountMethod->value,
                'value' => $discountValue,
                'terms' => StandingDiscount::termsFor($discountMethod, $discountValue),
                'segment' => $discountSegment,
            ] : null,
            'reading' => $reading ? [
                'id' => $reading->id,
                'currentReading' => $reading->requires_reentry ? null : $reading->current_reading,
                'requiresReentry' => $reading->requires_reentry,
                'consumption' => $reading->consumption,
                'readingFee' => $reading->reading_fee,
                'discountAmount' => $reading->discount_amount,
                'amountDue' => $reading->amount_due,
                'status' => $reading->status->value,
                'statusLabel' => __($reading->status->label()),
                // An approved reading whose bill was cancelled from the statement is not billed any more.
                'billed' => $reading->chargeLine !== null,
                // Far above what the subscription usually uses: it is approved only after being looked at and confirmed.
                'unusual' => ReadingConsumption::isUnusual($reading) ? ['usual' => $reading->usual_consumption] : null,
            ] + (self::seesWhoRecorded($actor) ? [
                'recordedByName' => $reading->recordedBy?->name,
                'recordedAt' => $reading->created_at?->timezone(config('app.business_timezone'))->format('d/m H:i'),
                'recordedSource' => $reading->mobile_operation_id !== null ? 'app' : 'web',
                'approvedByName' => $reading->approvedBy?->name,
                'approvedAt' => $reading->approved_at?->timezone(config('app.business_timezone'))->format('d/m H:i'),
            ] : []) : null,
            // The reading the week starts from, when one was entered: editable as the last reading while no week after this one has been.
            'lastReading' => $lastBefore ? [
                'id' => $lastBefore->id,
                'weekStart' => $lastBefore->week_start->toDateString(),
                'weekEnd' => $lastBefore->week_end?->toDateString(),
                'previousReading' => $lastBefore->previous_reading,
                'status' => $lastBefore->status->value,
                'canEdit' => ! $subscription->has_later_week && $actor->can('adjustLastReading', $lastBefore),
            ] : null,
            'initialReading' => $lastBefore === null ? [
                'isInitial' => true,
                'weekStart' => $weekStart->toDateString(),
                'previousReading' => 0,
                'previewUrl' => route('subscriptions.reading-baseline.preview', $subscription),
                'saveUrl' => route('subscriptions.reading-baseline.update', $subscription),
                'canEdit' => ! $subscription->has_later_week && $actor->can('adjustInitialReading', [$subscription, $weekStart]),
            ] : null,
            'hasLaterWeek' => (bool) $subscription->has_later_week,
            'canApprove' => $reading !== null && $actor->can('approve', $reading),
            'canEdit' => $reading
                ? ! $subscription->has_later_week && $actor->can('update', $reading)
                : $subscription->status === SubscriptionStatus::Active && ! $subscription->has_later_week && $actor->can('create', [MeterReading::class, $weekStart, $subscription->branch_id]),
        ];
    }

    /**
     * The Filter menu's dropdown groups.
     *
     * @return array<int, array{key: string, label: string, options: array<int, array{value: string, label: string}>}>
     */
    public static function filterOptions(User $actor, Request $request): array
    {
        $groups = [];

        $groups[] = DataTableFilters::filterGroup('subscription_status', __('Subscriber status (active by default)'), [
            ['value' => 'all', 'label' => __('All statuses')],
            ...SubscriptionStatus::options(),
        ]);

        if ($actor->isSuperAdmin()) {
            $groups[] = DataTableFilters::branchFilterGroup();
            $groups[] = DataTableFilters::areaFilterGroup(Area::orderBy('name')->get());
        }

        $groups[] = DataTableFilters::subAreaFilterGroup(SubArea::visibleTo($actor)->orderBy('name')->get());

        array_push($groups, ...DataTableFilters::meterBoxFilterGroupsFor($actor, $request));
        $groups[] = DataTableFilters::circuitBreakerFilterGroup();

        $groups[] = DataTableFilters::filterGroup('tariff_id', 'نوع الاشتراك', DataTableFilters::modelOptions(
            Tariff::orderBy('category')->get(),
            fn (Tariff $tariff) => __($tariff->category->label()),
        ));

        $groups[] = DataTableFilters::filterGroup('entry', __('Entry status'), [
            ['value' => 'missing', 'label' => __('Not entered yet')],
            ['value' => 'entered', 'label' => __('Entered')],
        ]);

        $groups[] = DataTableFilters::filterGroup('approval', __('Approval status'), [
            ['value' => MeterReadingStatus::Pending->value, 'label' => __('Awaiting approval')],
            ['value' => MeterReadingStatus::Approved->value, 'label' => __('Approved')],
        ]);

        return $groups;
    }

    public static function index(ListMeterReadingsRequest $request): InertiaResponse
    {

        $actor = auth()->user();
        if ($actor->isSuperAdmin() && BranchDomainContext::id() === null && ! $request->filled('filter.branch_id')) {
            $branches = Branch::query()->orderBy('name')->get(['id', 'name']);
            $schedules = $branches->map(fn (Branch $branch): string => json_encode([
                ReadingEntrySetting::forBranch($branch->id)->reading_day,
                ReadingEntrySetting::forBranch($branch->id)->reading_day_history,
            ]))->unique();
            if ($schedules->count() > 1) {
                return Inertia::render('MeterReadings/Branches', [
                    'branchScope' => BranchScope::describe($branches),
                    'branches' => $branches->map(function (Branch $branch): array {
                        $week = ReadingWeeks::latestEndedWeekStart($branch->id);

                        return [
                            'id' => $branch->id, 'name' => $branch->name,
                            'weekStart' => $week->toDateString(),
                            'weekEnd' => ReadingWeeks::weekEndFor($week, $branch->id)->toDateString(),
                            'url' => route('meter-readings.index', ['filter' => ['branch_id' => $branch->id]]),
                        ];
                    })->values(),
                ]);
            }
        }
        $weekBranchId = ReadingSheetQuery::sheetBranchId($request, $actor);
        $canBrowseWeeks = $actor->can('browseWeeks', MeterReading::class);
        $weekStart = ReadingSheetQuery::selectedWeek($request, $weekBranchId, $canBrowseWeeks);
        $week = $weekStart->toDateString();

        $query = ReadingSheetQuery::subscriptionsInScope($actor, $request)
            ->with([
                'tariff',
                'circuitBreaker',
                'standingDiscount',
                'meterBox.subArea',
                'meterReadings' => fn ($q) => $q->chaperone()->withLaterReadingsCount()->whereDate('week_start', '<=', $week)->orderByDesc('week_start')->limit(2)
                    ->with(['recordedBy:id,name', 'approvedBy:id,name', 'chargeLine:id,meter_reading_id']),
            ])
            ->withExists(['meterReadings as has_later_week' => fn ($q) => $q->whereDate('week_start', '>', $week)]);
        if ($request->boolean('print')) {
            $query->with('branch:id,name');
            $selected = PrintSelection::ids($request, '/meter-readings');
            if ($selected !== null) {
                $query->whereHas('meterReadings', fn (Builder $readings): Builder => $readings->whereKey($selected)->whereDate('week_start', $week));
            }
        }

        ReadingSheetQuery::withSheetColumns($query, $week);
        ReadingSheetQuery::applyMeterBoxSort($query, $request);
        DataTableFilters::applyDataTableFilters($query, $request, ['full_name', 'subscription_name', 'account_number', 'phone', 'subscription_phone'], MeterReadingController::SORTABLE, 'full_name');
        $query->orderBy('subscriptions.id');
        DataTableFilters::applyDataTableFilterSelects($query, $request, ['branch_id', 'meter_box_id', 'tariff_id']);
        DataTableFilters::applyMeterBoxNameFilter($query, $request);
        ReadingSheetQuery::applySheetFilters($query, $request, $week, includeStatus: false);
        $summaryQuery = clone $query;
        ReadingSheetQuery::applySheetStatusFilters($query, $request, $week);

        $enteredThisWeek = fn (Builder $q) => $q->whereDate('week_start', $week);

        $rows = fn () => $query->paginate(DataTableFilters::dataTablePerPage($request, 25))
            ->withQueryString()
            ->through(fn (Subscription $subscription) => MeterReadingPage::sheetRow($subscription, $weekStart, $actor, $request->boolean('print')));

        if ($request->boolean('print')) {
            $weekEnd = ReadingWeeks::weekEndFor($weekStart, $weekBranchId);
            $context = [
                'templatePage' => '/meter-readings',
                'title' => 'القراءات الأسبوعية',
                'branchName' => $actor->workBranch()?->name ?? __('All branches'),
                'readingDate' => $weekEnd->toDateString(),
                'readingDayName' => $weekEnd->locale('ar')->dayName,
                'weekStart' => $week,
                'weekEnd' => $weekEnd->toDateString(),
                'sourceUrl' => route('meter-readings.index'),
            ];

            return Inertia::render('Print/ReadingReport', ['printData' => fn (): array => ReadingPrintData::sheet($rows(), $context, MeterReadingPage::seesWhoRecorded($actor))]);
        }

        $scope = ReadingSheetQuery::subscriptionsInScope($actor, $request);
        $canApprove = $actor->can('approveAny', MeterReading::class);

        return Inertia::render('MeterReadings/Index', [
            'rows' => $rows,
            'week' => $week,
            'weekEnd' => ReadingWeeks::weekEndFor($weekStart, $weekBranchId)->toDateString(),
            // The weeks back to the first reading (at least fourteen months), for the year, month and week pickers;
            // only the latest one for someone who may not browse earlier weeks.
            'weekOptions' => fn () => ReadingWeeks::recentWeekOptions($weekBranchId, $canBrowseWeeks ? ReadingSheetQuery::weeksToOffer($actor, $weekBranchId) : 1),
            'summary' => fn () => [
                'total' => (clone $scope)->count(),
                'entered' => (clone $scope)->whereHas('meterReadings', $enteredThisWeek)->count(),
                'amountDue' => number_format((float) MeterReading::query()
                    ->whereIn('subscription_id', (clone $scope)->select('id'))
                    ->whereDate('week_start', $week)
                    ->sum('amount_due'), 2, '.', ''),
            ],
            'canRecord' => $actor->can('create', MeterReading::class),
            'canApprove' => $canApprove,
            'canSendReadingMessages' => $canApprove && $actor->can('create', MessageBatch::class),
            'messageBranchId' => $weekBranchId,
            'seesWhoRecorded' => MeterReadingPage::seesWhoRecorded($actor),
            'statusSummary' => fn () => MeterReadingPage::statusSummary($summaryQuery, $week),
            'pendingApproval' => fn () => $canApprove ? MeterReadingPage::pendingApprovalSummary($request, $actor, $week) : null,
            // The actor could record now, just not in this earlier week.
            'weekIsViewOnly' => $actor->can('create', MeterReading::class) && ! $actor->can('create', [MeterReading::class, $weekStart, $weekBranchId]),
            'entryWindow' => MeterReadingPage::entryWindow($actor),
            'filters' => DataTableFilters::dataTableState($request, 'full_name', 'asc', 25),
            'filterOptions' => fn () => MeterReadingPage::filterOptions($actor, $request),
        ]);
    }
}
