<?php

namespace App\Support\Subscriptions;

use App\Enums\PermissionKey;
use App\Enums\SubscriptionStatus;
use App\Models\Branch;
use App\Models\CircuitBreaker;
use App\Models\MeterBox;
use App\Models\MeterReading;
use App\Models\MeterReadingAdjustment;
use App\Models\SubArea;
use App\Models\Subscription;
use App\Models\SubscriptionArchiveEvent;
use App\Models\SubscriptionTransaction;
use App\Models\Tariff;
use App\Models\TariffSegment;
use App\Models\User;
use App\Support\Ledger\LedgerAmounts;
use App\Support\Ledger\Money;
use App\Support\Queries\DataTableFilters;
use App\Support\Readings\ReadingConsumption;
use App\Support\Readings\ReadingWeeks;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Builds the subscription pages: the list's filters, the statement's reading details and the editable last reading.
 */
class SubscriptionPage
{
    /**
     * Charge the subscription's subscription fee to their account, as a
     * subscription-fee line, if it has an amount.
     */
    public static function chargeSubscriptionFee(Subscription $subscription, User $actor): void
    {
        if ($subscription->subscription_fee === null || Money::decimal($subscription->subscription_fee)->isLessThanOrEqualTo(0)) {
            return;
        }

        $subscription->transactions()->create([
            'recorded_by' => $actor->id,
            'type' => SubscriptionTransaction::TYPE_SUBSCRIPTION_FEE,
            'source_key' => 'subscription-fee:'.$subscription->id,
            'amount' => $subscription->subscription_fee,
            'currency_amount' => $subscription->subscription_fee,
        ]);
    }

    /**
     * One row of the subscriptions list: the editable fields, plus what the
     * table, the details window and the reading form display.
     *
     * @return array<string, mixed>
     */
    public static function indexRow(Subscription $subscription, User $actor, bool $canRecordReadings): array
    {
        $readings = $subscription->loadMissing('meterReadings.adjustments')->meterReadings->sortByDesc('week_start')->values();
        $latestReading = $readings->first();
        $entryWeek = ReadingWeeks::latestEndedWeekStart($subscription->branch_id);
        $entryReading = $readings->first(fn (MeterReading $reading): bool => $reading->week_start->equalTo($entryWeek));
        $hasPreviousReading = $readings->contains(fn (MeterReading $reading): bool => $reading->week_start->lessThan($entryWeek));
        $hasLaterReading = $readings->contains(fn (MeterReading $reading): bool => $reading->week_start->greaterThan($entryWeek));

        return [
            ...SubscriptionForm::subscriptionEditableFields($subscription),
            'branchName' => $subscription->branch->name,
            'governorateName' => $subscription->branch->governorate?->name,
            'areaName' => $subscription->branch->area?->name,
            'meterBoxNumber' => $subscription->meterBox?->box_number,
            'meterBoxName' => $subscription->meterBox?->displayName(),
            'subAreaId' => $subscription->meterBox?->sub_area_id,
            'subAreaName' => $subscription->meterBox?->subArea?->name,
            'tariffCategory' => $subscription->tariff->category->value,
            'tariffCategoryLabel' => __($subscription->tariff->category->label()),
            'tariffSegmentName' => $subscription->tariffSegment?->name,
            'tariffRate' => $subscription->tariff->rate,
            'kilowattPrice' => $subscription->kilowattPrice(),
            'hasOwnKilowattPrice' => $subscription->hasOwnKilowattPrice(),
            'circuitBreakerAmpere' => $subscription->circuitBreaker?->ampere,
            'standingDiscountSummary' => $subscription->standingDiscount?->summary(),
            'standingDiscount' => $subscription->standingDiscount ? ['method' => $subscription->standingDiscount->method->value, 'value' => $subscription->standingDiscount->value] : null,
            'statusLabel' => $subscription->archived_at !== null ? 'مؤرشف' : __($subscription->status->label()),
            'archivedAt' => $subscription->archived_at?->toIso8601String(),
            'serviceEndedOn' => $subscription->service_ended_on?->format('Y-m-d'),
            'archiveReason' => $subscription->archive_reason,
            'archiveHistory' => $subscription->archiveEvents->map(fn (SubscriptionArchiveEvent $event): array => $event->historyEntry())->all(),
            'canArchive' => $actor->can('archive', $subscription),
            'archiveBlocker' => $subscription->archiveBlocker(),
            'canRestore' => $subscription->archived_at !== null && $actor->can('restore', $subscription),
            'registeredByName' => $subscription->registeredBy?->name,
            'outstandingBalance' => $subscription->outstanding_balance ?? '0.00',
            'weeklyMinimumPayment' => $subscription->weeklyMinimumPayment(),
            'subscriptionCount' => $subscription->profile?->subscriptions_count ?? 1,
            'meterReadings' => $readings->map(fn (MeterReading $reading) => self::statementReading($reading, $actor)),
            'lastReading' => $latestReading?->requires_reentry ? $latestReading->previous_reading : ($latestReading?->nextPreviousReading() ?? (float) ($subscription->initial_reading ?? 0)),
            'lastReadingWeekStart' => $latestReading?->week_start->format('Y-m-d'),
            'editableLastReadingId' => self::editableLastReadingId($subscription, $readings, $actor),
            'initialReading' => ! $hasPreviousReading ? [
                'isInitial' => true, 'weekStart' => $entryWeek->toDateString(),
                'value' => $entryReading?->previous_reading ?? (float) ($subscription->initial_reading ?? 0),
                'previewUrl' => route('subscriptions.reading-baseline.preview', $subscription),
                'saveUrl' => route('subscriptions.reading-baseline.update', $subscription),
                'canEdit' => ! $hasLaterReading && $actor->can('adjustInitialReading', [$subscription, $entryWeek]),
            ] : null,
            'canRecordReading' => $canRecordReadings && ! $hasLaterReading && $subscription->status === SubscriptionStatus::Active,
            'canUpdate' => $actor->can('update', $subscription),
            'canDelete' => $actor->can('delete', $subscription),
            'canRecordPayment' => $actor->can('recordPayment', $subscription),
            'canRecordSplitPayment' => $actor->can('recordSplitPayment', Subscription::class) && $actor->can('recordPayment', $subscription),
            'canAddCharge' => $actor->can('addCharge', $subscription),
            'canAddDiscount' => $actor->can('addDiscount', $subscription),
            'canAddClearing' => $actor->can('addClearing', $subscription),
        ];
    }

    /**
     * The reading the subscription's latest week starts from — its last
     * reading — when the actor may edit it in the reading history: no week
     * after it but the latest one has been entered.
     *
     * @param  Collection<int, MeterReading>  $readings  newest first
     */
    public static function editableLastReadingId(Subscription $subscription, Collection $readings, User $actor): ?int
    {
        $latestWeekStart = ReadingWeeks::latestEndedWeekStart($subscription->branch_id);
        $lastReading = $readings->first(fn (MeterReading $reading): bool => $reading->week_start->lessThan($latestWeekStart));

        if ($lastReading === null || $readings->filter(fn (MeterReading $reading): bool => $reading->week_start->greaterThan($lastReading->week_start))->count() > 1) {
            return null;
        }

        return $actor->can('adjustLastReading', $lastReading) ? $lastReading->id : null;
    }

    /**
     * One weekly reading as listed in a subscription's statement.
     *
     * @return array<string, mixed>
     */
    public static function statementReading(MeterReading $reading, User $actor): array
    {
        return [
            'id' => $reading->id,
            'weekStart' => $reading->week_start->format('Y-m-d'),
            'weekEnd' => $reading->week_end->format('Y-m-d'),
            'previous_reading' => $reading->previous_reading,
            'current_reading' => $reading->requires_reentry ? null : $reading->current_reading,
            'nextPreviousReading' => $reading->nextPreviousReading(),
            'requiresReentry' => $reading->requires_reentry,
            'adjustmentHistory' => $reading->adjustments->map(fn (MeterReadingAdjustment $adjustment): array => $adjustment->historyEntry())->all(),
            'consumption' => $reading->consumption,
            'amountDue' => $reading->amount_due,
            'discountAmount' => $reading->discount_amount,
            'discount' => $reading->discount_method ? ['method' => $reading->discount_method->value, 'value' => $reading->discount_value] : null,
            'unitPrice' => $reading->unit_price,
            'minimumPayment' => $reading->minimum_payment,
            'status' => $reading->status->value,
            'statusLabel' => __($reading->status->label()),
            'notes' => $reading->notes,
            'recordedByName' => $reading->recordedBy?->name,
            'recordedAt' => $reading->created_at->copy()->setTimezone(config('app.business_timezone'))->format('Y-m-d H:i'),
            'recordedSource' => $reading->mobile_operation_id !== null ? 'app' : 'web',
            'minimumApplied' => $reading->discount_method === null && (float) $reading->reading_fee < (float) $reading->minimum_payment,
            'canUpdate' => $actor->can('update', $reading),
            'canApprove' => $actor->can('approve', $reading),
            'unusual' => ReadingConsumption::isUnusual($reading) ? ['usual' => $reading->usual_consumption] : null,
            'canUpdateUnitPrice' => $actor->can('updateUnitPrice', $reading),
            'canUpdateMinimumPayment' => $actor->can('updateMinimumPayment', $reading),
        ];
    }

    /**
     * Without the dedicated permission, minimum_charge is never taken from
     * the request as-is — it always tracks the chosen circuit breaker's own
     * minimum_payment (or, on update with no circuit breaker chosen, stays
     * whatever the subscription already had). This mirrors the frontend's
     * locked field, but enforced server-side so it can't be bypassed by
     * crafting a raw request.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function enforceMinimumChargePermission(User $actor, array $data, ?Subscription $existing = null): array
    {
        if (SubscriptionForm::canEditMinimumCharge($actor)) {
            return $data;
        }

        $circuitBreaker = ! empty($data['circuit_breaker_id']) ? CircuitBreaker::find($data['circuit_breaker_id']) : null;

        $data['minimum_charge'] = match (true) {
            $circuitBreaker !== null => $circuitBreaker->minimum_payment,
            $existing !== null => $existing->minimum_charge,
            default => 0,
        };

        return $data;
    }

    /**
     * The kilo price a subscriber is saved with. Only someone holding the
     * dedicated permission can give one: it is stored when it differs from
     * the tariff's, and left empty — so they follow the tariff — when it is
     * blank or equal to it. Anyone else never sets it from the request: a new
     * subscriber follows their tariff, and an existing one keeps the price
     * they have, unless their tariff was changed, which a price chosen for
     * the old one no longer fits.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function enforceKilowattPricePermission(User $actor, array $data, ?Subscription $existing = null): array
    {
        if ($actor->hasPermission(PermissionKey::UpdateSubscriptionKilowattPrice) && array_key_exists('kilowatt_price', $data)) {
            $tariffRate = Tariff::findOrFail($data['tariff_id'])->rate;

            $data['kilowatt_price'] = filled($data['kilowatt_price']) && ! Money::decimal($data['kilowatt_price'])->isEqualTo($tariffRate)
                ? $data['kilowatt_price']
                : null;

            return $data;
        }

        $data['kilowatt_price'] = $existing !== null && (int) $existing->tariff_id === (int) $data['tariff_id']
            ? $existing->kilowatt_price
            : null;

        return $data;
    }

    /**
     * The "Minimum charge" dropdown: each minimum charge (الحد الأدنى) the
     * visible subscriptions have, smallest first.
     *
     * @return array{key: string, label: string, options: array<int, array{value: string, label: string}>}
     */
    public static function minimumChargeFilterGroup(User $actor): array
    {
        return DataTableFilters::filterGroup('minimum_charge', 'الحد الأدنى', Subscription::query()
            ->readableTo($actor)
            ->whereNotNull('minimum_charge')
            ->distinct()
            ->orderBy('minimum_charge')
            ->pluck('minimum_charge')
            ->map(fn ($charge) => ['value' => (string) (float) $charge, 'label' => LedgerAmounts::formatAmount($charge).' شيكل']));
    }

    /**
     * The Filter menu's dropdown groups for the index page. The branch
     * filter only makes sense for a Super Admin — everyone else's list is
     * already scoped to their own single branch.
     *
     * @return array<int, array{key: string, label: string, options: array<int, array{value: string, label: string}>}>
     */
    public static function filterOptions(User $actor, Request $request): array
    {
        $groups = [
            DataTableFilters::filterGroup('status', 'الحالة', SubscriptionStatus::options()),
            DataTableFilters::filterGroup('tariff_id', 'نوع الاشتراك', DataTableFilters::modelOptions(
                Tariff::orderBy('category')->get(),
                fn (Tariff $tariff) => __($tariff->category->label()),
            )),
            DataTableFilters::filterGroup('tariff_segment_id', 'تصنيف الزبائن', DataTableFilters::modelOptions(TariffSegment::orderBy('name')->get(), 'name')),
            DataTableFilters::subAreaFilterGroup(SubArea::query()->visibleTo($actor)->orderBy('name')->get()),
            ...DataTableFilters::meterBoxFilterGroupsFor(
                $actor,
                $request,
                $actor->canViewAllSubscriberAccounts() ? fn (MeterBox $box) => $box->branch->name : null,
            ),
            DataTableFilters::circuitBreakerFilterGroup(),
            self::minimumChargeFilterGroup($actor),
        ];

        if ($actor->canViewAllSubscriberAccounts()) {
            $groups[] = DataTableFilters::branchFilterGroup($actor);
        }

        return $groups;
    }
}
