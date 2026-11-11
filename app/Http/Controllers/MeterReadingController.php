<?php

namespace App\Http\Controllers;

use App\Enums\MeterReadingStatus;
use App\Http\Requests\ApproveMeterReadingsRequest;
use App\Http\Requests\ListMeterReadingsRequest;
use App\Http\Requests\StoreMeterReadingRequest;
use App\Http\Requests\UpdateMeterReadingRequest;
use App\Models\Branch;
use App\Models\MessageBatch;
use App\Models\MeterReading;
use App\Models\ReadingEntrySetting;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\ActionCompleted;
use App\Notifications\ReadingNeedsReapproval;
use App\Support\Branches\BranchDomainContext;
use App\Support\Branches\BranchScope;
use App\Support\Queries\DataTableFilters;
use App\Support\Queries\ReadingSheetQuery;
use App\Support\Readings\AdjustLastReading;
use App\Support\Readings\ApproveCorrectedReading;
use App\Support\Readings\ApproveReading;
use App\Support\Readings\MeterReadingPage;
use App\Support\Readings\PrintSelection;
use App\Support\Readings\ReadingCharges;
use App\Support\Readings\ReadingConsumption;
use App\Support\Readings\ReadingPrintData;
use App\Support\Readings\ReadingWeeks;
use App\Support\Readings\RepriceReading;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class MeterReadingController extends Controller
{
    /**
     * Sortable sheet columns — the reading columns are computed per row for
     * the chosen week by withSheetColumns().
     */
    public const SORTABLE = ['full_name', 'account_number', 'meter_box_number', 'last_reading', 'current_reading', 'consumption', 'amount_due'];

    /**
     * The weekly reading sheet: one row per active subscription for the
     * chosen week, with their last reading, this week's reading (if
     * entered), and what that week costs them.
     */
    public function index(ListMeterReadingsRequest $request): InertiaResponse
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
        DataTableFilters::applyDataTableFilters($query, $request, ['full_name', 'subscription_name', 'account_number', 'phone', 'subscription_phone'], self::SORTABLE, 'full_name');
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
                'branchName' => $actor->workBranch()?->name ?? 'كل الفروع',
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

    /**
     * Store a newly created resource in storage. The reading records the
     * meter and what the week costs, with the subscription's standing
     * discount taken off, but does not charge the subscription's balance.
     */
    public function store(StoreMeterReadingRequest $request): RedirectResponse
    {
        $subscription = Subscription::with(['tariff', 'circuitBreaker', 'standingDiscount'])->findOrFail($request->integer('subscription_id'));
        $weekStart = $request->weekStart();
        $previousReading = $subscription->previousReadingBefore($weekStart);
        $currentReading = $request->float('current_reading');
        $consumption = ReadingConsumption::consumptionBetween($previousReading, $currentReading);
        $usualConsumption = ReadingConsumption::usualConsumptionIfUnusual($subscription, $consumption, $weekStart);
        $unitPrice = $subscription->kilowattPrice();
        $minimumPayment = $subscription->weeklyMinimumPayment();
        $discount = $subscription->standingDiscount;

        MeterReading::create([
            'subscription_id' => $subscription->id,
            'branch_id' => $subscription->branch_id,
            'week_start' => $weekStart,
            'week_end' => ReadingWeeks::weekEndFor($weekStart, $subscription->branch_id),
            'previous_reading' => $previousReading,
            'current_reading' => $currentReading,
            'consumption' => $consumption,
            'usual_consumption' => $usualConsumption,
            'unit_price' => $unitPrice,
            'minimum_payment' => $minimumPayment,
            'discount_method' => $discount?->method,
            'discount_value' => $discount?->value,
            'discount_segment' => $discount?->segment,
            ...ReadingCharges::chargesFor($consumption, $unitPrice, $minimumPayment, $discount?->method, $discount?->value),
            'status' => MeterReadingStatus::Pending,
            'recorded_by' => $request->user()->id,
            'notes' => $request->input('notes'),
        ]);

        $request->user()->notify(new ActionCompleted('meter-reading-created', $subscription->displayName()));

        return back()->with('status', $usualConsumption === null ? 'meter-reading-created' : 'meter-reading-created-unusual');
    }

    /**
     * Correct a reading, recalculating its charges from the price and
     * minimum captured when it was first recorded. Correcting an approved
     * reading sends it back for approval and tells the people who approve —
     * unless the corrector may approve it and asks to (`approve`, as the
     * statement's form does), when it is approved again at once and billed
     * at the corrected amount, all or nothing. A last reading edited after
     * the week following it was entered carries that week along: it starts
     * from the corrected reading and is recalculated, going back to review
     * if it was approved.
     *
     * Edited as the last reading (`as_last_reading`, its pencil) by whoever
     * may, the edit is confirmed at once: each of the two weeks that was
     * approved is approved again by them, the corrected week before the week
     * after it, so the new charges follow each other on the statement in
     * week order and nothing waits for a second approval. The week after it
     * is recalculated from its reading typed again with the edit
     * (`next_current_reading`), never from the number it had. A week the
     * edit makes unusual needs `confirm_unusual`; without it nothing is saved.
     */
    public function update(UpdateMeterReadingRequest $request, MeterReading $meterReading): RedirectResponse
    {
        $actor = $request->user();
        $nextReading = $request->nextReading();
        $confirmedAtOnce = $request->boolean('as_last_reading') && $actor->can('updateAsLastReading', $meterReading);
        [$wentBackToReview, $approvedAgain, $nextWentBackToReview, $nextApprovedAgain] = DB::transaction(function () use ($request, $meterReading, $nextReading, $actor, $confirmedAtOnce): array {
            $wentBackToReview = AdjustLastReading::correct($meterReading,
                $request->float('current_reading'),
                $request->has('notes') ? $request->input('notes') : $meterReading->notes,
                $actor,
            );
            $nextWentBackToReview = $nextReading !== null && RepriceReading::startFrom($nextReading, $meterReading->current_reading, $actor, $request->nextCurrentReading());

            if ($confirmedAtOnce) {
                return [
                    $wentBackToReview,
                    $wentBackToReview && ApproveCorrectedReading::approveCorrectedLastReading($meterReading, $actor, $request->boolean('confirm_unusual')),
                    $nextWentBackToReview,
                    $nextWentBackToReview && ApproveCorrectedReading::approveCorrectedLastReading($nextReading, $actor, $request->boolean('confirm_unusual')),
                ];
            }

            // A corrected reading that is now unusual waits for review unless the corrector confirms it.
            $approvedAgain = $wentBackToReview
                && $request->boolean('approve')
                && $actor->can('approve', $meterReading)
                && ApproveReading::handle($meterReading, $actor, $request->boolean('confirm_unusual'));

            return [$wentBackToReview, $approvedAgain, $nextWentBackToReview, false];
        });

        $actor->notify(new ActionCompleted('meter-reading-updated', $meterReading->subscription->displayName()));

        if (($wentBackToReview && ! $approvedAgain) || ($nextWentBackToReview && ! $nextApprovedAgain)) {
            Notification::send(
                $meterReading->approvers()->reject(fn (User $approver) => $approver->is($actor)),
                new ReadingNeedsReapproval($meterReading->subscription->displayName(), $actor->name),
            );
        }

        return back()->with('status', match (true) {
            $confirmedAtOnce && ($approvedAgain || $nextApprovedAgain) => 'meter-reading-last-corrected-approved',
            $approvedAgain && ! $nextWentBackToReview => 'meter-reading-corrected-approved',
            $wentBackToReview || $nextWentBackToReview => 'meter-reading-reopened',
            $nextReading !== null => 'meter-reading-last-updated',
            default => 'meter-reading-updated',
        });
    }

    /**
     * Approve the ticked readings, or `all` pending readings of the given
     * week among the subscriptions matching the sheet's search and filters.
     * Approving locks a reading and charges it to the subscription's
     * transactions; readings the actor may not approve, or that are no
     * longer pending, are skipped.
     */
    public function approve(ApproveMeterReadingsRequest $request): RedirectResponse
    {
        $actor = $request->user();
        $query = $request->boolean('all')
            ? ReadingSheetQuery::pendingInSheet($request, $actor, ReadingWeeks::weekStartFor($request->date('week'), ReadingSheetQuery::sheetBranchId($request, $actor))->toDateString())
            : ReadingSheetQuery::pendingReadings($actor)->whereKey($request->validated('reading_ids'));

        // An unusual reading is only approved when ticked on its own and confirmed, never as part of "all".
        $confirmUnusual = ! $request->boolean('all') && $request->boolean('confirm_unusual');
        $approved = $heldBack = 0;
        $query->with('subscription')->chunkById(200, function (Collection $readings) use ($actor, $confirmUnusual, &$approved, &$heldBack): void {
            foreach ($readings as $reading) {
                if (ApproveReading::handle($reading, $actor, $confirmUnusual)) {
                    $approved++;
                } elseif (ReadingConsumption::isUnusual($reading) && ! $confirmUnusual) {
                    $heldBack++;
                }
            }
        });

        if ($approved === 0) {
            return back()->withErrors(['reading_ids' => $heldBack > 0
                ? 'القراءات المختارة استهلاكها أعلى بكثير من المعتاد؛ راجعها، ثم حدّدها واعتمدها بعد تأكيدها.'
                : 'لا توجد قراءات بانتظار الاعتماد ضمن اختيارك.']);
        }

        $actor->notify(new ActionCompleted('meter-readings-approved', "عدد القراءات: {$approved}"));

        return back()->with('status', $heldBack > 0 ? 'meter-readings-approved-partly' : 'meter-readings-approved');
    }
}
