<?php

namespace App\Http\Controllers;

use App\Enums\CashBoxType;
use App\Http\Requests\ReplyToAuditNoteRequest;
use App\Http\Requests\ViewCashBoxesRequest;
use App\Models\Branch;
use App\Models\CashBox;
use App\Models\CashBoxPayment;
use App\Models\Subscription;
use App\Support\Closing\BranchBoxes;
use App\Support\Closing\BranchClosingAccess;
use App\Support\Closing\BranchClosingWorkflow;
use App\Support\Closing\CashBoxPage;
use App\Support\Closing\CashBoxPresenter;
use App\Support\Queries\DataTableFilters;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The financial boxes pages: the branch's boxes and open entries for those
 * who close them, a collector's own boxes, one box with its entries (or as a
 * spreadsheet), and the collector's answer to an audit note.
 */
class CashBoxController extends Controller
{
    public function __construct(private BranchClosingWorkflow $workflow, private BranchBoxes $branchBoxes) {}

    /**
     * The financial boxes: for those who close the branch's boxes, every box
     * of the branch in one table, their own among them; for a collector,
     * every box they had, filtered by `?type=` and `?state=`, each with its
     * totals, dates, who closed it and its report.
     */
    public function cashBoxes(ViewCashBoxesRequest $request): InertiaResponse
    {
        $actor = $request->user();
        if (BranchClosingAccess::view($actor)) {
            return CashBoxPage::branchCashBoxes($request);
        }
        $this->authorize('viewOwnCashBoxes', Subscription::class);

        $started = CashBoxPresenter::boxesStarted($actor);
        if ($started) {
            $this->workflow->refresh($actor->workBranchId());
        }
        $type = in_array($request->query('type'), array_column(CashBoxType::cases(), 'value'), true) ? $request->query('type') : '';
        $state = in_array($request->query('state'), ['open', 'closed'], true) ? $request->query('state') : '';
        $perPage = DataTableFilters::dataTablePerPage($request);
        $boxes = CashBoxPresenter::ownBoxQuery($actor)
            ->when($type, fn (Builder $query) => $query->where('type', $type))
            ->when($state === 'open', fn (Builder $query) => $query->whereIn('status', ['open', 'pending']))
            ->when($state === 'closed', fn (Builder $query) => $query->where('status', 'received'))
            ->paginate($perPage)->withQueryString()->through(fn (CashBox $box): array => CashBoxPresenter::cashBoxRow($box));

        return Inertia::render('Payments/CashBoxes', [
            'started' => $started,
            'branchName' => $actor->workBranch()?->name,
            'boxes' => $boxes,
            'filters' => ['type' => $type, 'state' => $state, 'per_page' => $perPage],
            ...CashBoxPresenter::collectionCounts($actor),
            'collectionUrls' => CashBoxPresenter::collectionUrls(),
        ]);
    }

    /**
     * The open entries tab of the financial boxes page, for those who close
     * the branch's boxes. A collector's open entries are on their summary,
     * where they are sent with their search and filters.
     */
    public function entries(Request $request): InertiaResponse|RedirectResponse
    {
        if (BranchClosingAccess::view($request->user())) {
            return CashBoxPage::branchEntries($request);
        }

        return redirect()->route('payments.summary', $request->only(['search', 'filter', 'per_page']));
    }

    /**
     * The entries page that was: its tab on the financial boxes page for
     * those who close the branch's boxes, else the collector's summary,
     * with the search and filters asked for.
     */
    public function movedEntries(Request $request): RedirectResponse
    {
        $query = $request->only(['branch_id', 'search', 'filter', 'per_page']);

        return BranchClosingAccess::view($request->user())
            ? redirect()->route('payments.cash-boxes.entries', $query)
            : redirect()->route('payments.summary', array_diff_key($query, ['branch_id' => true]));
    }

    /**
     * One of the actor's boxes with its entries; `?format=csv` downloads the
     * box's details and every entry as a spreadsheet, and `?print_all=1`
     * lists every entry for the printout.
     */
    public function showCashBox(Request $request, CashBox $cashBox): InertiaResponse|StreamedResponse
    {
        $this->authorize('viewOwnCashBoxes', Subscription::class);
        $actor = $request->user();
        abort_unless($cashBox->user_id === $actor->id && $cashBox->branch_id === $actor->workBranchId(), 404);
        $this->workflow->refresh($cashBox->branch_id);
        $cashBox->refresh()->loadCount(['payments' => fn ($entries) => $entries->visibleInBox()]);
        $entryQuery = $cashBox->payments()->visibleInBox()->with(['transaction.subscription:id,full_name,subscription_name,account_number', 'transaction.recordedBy:id,name'])
            ->orderByDesc('occurred_at')->orderByDesc('id');

        if ($request->query('format') === 'csv') {
            return CashBoxPage::exportCashBox($cashBox, $entryQuery->get());
        }

        $entries = $entryQuery->paginate(DataTableFilters::dataTablePerPage($request, 25))->withQueryString()->through(fn (CashBoxPayment $entry): array => CashBoxPresenter::cashBoxEntry($entry, $actor->can('viewAny', Subscription::class)));

        return Inertia::render('Payments/CashBoxShow', [
            'box' => CashBoxPresenter::cashBoxRow($cashBox), 'entries' => $entries,
            ...CashBoxPresenter::collectionCounts($actor),
            'collectionUrls' => CashBoxPresenter::collectionUrls(),
        ]);
    }

    /**
     * The collector's answer to an audit note the branch sent them.
     */
    public function replyToAuditNote(ReplyToAuditNoteRequest $request, int $auditNote): RedirectResponse
    {
        $data = $request->validated();
        $actor = $request->user();
        abort_unless($actor->workBranchId(), 403);

        $this->workflow->locked($actor->workBranchId(), function () use ($actor, $auditNote, $data): void {
            $this->workflow->collectorReply(CashBoxPresenter::waitingAuditNotes($actor)->findOrFail($auditNote), $actor, $data['body']);
        });

        return back()->with('status', 'audit-note-replied');
    }
}
