<?php

namespace App\Support\Subscriptions;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\SubscriptionBulkChange;
use App\Models\SubscriptionBulkChangeItem;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Sets one field on many subscriptions at once and keeps the change, with
 * each subscription's value before and after, for review and undo. The
 * chosen subscriptions are locked first; an archived one stops the change.
 */
class ApplyBulkChange
{
    /**
     * @param  Collection<int, array{subscription: Subscription, old: ?string, new: ?string}>  $changes
     */
    public static function handle(User $actor, string $field, bool $byCircuitBreaker, mixed $value, Collection $changes): SubscriptionBulkChange
    {
        return DB::transaction(function () use ($actor, $field, $byCircuitBreaker, $value, $changes): SubscriptionBulkChange {
            $locked = Subscription::query()->whereKey($changes->pluck('subscription.id'))->orderBy('id')->lockForUpdate()->get();
            if ($locked->contains(fn (Subscription $subscription): bool => $subscription->archived_at !== null)) {
                throw ValidationException::withMessages(['ids' => __('One of the chosen subscriptions was archived; refresh the list before trying again.')]);
            }

            $branchIds = $changes->pluck('subscription.branch_id')->unique();
            $bulkChange = SubscriptionBulkChange::create([
                'field' => $field,
                'value' => $byCircuitBreaker ? null : BulkChangePage::normalize($field, $value),
                'description' => BulkChangePage::describe($field, $byCircuitBreaker, $value),
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
    }
}
