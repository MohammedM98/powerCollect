<?php

namespace App\Support\Disconnections;

use App\Http\Requests\RemoveDisconnectionItemsRequest;
use App\Http\Requests\RescheduleDisconnectionItemsRequest;
use App\Models\DisconnectionList;
use App\Models\DisconnectionListItem;
use App\Notifications\ActionCompleted;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

/**
 * Helpers for the actions on a disconnection list's items.
 */
class DisconnectionItemPage
{
    /**
     * Apply the action to each chosen item on its own and report the items
     * it could not be applied to.
     *
     * @param  callable(DisconnectionListItem): ?string  $apply  returns why it failed, or null
     */
    public static function eachItem(RescheduleDisconnectionItemsRequest|RemoveDisconnectionItemsRequest $request, DisconnectionList $list, string $action, string $status, callable $apply): RedirectResponse
    {
        $succeeded = 0;
        $failed = [];

        foreach ($request->items() as $item) {
            $why = $apply($item);

            if ($why === null) {
                $succeeded++;
            } else {
                $failed[] = self::failure($item, $why);
            }
        }

        Inertia::flash('disconnectionResult', ['action' => $action, 'succeeded' => $succeeded, 'failed' => $failed]);

        if ($succeeded === 0) {
            return back()->withErrors(['ids' => 'لم يُطبَّق الإجراء على أي مشترك؛ راجع الأسباب في التقرير.']);
        }

        $request->user()->notify(new ActionCompleted($status, $list->title.' — '.$succeeded));

        return back()->with('status', $status);
    }

    /**
     * An item an action could not be applied to, and why.
     *
     * @return array{id: int, name: string, accountNumber: ?string, reason: string}
     */
    public static function failure(DisconnectionListItem $item, string $reason): array
    {
        return [
            'id' => $item->id,
            'name' => $item->subscription->displayName(),
            'accountNumber' => $item->subscription->account_number,
            'reason' => $reason,
        ];
    }
}
