<?php

namespace App\Http\Controllers;

use App\Http\Requests\AdjustLastReadingRequest;
use App\Http\Requests\PreviewLastReadingRequest;
use App\Http\Requests\UpdateReadingPricingRequest;
use App\Models\MeterReading;
use App\Models\User;
use App\Notifications\ActionCompleted;
use App\Notifications\ReadingNeedsReapproval;
use App\Support\Readings\AdjustLastReading;
use App\Support\Readings\RepriceReading;
use App\Support\Readings\UpdateReadingPricing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Notification;

/**
 * Changes to a reading after the week was entered: editing it as the last
 * reading (with its preview), adjusting the reading the next week starts
 * from (a correction or a new meter, with its preview), and its price and
 * minimum.
 */
class MeterReadingAdjustmentController extends Controller
{
    public function previewAdjustment(AdjustLastReadingRequest $request, MeterReading $meterReading): JsonResponse
    {
        $newReading = $request->float('current_reading');
        $reset = $request->isMeterChange();
        $after = $reset ? [
            'consumption' => $meterReading->consumption, 'amount_due' => $meterReading->amount_due, 'unusual' => false,
        ] : RepriceReading::recalculatedBetween($meterReading, $meterReading->previous_reading, $newReading);
        $next = $meterReading->subscription->meterReadings()->where('week_start', '>', $meterReading->week_start)->first();

        return response()->json([
            'reset' => $reset, 'before' => $meterReading->nextPreviousReading(), 'after' => $newReading,
            'weeks' => [$this->previewedWeek($meterReading, $meterReading->previous_reading, $reset ? $meterReading->current_reading : $newReading, $after)],
            'clearsCurrentReading' => $next !== null,
            'removedCurrentAmount' => $next !== null && ! $next->isPending() ? $next->amount_due : '0.00',
        ]);
    }

    public function adjustLastReading(AdjustLastReadingRequest $request, MeterReading $meterReading): RedirectResponse
    {
        $actor = $request->user();
        AdjustLastReading::handle(
            $meterReading,
            $actor,
            $request->float('expected_reading'),
            $request->float('current_reading'),
            $request->isMeterChange(),
            $request->validated('reason'),
            $request->boolean('confirm_unusual'),
        );

        $actor->notify(new ActionCompleted('meter-reading-updated', $meterReading->subscription->displayName()));

        return back()->with('status', 'meter-reading-updated');
    }

    public function updatePricing(UpdateReadingPricingRequest $request, MeterReading $meterReading): RedirectResponse
    {
        $actor = $request->user();
        $reopened = UpdateReadingPricing::handle($meterReading, $actor, $request->validated());
        if ($reopened) {
            Notification::send($meterReading->approvers()->reject(fn (User $approver) => $approver->is($actor)), new ReadingNeedsReapproval($meterReading->subscription->displayName(), $actor->name));
        }

        return back()->with('status', $reopened ? 'meter-reading-reopened' : 'meter-reading-updated');
    }

    /**
     * What editing a last reading to `current_reading` would do, shown
     * before the edit is confirmed: for its week and, once entered, the week
     * after it that starts from it, the readings, consumption and amount due
     * before and after, whether the week is approved (and so approved again
     * at once on confirming) and whether the edit makes it unusual. The week
     * after it is worked out once its reading is typed again
     * (`next_current_reading`); until then its `after` is null.
     */
    public function previewLastReading(PreviewLastReadingRequest $request, MeterReading $meterReading): JsonResponse
    {
        $newReading = $request->float('current_reading');
        $nextReading = $request->nextReading();
        $nextCurrentReading = $request->nextCurrentReading();
        $corrected = RepriceReading::recalculatedBetween($meterReading, $meterReading->previous_reading, $newReading);
        $weeks = [$this->previewedWeek($meterReading, $meterReading->previous_reading, $newReading, $corrected)];

        if ($nextReading !== null) {
            $weeks[] = $this->previewedWeek($nextReading, $newReading, $nextCurrentReading, $nextCurrentReading === null ? null : RepriceReading::recalculatedBetween(
                $nextReading,
                $newReading,
                $nextCurrentReading,
                [$meterReading->id => $corrected['consumption']],
            ));
        }

        return response()->json(['weeks' => $weeks]);
    }

    /**
     * One week of the last reading's preview.
     *
     * @param  array{consumption: float, amount_due: string, unusual: bool}|null  $after  null until its reading is typed again
     * @return array{id: int, weekStart: string, weekEnd: ?string, isApproved: bool, unusual: bool, before: array<string, float|string>, after: array<string, float|string>|null}
     */
    private function previewedWeek(MeterReading $reading, float $previousReading, ?float $currentReading, ?array $after): array
    {
        return [
            'id' => $reading->id,
            'weekStart' => $reading->week_start->toDateString(),
            'weekEnd' => $reading->week_end?->toDateString(),
            'isApproved' => ! $reading->isPending(),
            'unusual' => $after['unusual'] ?? false,
            'before' => [
                'previousReading' => $reading->previous_reading,
                'currentReading' => $reading->requires_reentry ? null : $reading->current_reading,
                'consumption' => (float) $reading->consumption,
                'amountDue' => $reading->amount_due,
            ],
            'after' => $after === null ? null : [
                'previousReading' => $previousReading,
                'currentReading' => $currentReading,
                'consumption' => $after['consumption'],
                'amountDue' => $after['amount_due'],
            ],
        ];
    }
}
