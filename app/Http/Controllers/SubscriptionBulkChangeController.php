<?php

namespace App\Http\Controllers;

use App\Enums\SubscriptionStatus;
use App\Http\Requests\ApplySubscriptionBulkChangeRequest;
use App\Models\Subscription;
use App\Models\SubscriptionBulkChange;
use App\Models\SubscriptionBulkChangeItem;
use App\Notifications\ActionCompleted;
use App\Support\Queries\DataTableFilters;
use App\Support\Subscriptions\BulkChangePage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
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

        $bulkChange = DB::transaction(function () use ($actor, $field, $byCircuitBreaker, $request, $changes): SubscriptionBulkChange {
            $locked = Subscription::query()->whereKey($changes->pluck('subscription.id'))->orderBy('id')->lockForUpdate()->get();
            if ($locked->contains(fn (Subscription $subscription): bool => $subscription->archived_at !== null)) {
                throw ValidationException::withMessages(['ids' => __('One of the chosen subscriptions was archived; refresh the list before trying again.')]);
            }

            $branchIds = $changes->pluck('subscription.branch_id')->unique();
            $bulkChange = SubscriptionBulkChange::create([
                'field' => $field,
                'value' => $byCircuitBreaker ? null : BulkChangePage::normalize($field, $request->validated('value')),
                'description' => BulkChangePage::describe($field, $byCircuitBreaker, $request->validated('value')),
                'branch_id' => $actor->isSuperAdmin() ? ($branchIds->count() === 1 ? $branchIds->first() : null) : $actor->workBranchId(),
                'user_id' => $actor->id,
                'changed_count' => $changes->count(),
            ]);

            $items = [];

            foreach ($changes as $change) {
                $subscription = $change['subscription'];
                // Becoming active starts the subscription (or connects it again), as it does when the subscription is edited.
                $becomesActive = $field === 'status'
                    && $change['new'] === SubscriptionStatus::Active->value
                    && $change['old'] !== SubscriptionStatus::Active->value;
                $sideEffects = $becomesActive ? BulkChangePage::activationEffects($subscription) : [];

                Subscription::query()->whereNull('archived_at')->whereKey($subscription->id)->update([
                    $field => $change['new'],
                    ...collect($sideEffects)->map(fn (array $effect): ?string => $effect['new'])->all(),
                ]);

                $items[] = [
                    'subscription_bulk_change_id' => $bulkChange->id,
                    'subscription_id' => $subscription->id,
                    'old_value' => $change['old'],
                    'new_value' => $change['new'],
                    'side_effects' => $sideEffects === [] ? null : json_encode($sideEffects),
                ];
            }

            foreach (array_chunk($items, 250) as $chunk) {
                SubscriptionBulkChangeItem::insert($chunk);
            }

            return $bulkChange;
        });

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

        $undone = DB::transaction(function () use ($change, $actor): bool {
            // Checked under the row lock, so a second click waits and is refused instead of recording 0 restored.
            $change->refreshForUpdate();
            if ($change->isUndone()) {
                return false;
            }

            $restored = 0;
            $change->items()->with('subscription')->lockForUpdate()->get()->each(function (SubscriptionBulkChangeItem $item) use ($change, &$restored): void {
                if ($item->subscription !== null && $item->subscription->archived_at === null && BulkChangePage::currentValue($item->subscription, $change->field) === $item->new_value) {
                    $restored += Subscription::query()->whereNull('archived_at')->whereKey($item->subscription_id)->update([
                        $change->field => $item->old_value,
                        ...BulkChangePage::effectsToPutBack($item),
                    ]);
                }
            });

            $change->update(['undone_at' => now(), 'undone_by' => $actor->id, 'restored_count' => $restored]);

            return true;
        });

        if (! $undone) {
            return back()->withErrors(['undo' => 'تم التراجع عن هذا التعديل من قبل.']);
        }

        $actor->notify(new ActionCompleted('subscriptions-bulk-undone', $change->description));

        return back()->with('status', 'subscriptions-bulk-undone');
    }
}
