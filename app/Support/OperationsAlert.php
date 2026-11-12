<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\User;
use App\Notifications\ActionCompleted;
use Illuminate\Support\Facades\Notification;

/**
 * Tells the active Super Admins, under the bell in the top bar, that a
 * background duty failed (the nightly backup, the closing run, a stuck
 * queue), so a failure is seen without reading the server log. The failure
 * is still reported to the log by the caller.
 */
class OperationsAlert
{
    /**
     * Notify every active Super Admin. `action` is a key worded by the
     * frontend's list of messages. A Super Admin who has not yet read the
     * same alert is not told again, so a duty that fails every minute does
     * not fill the bell.
     */
    public static function notifySuperAdmins(string $action, ?string $subject = null): void
    {
        $superAdmins = User::query()
            ->where('role', UserRole::SuperAdmin->value)
            ->where('is_active', true)
            ->whereDoesntHave('unreadNotifications', fn ($query) => $query->where('data->action', $action))
            ->get();

        Notification::send($superAdmins, new ActionCompleted($action, $subject));
    }
}
