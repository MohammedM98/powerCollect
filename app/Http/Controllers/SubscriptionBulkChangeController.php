<?php

namespace App\Http\Controllers;

use App\Http\Requests\ApplySubscriptionBulkChangeRequest;
use App\Models\Subscription;
use App\Models\SubscriptionBulkChange;
use App\Notifications\ActionCompleted;
use App\Support\Queries\DataTableFilters;
use App\Support\Subscriptions\ApplyBulkChange;
use App\Support\Subscriptions\BulkChangePage;
use App\Support\Subscriptions\UndoBulkChange;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Changing many subscriptions at once from the subscriptions list — their
 * minimum charge or their status — for the ticked ones or every one
 * matching the list's filters. Each change is kept with every
 * subscription's value before and after, listed on its own page, and can be
 * undone: a subscription whose value was changed again since keeps the
 * newer value.
 */
class SubscriptionBulkChangeController extends Controller
{
    /**
     * The bulk changes made so far, newest first, with one's subscriptions
     * loaded on request (`?change=` with `only: ['details']`).
     */
    public function index(Request $request): InertiaResponse
    {
        $this->authorize('viewAny', Subscription::class);

        $actor = $request->user();

        $changes = SubscriptionBulkChange::query()
            ->visibleTo($actor)
            ->with(['user', 'undoneBy', 'branch'])
            ->latest('id')
            ->paginate(DataTableFilters::dataTablePerPage($request))
            ->withQueryString()
            ->through(fn (SubscriptionBulkChange $change) => [
                'id' => $change->id,
                'field' => $change->field,
                'description' => $change->description,
                'changedCount' => $change->changed_count,
                'branchName' => $change->branch?->name ?? 'كل الفروع',
                'userName' => $change->user?->name,
                'createdAt' => $change->created_at->toIso8601String(),
                'undoneAt' => $change->undone_at?->toIso8601String(),
                'undoneBy' => $change->undoneBy?->name,
                'restoredCount' => $change->restored_count,
                'canUndo' => ! $change->isUndone() && $actor->can('bulkUpdate', [Subscription::class, $change->field]),
            ]);

        return Inertia::render('Subscriptions/BulkChanges', [
            'changes' => $changes,
            'filters' => DataTableFilters::dataTableState($request, 'created_at', 'desc'),
            'details' => Inertia::optional(fn () => BulkChangePage::details($request, $actor)),
        ]);
    }

    /**
     * Set the field for every chosen subscription whose value differs, and
     * keep the change for review and undo.
     */
    public function store(ApplySubscriptionBulkChangeRequest $request): RedirectResponse
    {
        $actor = $request->user();
        $field = $request->validated('field');
        if ($field === 'meter_box_id') {
            return BulkChangePage::moveMeterBoxes($request, $actor);
        }
        $byCircuitBreaker = $field === 'minimum_charge' && $request->validated('mode') === 'circuit_breaker';

        $subscriptions = BulkChangePage::chosenSubscriptions($request, $actor)->with('circuitBreaker')->limit(ApplySubscriptionBulkChangeRequest::MAX_SUBSCRIPTIONS + 1)->get();

        if ($subscriptions->count() > ApplySubscriptionBulkChangeRequest::MAX_SUBSCRIPTIONS) {
            return back()->withErrors(['ids' => 'يمكن تعديل '.ApplySubscriptionBulkChangeRequest::MAX_SUBSCRIPTIONS.' مشترك على الأكثر في المرة الواحدة؛ ضيّق الفلاتر.']);
        }

        if ($request->has('expected_count') && $subscriptions->count() !== (int) $request->validated('expected_count')) {
            return back()->withErrors(['ids' => 'تغيّرت النتائج المطابقة منذ تحديدها. حدّث الصفحة وحدّد الاشتراكات مجددًا قبل التطبيق.']);
        }

        $changes = $subscriptions
            ->map(fn (Subscription $subscription) => [
                'subscription' => $subscription,
                'old' => BulkChangePage::currentValue($subscription, $field),
                'new' => BulkChangePage::normalize($field, $byCircuitBreaker ? $subscription->circuitBreaker?->minimum_payment : $request->validated('value')),
            ])
            ->filter(fn (array $change) => $change['new'] !== null && $change['new'] !== $change['old'])
            ->values();
        $backToWaiting = $changes->filter(fn (array $change) => BulkChangePage::returnsToWaiting($field, $change));
        $changes = $changes->reject(fn (array $change) => BulkChangePage::returnsToWaiting($field, $change))->values();
        $missingReading = $changes->filter(fn (array $change) => BulkChangePage::activatesWithoutReading($field, $change));
        $changes = $changes->reject(fn (array $change) => BulkChangePage::activatesWithoutReading($field, $change))->values();

        if ($changes->isEmpty()) {
            return back()->withErrors(['ids' => match (true) {
                $backToWaiting->isNotEmpty() => 'لا يمكن إعادة مشترك سبق تفعيله إلى «قيد الانتظار»؛ غيّر حالته إلى «مفصول».',
                $missingReading->isNotEmpty() => 'لا يمكن تفعيل مشترك قبل إدخال قراءته السابقة؛ أدخلها من «تعديل المشترك» أولًا.',
                default => 'لا يوجد بين المختارين من تتغير قيمته.',
            }]);
        }

        $bulkChange = ApplyBulkChange::handle($actor, $field, $byCircuitBreaker, $request->validated('value'), $changes);

        $actor->notify(new ActionCompleted('subscriptions-bulk-changed', $bulkChange->description.' — '.$bulkChange->changed_count));

        return back()->with('status', 'subscriptions-bulk-changed');
    }

    /**
     * Put back each subscription's value from before the change — unless it
     * was changed again since, which then stays.
     */
    public function undo(Request $request, SubscriptionBulkChange $change): RedirectResponse
    {
        $actor = $request->user();

        abort_unless(SubscriptionBulkChange::query()->visibleTo($actor)->whereKey($change->id)->exists(), 404);
        $this->authorize('bulkUpdate', [Subscription::class, $change->field]);

        if ($change->field === 'meter_box_id') {
            return BulkChangePage::undoMeterBoxMove($change, $actor);
        }

        $undone = UndoBulkChange::handle($change, $actor);

        if (! $undone) {
            return back()->withErrors(['undo' => 'تم التراجع عن هذا التعديل من قبل.']);
        }

        $actor->notify(new ActionCompleted('subscriptions-bulk-undone', $change->description));

        return back()->with('status', 'subscriptions-bulk-undone');
    }
}
