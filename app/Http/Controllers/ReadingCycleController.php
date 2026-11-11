<?php

namespace App\Http\Controllers;

use App\Http\Requests\PrepareReadingCycleRequest;
use App\Http\Requests\StoreReadingCycleRequest;
use App\Http\Requests\UpdateReadingCycleRequest;
use App\Models\Branch;
use App\Models\ReadingCycle;
use App\Notifications\ActionCompleted;
use App\Support\Branches\BranchDomainContext;
use App\Support\Readings\ReadingAllocation;
use App\Support\Readings\ReadingCyclePage;
use App\Support\Readings\ReadingWeeks;
use App\Support\Readings\RecurringReadingDistribution;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Reading cycles: each branch's reading weeks prepared ahead, and the board
 * where a cycle's meter boxes are allocated to field readers or to paper
 * sheets and approved.
 */
class ReadingCycleController extends Controller
{
    public function __construct(private ReadingAllocation $allocation) {}

    /** Show the upcoming reading directly inside a branch. */
    public function index(Request $request, RecurringReadingDistribution $distribution): InertiaResponse
    {
        $this->authorize('viewAny', ReadingCycle::class);
        $actor = $request->user();
        $branchId = BranchDomainContext::id() ?? ($actor->isSuperAdmin() ? null : $actor->workBranchId());

        if ($branchId !== null) {
            $branch = Branch::query()->findOrFail($branchId);
            $upcoming = $distribution->upcoming($branch);
            $cycle = $actor->can('create', ReadingCycle::class)
                ? $distribution->prepare($branch, $actor, false)
                : $upcoming['cycle'];

            if ($cycle !== null) {
                return $this->show($request, $cycle);
            }

            return Inertia::render('ReadingCycles/Index', [
                'distributionBranches' => [],
                'branch' => ['name' => $branch->name, 'readingDate' => $upcoming['readingDate']->toDateString()],
                'canCreate' => false,
            ]);
        }

        // Only a Super Admin reaches here without a branch of their own, and chooses among the branches.
        $canChooseBranch = $actor->isSuperAdmin();

        return Inertia::render('ReadingCycles/Index', [
            'branch' => null,
            'canCreate' => $actor->can('create', ReadingCycle::class),
            'distributionBranches' => $canChooseBranch ? Branch::query()->where('is_active', true)->orderBy('name')->get()
                ->map(function (Branch $branch) use ($distribution): array {
                    $upcoming = $distribution->upcoming($branch);

                    return [
                        'id' => $branch->id, 'name' => $branch->name,
                        'readingDate' => $upcoming['readingDate']->toDateString(),
                        'readingDayName' => $upcoming['readingDate']->locale('ar')->dayName,
                        'cycleId' => $upcoming['cycle']?->id,
                    ];
                })->values() : [],
        ]);
    }

    /**
     * Prepare a reading cycle for one of the branch's weeks.
     */
    public function store(StoreReadingCycleRequest $request): RedirectResponse
    {
        $branch = $request->branch();
        $weekStart = Carbon::parse($request->validated('week_start'));

        $cycle = ReadingCycle::create([
            'branch_id' => $branch->id,
            'week_start' => $weekStart->toDateString(),
            'week_end' => ReadingWeeks::weekEndFor($weekStart, $branch)->toDateString(),
            'reading_date' => $request->validated('reading_date'),
            'notes' => $request->validated('notes'),
            'created_by' => $request->user()->id,
        ]);

        $request->user()->notify(new ActionCompleted('reading-cycle-created', $branch->name.' — '.$cycle->reading_date->toDateString()));

        return redirect()->route('reading-cycles.show', $cycle)->with('status', 'reading-cycle-created');
    }

    public function prepare(PrepareReadingCycleRequest $request, RecurringReadingDistribution $distribution): RedirectResponse
    {
        $validated = $request->validated();
        $branch = Branch::query()->findOrFail($validated['branch_id']);
        abort_unless($request->user()->isSuperAdmin() || $branch->id === $request->user()->workBranchId(), 403);
        $cycle = $distribution->prepare($branch, $request->user(), false);

        return redirect()->route('reading-cycles.show', $cycle);
    }

    /**
     * The cycle's allocation board: the boxes still available, each reader's
     * boxes, the paper boxes, the paper sheets printed, and how far the
     * readings have come.
     */
    public function show(Request $request, ReadingCycle $readingCycle): InertiaResponse
    {
        $this->authorize('view', $readingCycle);

        return ReadingCyclePage::show($request, $readingCycle);
    }

    /**
     * Move the cycle's reading day (within the days its week allows), change
     * its notes, or close or reopen it.
     */
    public function update(UpdateReadingCycleRequest $request, ReadingCycle $readingCycle): RedirectResponse
    {
        $dateBounds = $readingCycle->readingDateBounds();

        $validated = $request->validated();

        $data = collect($validated)->only(['reading_date', 'notes'])->all();

        if (array_key_exists('reading_date', $validated)) {
            $data['week_end'] = $dateBounds['weekEnd']->toDateString();
        }

        if (array_key_exists('closed', $validated)) {
            $data += $validated['closed']
                ? ($readingCycle->isClosed() ? [] : ['closed_at' => now(), 'closed_by' => $request->user()->id])
                : ['closed_at' => null, 'closed_by' => null];
        }

        $readingCycle->update($data);
        $request->user()->notify(new ActionCompleted('reading-cycle-updated', $readingCycle->reading_date->toDateString()));

        return back()->with('status', 'reading-cycle-updated');
    }

    /**
     * Start the allocation from the branch's previous cycle, as drafts.
     */
    public function copyPrevious(Request $request, ReadingCycle $readingCycle): RedirectResponse
    {
        $this->authorize('manage', $readingCycle);

        if ($readingCycle->isClosed()) {
            return back()->withErrors(['copy' => 'دورة القراءة مغلقة.']);
        }

        $result = $this->allocation->copyPrevious($readingCycle, $request->user());
        Inertia::flash('allocationResult', ['action' => 'copy', 'moved' => $result['copied'], 'conflicts' => $result['skipped']]);

        return back()->with('status', 'reading-cycle-copied');
    }
}
