<?php

namespace App\Http\Controllers\Mobile;

use App\Enums\PermissionKey;
use App\Enums\ReadingAssignmentChannel;
use App\Enums\ReadingAssignmentStatus;
use App\Enums\SubscriptionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\SyncMobileReadingsRequest;
use App\Http\Resources\Mobile\ReadingAssignmentResource;
use App\Models\Branch;
use App\Models\MeterBox;
use App\Models\ReadingAssignment;
use App\Models\ReadingCycle;
use App\Models\ReadingDistribution;
use App\Models\ReadingEntrySetting;
use App\Models\Subscription;
use App\Models\User;
use App\Support\Readings\FieldReadingSync;
use App\Support\Readings\RecurringReadingDistribution;
use App\Support\Reports\DailySeries;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The field reader's assignments for the app to keep offline, and the
 * readings it uploads for them. Assignments can be downloaded ahead of the
 * reading day and viewed, but readings are entered on the reading day only
 * (`entry_open`); each comes with a signed work authorisation that its
 * readings carry back.
 */
class MobileReadingAssignmentController extends Controller
{
    /** The most readings one upload may carry. */
    public const MAX_READINGS = 200;

    public function __construct(private FieldReadingSync $sync) {}

    /**
     * The reader's approved assignments of open cycles whose readings can
     * still be uploaded, with each box's active subscriptions. Downloading
     * marks each one downloaded at its version.
     */
    public function index(Request $request, RecurringReadingDistribution $distribution): JsonResponse
    {
        $reader = $request->user();
        abort_unless($reader->hasPermission(PermissionKey::RecordMeterReadings), 403);

        $today = DailySeries::today();
        $branch = Branch::query()->find($reader->workBranchId());
        if ($branch !== null) {
            $distribution->prepare($branch);
        }
        $leadDays = ReadingEntrySetting::forBranch($reader->workBranchId())->assignment_lead_days ?? 1;
        $assignments = ReadingAssignment::query()
            ->forMobileReader($reader)
            ->whereHas('cycle', fn (Builder $cycles) => $cycles->whereDate('reading_date', '>=', $today->copy()->subDays(ReadingCycle::SYNC_GRACE_DAYS)->toDateString()))
            ->with(['cycle', 'meterBox.subArea'])
            ->orderBy('reading_cycle_id')
            ->get()
            ->filter(fn (ReadingAssignment $assignment): bool => $today->toDateString() >= $assignment->cycle->reading_date->copy()
                ->subDays($leadDays)->toDateString())
            ->values();

        DB::transaction(function () use ($assignments, $reader): void {
            foreach ($assignments as $assignment) {
                if (! $assignment->isDownloaded()) {
                    $assignment->update(['downloaded_at' => now(), 'downloaded_version' => $assignment->version]);
                    $assignment->recordEvent('downloaded', $reader, $assignment->channel, $assignment->user_id);
                }
            }
        });

        return response()->json([
            'server_time' => now()->toIso8601String(),
            'business_date' => $today->toDateString(),
            'next_reading' => $branch === null ? null : $this->nextReading($reader, $branch, $distribution),
            'assignments' => $assignments->map(fn (ReadingAssignment $assignment): ReadingAssignmentResource => new ReadingAssignmentResource($assignment, $today->toDateString()))->values(),
        ]);
    }

    /**
     * Upload readings taken offline. Each is answered on its own — accepted,
     * held for review or refused — and an upload retried with the same
     * operation ids is answered the same way without saving anything twice.
     */
    public function sync(SyncMobileReadingsRequest $request): JsonResponse
    {
        $reader = $request->user();

        $validated = $request->validated();

        return response()->json([
            'results' => array_map(fn (array $reading): array => $this->sync->submit($reader, $reading), $validated['readings']),
        ]);
    }

    /**
     * Preview the effective upcoming distribution without issuing work authorisations
     * or marking boxes downloaded before the configured download window.
     *
     * @return array<string, mixed>
     */
    private function nextReading(User $reader, Branch $branch, RecurringReadingDistribution $distribution): array
    {
        $upcoming = $distribution->upcoming($branch);
        $overrides = $upcoming['cycle']?->assignments()->get()->keyBy('meter_box_id') ?? collect();
        $boxIds = ReadingDistribution::query()->where('branch_id', $branch->id)
            ->where('channel', ReadingAssignmentChannel::Mobile)->where('user_id', $reader->id)
            ->whereNotIn('meter_box_id', $overrides->keys())->pluck('meter_box_id')
            ->merge($overrides->filter(fn (ReadingAssignment $assignment): bool => $assignment->status === ReadingAssignmentStatus::Approved
                && $assignment->channel === ReadingAssignmentChannel::Mobile && $assignment->user_id === $reader->id)->keys());
        $active = fn (Builder $subscriptions) => $subscriptions->where('branch_id', $branch->id)
            ->where('status', SubscriptionStatus::Active)->whereNull('archived_at');
        $boxes = MeterBox::query()->where('branch_id', $branch->id)->whereIn('id', $boxIds)
            ->whereHas('subscriptions', $active)->withCount(['subscriptions as subscribers' => $active])
            ->with(['subArea', 'subscriptions' => fn (HasMany $subscriptions): Builder => $active($subscriptions->getQuery())->orderBy('account_number')])
            ->orderBy('name')->orderBy('name_suffix')->orderBy('box_number')->get();

        return [
            'reading_date' => $upcoming['readingDate']->toDateString(),
            'boxes' => $boxes->map(fn (MeterBox $box): array => [
                'id' => $box->id, 'name' => $box->displayName(), 'number' => $box->box_number,
                'location' => $box->location, 'sub_area_id' => $box->sub_area_id,
                'sub_area_name' => $box->subArea?->name, 'subscribers' => (int) $box->subscribers,
                'subscriptions' => $box->subscriptions->map(fn (Subscription $subscription): array => [
                    'id' => $subscription->id, 'name' => $subscription->displayName(),
                    'account_number' => $subscription->account_number, 'phone' => $subscription->contactPhone(),
                ])->values(),
            ])->values(),
        ];
    }
}
