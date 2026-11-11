<?php

namespace App\Support\Readings;

use App\Enums\MeterReadingStatus;
use App\Enums\PermissionKey;
use App\Enums\ReadingEntryMode;
use App\Enums\SubscriptionStatus;
use App\Models\Area;
use App\Models\Branch;
use App\Models\MeterReading;
use App\Models\ReadingEntrySetting;
use App\Models\StandingDiscount;
use App\Models\SubArea;
use App\Models\Subscription;
use App\Models\Tariff;
use App\Models\User;
use App\Support\Queries\DataTableFilters;
use App\Support\Queries\ReadingSheetQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Builds the weekly readings pages: the sheet, its columns and who recorded each reading.
 */
class MeterReadingPage
{
    /**
     * How many of the week's readings on the sheet (search and filters
     * applied) still wait for approval, and what they add up to.
     *
     * @return array{count: int, unusualCount: int, amountDue: string}
     */
    public static function pendingApprovalSummary(Request $request, User $actor, string $week): array
    {
        $pending = ReadingSheetQuery::pendingInSheet($request, $actor, $week);

        return [
            'count' => (clone $pending)->count(),
            'unusualCount' => (clone $pending)->whereNotNull('usual_consumption')->count(),
            'amountDue' => number_format((float) $pending->sum('amount_due'), 2, '.', ''),
        ];
    }

    /**
     * Whether the reading entry window of the actor's branch is open, and
     * whether it restricts this actor at all: only people who enter readings
     * are held to it, and the Super Admin may enter them any time.
     *
     * @return array{isOpen: bool, appliesToActor: bool, openDays: array<int, int>, opensAt: string, closesAt: string, nextOpensOn: ?string}
     */
    public static function entryWindow(User $actor): array
    {
        $setting = ReadingEntrySetting::forBranch($actor->workBranchId());

        return [
            'isOpen' => $setting->isOpen(),
            'appliesToActor' => ! $actor->isSuperAdmin() && $actor->hasPermission(PermissionKey::RecordMeterReadings),
            'openDays' => $setting->mode === ReadingEntryMode::Automatic
                ? array_map('intval', $setting->open_days)
                : [],
            'opensAt' => substr($setting->opens_at, 0, 5),
            'closesAt' => substr($setting->closes_at, 0, 5),
            'nextOpensOn' => $setting->nextOpening()?->toDateString(),
        ];
    }

    /**
     * Counts for the status tabs retain search and location filters, without
     * narrowing the other tabs to the currently selected status or page.
     *
     * @return array{total: int, pending: int, approved: int, missing: int}
     */
    public static function statusSummary(Builder $query, string $week): array
    {
        $counts = MeterReading::query()
            ->whereIn('subscription_id', (clone $query)->reorder()->select('subscriptions.id'))
            ->whereDate('week_start', $week)
            ->selectRaw('status, COUNT(*) as reading_count')
            ->groupBy('status')
            ->toBase()->pluck('reading_count', 'status');
        $total = (clone $query)->count();
        $pending = (int) ($counts[MeterReadingStatus::Pending->value] ?? 0);
        $approved = (int) ($counts[MeterReadingStatus::Approved->value] ?? 0);

        return ['total' => $total, 'pending' => $pending, 'approved' => $approved, 'missing' => $total - $pending - $approved];
    }

    /**
     * Whether the actor sees who recorded and approved each reading on the
     * sheet: those who may read the audit log (the Super Admin, and Branch
     * Admins by default), not the staff who only enter the readings.
     */
    public static function seesWhoRecorded(User $actor): bool
    {
        return $actor->hasPermission(PermissionKey::ViewTransactionAudit);
    }

    /**
     * One sheet row. A reading already entered for the week shows the
     * prices and standing discount captured with it; otherwise the
     * subscription's current price, minimum and discount are shown for the
     * live calculation.
     *
     * @return array<string, mixed>
     */
    public static function sheetRow(Subscription $subscription, Carbon $weekStart, User $actor, bool $printing = false): array
    {
        $reading = $subscription->meterReadings->first(fn (MeterReading $r) => $r->week_start->equalTo($weekStart));
        $lastBefore = $subscription->meterReadings->first(fn (MeterReading $r) => $r->week_start->lessThan($weekStart));
        [$discountMethod, $discountValue, $discountSegment] = $reading
            ? [$reading->discount_method, $reading->discount_value, $reading->discount_segment]
            : [$subscription->standingDiscount?->method, $subscription->standingDiscount?->value, $subscription->standingDiscount?->segment];

        return [
            ...($printing ? ['printDetails' => ['branchName' => $subscription->branch?->name, 'tariffName' => __($subscription->tariff->category->label()), 'breakerAmpere' => $subscription->circuitBreaker?->ampere, 'notes' => $reading?->notes]] : []),
            'id' => $subscription->id,
            'accountNumber' => $subscription->account_number,
            'fullName' => $subscription->displayName(),
            'meterBoxNumber' => $subscription->meterBox?->box_number,
            'meterBoxName' => $subscription->meterBox?->displayName(),
            'phone' => $subscription->contactPhone(),
            'subAreaName' => $subscription->meterBox?->subArea?->name,
            'previousReading' => $reading?->previous_reading ?? ($lastBefore?->nextPreviousReading() ?? (float) ($subscription->initial_reading ?? 0)),
            'unitPrice' => (string) ($reading?->unit_price ?? $subscription->kilowattPrice()),
            'minimumPayment' => (string) ($reading?->minimum_payment ?? $subscription->weeklyMinimumPayment()),
            'discount' => $discountMethod ? [
                'method' => $discountMethod->value,
                'value' => $discountValue,
                'terms' => StandingDiscount::termsFor($discountMethod, $discountValue),
                'segment' => $discountSegment,
            ] : null,
            'reading' => $reading ? [
                'id' => $reading->id,
                'currentReading' => $reading->requires_reentry ? null : $reading->current_reading,
                'requiresReentry' => $reading->requires_reentry,
                'consumption' => $reading->consumption,
                'readingFee' => $reading->reading_fee,
                'discountAmount' => $reading->discount_amount,
                'amountDue' => $reading->amount_due,
                'status' => $reading->status->value,
                'statusLabel' => __($reading->status->label()),
                // An approved reading whose bill was cancelled from the statement is not billed any more.
                'billed' => $reading->chargeLine !== null,
                // Far above what the subscription usually uses: it is approved only after being looked at and confirmed.
                'unusual' => ReadingConsumption::isUnusual($reading) ? ['usual' => $reading->usual_consumption] : null,
            ] + (self::seesWhoRecorded($actor) ? [
                'recordedByName' => $reading->recordedBy?->name,
                'recordedAt' => $reading->created_at?->timezone(config('app.business_timezone'))->format('d/m H:i'),
                'recordedSource' => $reading->mobile_operation_id !== null ? 'app' : 'web',
                'approvedByName' => $reading->approvedBy?->name,
                'approvedAt' => $reading->approved_at?->timezone(config('app.business_timezone'))->format('d/m H:i'),
            ] : []) : null,
            // The reading the week starts from, when one was entered: editable as the last reading while no week after this one has been.
            'lastReading' => $lastBefore ? [
                'id' => $lastBefore->id,
                'weekStart' => $lastBefore->week_start->toDateString(),
                'weekEnd' => $lastBefore->week_end?->toDateString(),
                'previousReading' => $lastBefore->previous_reading,
                'status' => $lastBefore->status->value,
                'canEdit' => ! $subscription->has_later_week && $actor->can('adjustLastReading', $lastBefore),
            ] : null,
            'initialReading' => $lastBefore === null ? [
                'isInitial' => true,
                'weekStart' => $weekStart->toDateString(),
                'previousReading' => 0,
                'previewUrl' => route('subscriptions.reading-baseline.preview', $subscription),
                'saveUrl' => route('subscriptions.reading-baseline.update', $subscription),
                'canEdit' => ! $subscription->has_later_week && $actor->can('adjustInitialReading', [$subscription, $weekStart]),
            ] : null,
            'hasLaterWeek' => (bool) $subscription->has_later_week,
            'canApprove' => $reading !== null && $actor->can('approve', $reading),
            'canEdit' => $reading
                ? ! $subscription->has_later_week && $actor->can('update', $reading)
                : $subscription->status === SubscriptionStatus::Active && ! $subscription->has_later_week && $actor->can('create', [MeterReading::class, $weekStart, $subscription->branch_id]),
        ];
    }

    /**
     * The Filter menu's dropdown groups.
     *
     * @return array<int, array{key: string, label: string, options: array<int, array{value: string, label: string}>}>
     */
    public static function filterOptions(User $actor, Request $request): array
    {
        $groups = [];

        $groups[] = DataTableFilters::filterGroup('subscription_status', 'حالة المشترك (النشط افتراضيًا)', [
            ['value' => 'all', 'label' => 'كل الحالات'],
            ...SubscriptionStatus::options(),
        ]);

        if ($actor->isSuperAdmin()) {
            $groups[] = DataTableFilters::branchFilterGroup();
            $groups[] = DataTableFilters::areaFilterGroup(Area::orderBy('name')->get());
        }

        $groups[] = DataTableFilters::subAreaFilterGroup(SubArea::visibleTo($actor)->orderBy('name')->get());

        array_push($groups, ...DataTableFilters::meterBoxFilterGroupsFor($actor, $request));
        $groups[] = DataTableFilters::circuitBreakerFilterGroup();

        $groups[] = DataTableFilters::filterGroup('tariff_id', 'نوع الاشتراك', DataTableFilters::modelOptions(
            Tariff::orderBy('category')->get(),
            fn (Tariff $tariff) => __($tariff->category->label()),
        ));

        $groups[] = DataTableFilters::filterGroup('entry', 'حالة الإدخال', [
            ['value' => 'missing', 'label' => 'لم تُدخل بعد'],
            ['value' => 'entered', 'label' => 'تم الإدخال'],
        ]);

        $groups[] = DataTableFilters::filterGroup('approval', 'حالة الاعتماد', [
            ['value' => MeterReadingStatus::Pending->value, 'label' => 'بانتظار الاعتماد'],
            ['value' => MeterReadingStatus::Approved->value, 'label' => 'معتمدة'],
        ]);

        return $groups;
    }
}
