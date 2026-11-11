<?php

namespace App\Http\Controllers;

use App\Enums\MeterReadingStatus;
use App\Http\Requests\ApproveMeterReadingsRequest;
use App\Http\Requests\ListMeterReadingsRequest;
use App\Http\Requests\StoreMeterReadingRequest;
use App\Http\Requests\UpdateMeterReadingRequest;
use App\Models\MeterReading;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\ActionCompleted;
use App\Notifications\ReadingNeedsReapproval;
use App\Support\Queries\ReadingSheetQuery;
use App\Support\Readings\AdjustLastReading;
use App\Support\Readings\ApproveCorrectedReading;
use App\Support\Readings\ApproveReading;
use App\Support\Readings\MeterReadingPage;
use App\Support\Readings\ReadingCharges;
use App\Support\Readings\ReadingConsumption;
use App\Support\Readings\ReadingWeeks;
use App\Support\Readings\RepriceReading;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
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
        return MeterReadingPage::index($request);
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
