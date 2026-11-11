<?php

namespace App\Http\Controllers;

use App\Http\Requests\ArchiveSubscriptionRequest;
use App\Http\Requests\RestoreSubscriptionRequest;
use App\Models\Subscription;
use App\Models\SubscriptionArchiveEvent;
use App\Notifications\ActionCompleted;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SubscriptionArchiveController extends Controller
{
    public function store(ArchiveSubscriptionRequest $request, Subscription $subscription): RedirectResponse
    {
        DB::transaction(function () use ($request, $subscription): void {
            $current = Subscription::query()->lockForUpdate()->findOrFail($subscription->id);
            $this->authorize('archive', $current);

            if ($blocker = $current->archiveBlocker()) {
                throw ValidationException::withMessages(['archive' => $blocker]);
            }

            $current->archived_at = now();
            $current->service_ended_on = $request->validated('service_ended_on');
            $current->archive_reason = $request->validated('reason');
            $current->archived_by = $request->user()->id;
            $current->archiveEvents()->create([
                'action' => SubscriptionArchiveEvent::ARCHIVE, 'user_id' => $request->user()->id, 'user_name' => $request->user()->name,
                'reason' => $request->validated('reason'), 'service_ended_on' => $request->validated('service_ended_on'),
            ]);
            $current->save();
        });

        $request->user()->notify(new ActionCompleted('subscription-archived', $subscription->displayName()));

        return back()->with('status', 'subscription-archived');
    }

    public function destroy(RestoreSubscriptionRequest $request, Subscription $subscription): RedirectResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($request, $subscription, $data): void {
            $current = Subscription::query()->lockForUpdate()->findOrFail($subscription->id);
            $this->authorize('restore', $current);

            if ($current->archived_at === null) {
                throw ValidationException::withMessages(['archive' => __('This subscription is not archived.')]);
            }

            $current->archiveEvents()->create([
                'action' => SubscriptionArchiveEvent::RESTORE, 'user_id' => $request->user()->id, 'user_name' => $request->user()->name,
                'reason' => $data['reason'],
            ]);
            $current->archived_at = null;
            $current->archived_by = null;
            $current->service_ended_on = null;
            $current->archive_reason = null;
            $current->save();
        });

        $request->user()->notify(new ActionCompleted('subscription-restored', $subscription->displayName()));

        return back()->with('status', 'subscription-restored');
    }
}
