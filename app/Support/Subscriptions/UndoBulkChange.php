<?php

namespace App\Support\Subscriptions;

use App\Models\Subscription;
use App\Models\SubscriptionBulkChange;
use App\Models\SubscriptionBulkChangeItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Puts back each subscription's value from before a bulk change, unless it
 * was changed again since, which then stays.
 */
class UndoBulkChange
{
    /**
     * Whether the change was undone now: false when it had already been.
     */
    public static function handle(SubscriptionBulkChange $change, User $actor): bool
    {
        return DB::transaction(function () use ($change, $actor): bool {
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
    }
}
