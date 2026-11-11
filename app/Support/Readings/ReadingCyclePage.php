<?php

namespace App\Support\Readings;

use App\Enums\ReadingAssignmentChannel;
use App\Enums\ReadingAssignmentStatus;
use App\Enums\ReadingSubmissionStatus;
use App\Models\MeterBox;
use App\Models\PaperSheet;
use App\Models\ReadingCycle;
use App\Models\ReadingDistribution;
use App\Models\ReadingEntrySetting;
use App\Models\SubArea;
use App\Models\User;
use App\Support\Branches\BranchDomainContext;
use App\Support\Reports\DailySeries;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Helpers for the reading cycle pages.
 */
class ReadingCyclePage
{
    /**
     * How many of each box's subscriptions have the cycle week's reading.
     *
     * @param  Collection<int, int>  $boxIds
     * @return array<int, int>
     */
    public static function readCounts(ReadingCycle $cycle, Collection $boxIds): array
    {
        return DB::table('meter_readings')
            ->join('subscriptions', 'subscriptions.id', '=', 'meter_readings.subscription_id')
            ->whereIn('subscriptions.meter_box_id', $boxIds)
            ->whereDate('meter_readings.week_start', $cycle->week_start->toDateString())
            ->groupBy('subscriptions.meter_box_id')
            ->pluck(DB::raw('count(*)'), 'subscriptions.meter_box_id')
            ->map(fn ($count) => (int) $count)
            ->all();
    }

    public static function show(Request $request, ReadingCycle $readingCycle): InertiaResponse
    {

        $actor = $request->user();
        $cycle = $readingCycle->load('branch');
        $boxes = $cycle->eligibleMeterBoxes();
        $assignments = $cycle->assignments()->with(['user', 'approvedBy:id,name'])->get()->keyBy('meter_box_id');
        $readCounts = ReadingCyclePage::readCounts($cycle, $boxes->pluck('id'));
        $readers = $cycle->eligibleReaders();
        $previous = $cycle->previous();
        $defaults = ReadingDistribution::query()->where('branch_id', $cycle->branch_id)->get()->keyBy('meter_box_id');
        $schedule = ReadingEntrySetting::forBranch($cycle->branch_id);
        $dateBounds = $cycle->readingDateBounds();

        $boards = $boxes->map(function (MeterBox $box) use ($assignments, $readCounts, $defaults): array {
            $assignment = $assignments->get($box->id);
            $allocated = $assignment !== null && $assignment->status !== ReadingAssignmentStatus::Unassigned;

            return [
                'id' => $box->id,
                'recurringUserId' => $defaults->get($box->id)?->user_id,
                'recurringChannel' => $defaults->get($box->id)?->channel?->value,
                'number' => $box->box_number,
                'name' => $box->displayName(),
                'subAreaId' => $box->sub_area_id,
                'subAreaName' => $box->subArea?->name,
                'subscribers' => (int) $box->active_subscriptions_count,
                'read' => (int) ($readCounts[$box->id] ?? 0),
                'version' => $assignment?->version ?? 0,
                'column' => match (true) {
                    ! $allocated => 'available',
                    $assignment->channel === ReadingAssignmentChannel::Paper => 'paper',
                    default => 'reader:'.$assignment->user_id,
                },
                'assignmentId' => $allocated ? $assignment->id : null,
                'status' => $allocated ? $assignment->status->value : null,
                'approvedBy' => $allocated ? $assignment->approvedBy?->name : null,
                'downloaded' => $allocated && $assignment->wasDownloaded(),
                'downloadedCurrent' => $allocated && $assignment->isDownloaded(),
            ];
        })->values();

        $abilities = [
            'manage' => $actor->can('manage', $cycle) && ! $cycle->isClosed(),
            'manageCycle' => $actor->can('manage', $cycle),
            'approve' => $actor->can('approve', $cycle) && ! $cycle->isClosed(),
            'printSheets' => $actor->can('printSheets', $cycle),
            'review' => $actor->can('review', $cycle),
        ];

        return Inertia::render('ReadingCycles/Show', [
            'cycle' => [
                'id' => $cycle->id,
                'branchName' => $cycle->branch->name,
                'weekStart' => $cycle->week_start->toDateString(),
                'weekEnd' => $cycle->week_end->toDateString(),
                'readingDate' => $cycle->reading_date->toDateString(),
                'availableOn' => $cycle->reading_date->copy()->subDays($schedule->assignment_lead_days ?? 1)->toDateString(),
                'assignmentLeadDays' => $schedule->assignment_lead_days ?? 1,
                'readingDayName' => $cycle->reading_date->locale('ar')->dayName,
                'scheduledReadingDate' => $dateBounds['weekEnd']->toDateString(),
                'minReadingDate' => $dateBounds['min']->toDateString(),
                'maxReadingDate' => $dateBounds['max']->toDateString(),
                'stage' => $cycle->stage(),
                'notes' => $cycle->notes,
                'isClosed' => $cycle->isClosed(),
                'hasPrevious' => $previous !== null,
                'previousLabel' => $previous ? 'الأسبوع المنتهي '.$previous->week_end->toDateString() : null,
            ],
            'showBranchSelector' => BranchDomainContext::id() === null && $actor->isSuperAdmin(),
            'boards' => $boards,
            'readers' => $readers->map(fn (User $reader) => ['id' => $reader->id, 'name' => $reader->name])->values(),
            'subAreaOptions' => SubArea::query()->whereIn('id', $boxes->pluck('sub_area_id')->filter()->unique())->orderBy('name')->get()->map(fn (SubArea $subArea) => ['value' => (string) $subArea->id, 'label' => $subArea->name])->values(),
            'paperSheets' => $abilities['printSheets'] || $abilities['manage'] ? $cycle->paperSheets()->withCount('assignments')->with('lastPrintedBy:id,name')->latest('id')->get()->map(fn (PaperSheet $sheet) => [
                'id' => $sheet->id,
                'number' => $sheet->sheet_number,
                'boxes' => (int) $sheet->assignments_count,
                'printCount' => $sheet->print_count,
                'lastPrintedAt' => $sheet->last_printed_at?->timezone(config('app.business_timezone'))->format('Y-m-d H:i'),
                'lastPrintedBy' => $sheet->lastPrintedBy?->name,
            ])->values() : [],
            'reviewCount' => $cycle->submissions()->where('status', ReadingSubmissionStatus::NeedsReview)->count(),
            'abilities' => $abilities,
            'today' => DailySeries::today()->toDateString(),
        ]);
    }
}
