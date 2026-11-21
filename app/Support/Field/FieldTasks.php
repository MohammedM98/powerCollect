<?php

namespace App\Support\Field;

use App\Enums\PermissionKey;
use App\Models\DisconnectionList;
use App\Models\MessageBatch;
use App\Models\MeterReading;
use App\Models\ReadingCycle;
use App\Models\Subscription;
use App\Models\User;
use App\Support\Closing\BranchClosingAccess;
use Closure;

/**
 * The field app's tasks: one entry per job a meter reader, collector or
 * other field worker can do, each opened by its own permission. Every user
 * signs in to the same home page and sees only the tiles they may use, so a
 * new job is one more entry here (and its permission granted on the
 * permissions page); no role name is hardcoded.
 */
final class FieldTasks
{
    /** The home page's sections, in order. */
    private const GROUPS = [
        'readings' => 'القراءات',
        'collection' => 'التحصيل',
        'follow-up' => 'المشتركون والمتابعة',
    ];

    /**
     * The user's sections, each with the tasks they may open; a section with
     * none is left out.
     *
     * @return list<array{key: string, title: string, tasks: list<array{key: string, title: string, description: string, icon: string, tone: string, href: string}>}>
     */
    public static function for(User $user): array
    {
        $allowed = array_filter(self::tasks(), fn (array $task): bool => ($task['allowed'])($user));
        $sections = [];

        foreach (self::GROUPS as $group => $title) {
            $tasks = array_values(array_map(
                fn (array $task): array => [
                    'key' => $task['key'],
                    'title' => $task['title'],
                    'description' => $task['description'],
                    'icon' => $task['icon'],
                    'tone' => $task['tone'],
                    'href' => route($task['route'], absolute: false),
                ],
                array_filter($allowed, fn (array $task): bool => $task['group'] === $group),
            ));

            if ($tasks !== []) {
                $sections[] = ['key' => $group, 'title' => $title, 'tasks' => $tasks];
            }
        }

        return $sections;
    }

    /**
     * Every task. `tone` is one of the MA tone pairs (brand, pay, owe, disc,
     * clr, split, warn) and `icon` a name from Components/Icon.jsx.
     *
     * @return list<array{key: string, group: string, title: string, description: string, icon: string, tone: string, route: string, allowed: Closure(User): bool}>
     */
    private static function tasks(): array
    {
        return [
            [
                'key' => 'record-readings',
                'group' => 'readings',
                'title' => 'إدخال القراءات',
                'description' => 'تسجيل قراءات العدادات لهذه الدورة',
                'icon' => 'gauge',
                'tone' => 'clr',
                'route' => 'meter-readings.index',
                'allowed' => fn (User $user): bool => $user->hasPermission(PermissionKey::RecordMeterReadings),
            ],
            [
                'key' => 'view-readings',
                'group' => 'readings',
                'title' => 'القراءات الأسبوعية',
                'description' => 'قراءات المشتركين والاستهلاك، عرض فقط',
                'icon' => 'chart',
                'tone' => 'clr',
                'route' => 'meter-readings.index',
                'allowed' => fn (User $user): bool => ! $user->hasPermission(PermissionKey::RecordMeterReadings) && $user->can('viewAny', MeterReading::class),
            ],
            [
                'key' => 'reading-cycles',
                'group' => 'readings',
                'title' => 'توزيع القراءات',
                'description' => 'الطبلونات وقارئو العدادات والكشوف الورقية',
                'icon' => 'layers',
                'tone' => 'split',
                'route' => 'reading-cycles.index',
                'allowed' => fn (User $user): bool => $user->can('viewAny', ReadingCycle::class),
            ],
            [
                'key' => 'record-payments',
                'group' => 'collection',
                'title' => 'تسجيل الدفعات',
                'description' => 'استلام دفعة من مشترك وطباعة الوصل',
                'icon' => 'banknotes',
                'tone' => 'pay',
                'route' => 'payments.index',
                'allowed' => fn (User $user): bool => $user->can('recordAnyPayment', Subscription::class),
            ],
            [
                'key' => 'collection-summary',
                'group' => 'collection',
                'title' => 'ملخص التحصيل',
                'description' => 'ما حصّلته اليوم وهذا الشهر',
                'icon' => 'trend-up',
                'tone' => 'pay',
                'route' => 'payments.summary',
                'allowed' => fn (User $user): bool => $user->can('viewOwnCashBoxes', Subscription::class),
            ],
            [
                'key' => 'cash-boxes',
                'group' => 'collection',
                'title' => 'الصناديق',
                'description' => 'صناديقك المفتوحة وإغلاقها',
                'icon' => 'wallet',
                'tone' => 'warn',
                'route' => 'payments.cash-boxes',
                'allowed' => fn (User $user): bool => $user->can('viewOwnCashBoxes', Subscription::class) || BranchClosingAccess::view($user),
            ],
            [
                'key' => 'subscriptions',
                'group' => 'follow-up',
                'title' => 'المشتركون',
                'description' => 'البحث عن مشترك وكشف حسابه',
                'icon' => 'users',
                'tone' => 'brand',
                'route' => 'subscriptions.index',
                'allowed' => fn (User $user): bool => $user->can('viewAny', Subscription::class),
            ],
            [
                'key' => 'disconnections',
                'group' => 'follow-up',
                'title' => 'قوائم القطع',
                'description' => 'المدرجون للقطع ومواعيدهم وإنذاراتهم',
                'icon' => 'power',
                'tone' => 'owe',
                'route' => 'disconnection-lists.index',
                'allowed' => fn (User $user): bool => $user->can('viewAny', DisconnectionList::class),
            ],
            [
                'key' => 'messages',
                'group' => 'follow-up',
                'title' => 'الرسائل',
                'description' => 'رسائل المشتركين وسجل الإرسال',
                'icon' => 'messages',
                'tone' => 'disc',
                'route' => 'messages.index',
                'allowed' => fn (User $user): bool => $user->can('viewAny', MessageBatch::class),
            ],
        ];
    }
}
