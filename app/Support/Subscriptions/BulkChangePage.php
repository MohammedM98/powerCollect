<?php

namespace App\Support\Subscriptions;

use App\Enums\SubscriptionStatus;
use App\Http\Requests\ApplySubscriptionBulkChangeRequest;
use App\Models\MeterBox;
use App\Models\Subscription;
use App\Models\SubscriptionBulkChange;
use App\Models\SubscriptionBulkChangeItem;
use App\Models\User;
use App\Notifications\ActionCompleted;
use App\Support\Ledger\Money;
use App\Support\Queries\SubscriptionListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Builds the bulk change pages: the subscriptions chosen, each one's current and new values, and the change history.
 */
class BulkChangePage
{
    /**
     * The subscriptions chosen in the list, among those the actor may see.
     */
    public static function chosenSubscriptions(ApplySubscriptionBulkChangeRequest $request, User $actor): Builder
    {
        $query = Subscription::query()
            ->select('subscriptions.*')
            ->selectRaw("COALESCE(NULLIF(subscription_name, ''), full_name) as display_name")
            ->whereNull('subscriptions.archived_at')
            ->visibleTo($actor);

        return $request->boolean('all')
            ? SubscriptionListQuery::applySubscriptionListFilters($query, $request)
            : $query->whereIn('subscriptions.id', $request->validated('ids'));
    }

    public static function moveMeterBoxes(ApplySubscriptionBulkChangeRequest $request, User $actor): RedirectResponse
    {
        $bulkChange = DB::transaction(function () use ($request, $actor): SubscriptionBulkChange {
            $target = MeterBox::query()->visibleTo($actor)->lockForUpdate()->find($request->validated('value'));
            if ($target === null) {
                throw ValidationException::withMessages(['value' => 'اختر طبلونًا متاحًا ضمن فرع الاشتراكات المحددة.']);
            }

            $subscriptions = self::chosenSubscriptions($request, $actor)
                ->orderBy('subscriptions.id')->limit(ApplySubscriptionBulkChangeRequest::MAX_SUBSCRIPTIONS + 1)->lockForUpdate()->get();

            if ($subscriptions->isEmpty() || $subscriptions->count() > ApplySubscriptionBulkChangeRequest::MAX_SUBSCRIPTIONS
                || $subscriptions->count() !== (int) $request->validated('expected_count')
                || (! $request->boolean('all') && $subscriptions->count() !== count(array_unique($request->validated('ids'))))) {
                throw ValidationException::withMessages(['ids' => 'تغيّرت الاشتراكات المحددة أو تعذّر الوصول إليها. حدّد من 1 إلى 5,000 اشتراك متاح وأعد المراجعة.']);
            }

            if ($subscriptions->contains(fn (Subscription $subscription): bool => $subscription->branch_id !== $target->branch_id)) {
                throw ValidationException::withMessages(['value' => 'النقل متاح داخل الفرع نفسه فقط. اختر اشتراكات وطبلونًا من الفرع نفسه.']);
            }

            $changes = $subscriptions->filter(fn (Subscription $subscription): bool => $subscription->meter_box_id !== $target->id);
            if ($changes->isEmpty()) {
                throw ValidationException::withMessages(['ids' => 'كل الاشتراكات المحددة موجودة في هذا الطبلون بالفعل.']);
            }

            $bulkChange = SubscriptionBulkChange::create([
                'field' => 'meter_box_id',
                'value' => (string) $target->id,
                'description' => 'نقل إلى الطبلون ← '.$target->label(),
                'branch_id' => $target->branch_id,
                'user_id' => $actor->id,
                'changed_count' => $changes->count(),
            ]);

            foreach ($changes->chunk(250) as $chunk) {
                SubscriptionBulkChangeItem::insert($chunk->map(fn (Subscription $subscription): array => [
                    'subscription_bulk_change_id' => $bulkChange->id,
                    'subscription_id' => $subscription->id,
                    'old_value' => self::currentValue($subscription, 'meter_box_id'),
                    'new_value' => (string) $target->id,
                ])->values()->all());
                Subscription::query()->whereKey($chunk->modelKeys())->update(['meter_box_id' => $target->id]);
            }

            return $bulkChange;
        });

        $actor->notify(new ActionCompleted('subscriptions-bulk-changed', $bulkChange->description.' — '.$bulkChange->changed_count));

        return back()->with('status', 'subscriptions-bulk-changed');
    }

    public static function undoMeterBoxMove(SubscriptionBulkChange $change, User $actor): RedirectResponse
    {
        DB::transaction(function () use ($change, $actor): void {
            $change->refreshForUpdate();
            if ($change->isUndone()) {
                throw ValidationException::withMessages(['undo' => 'تم التراجع عن هذا التعديل من قبل.']);
            }

            $items = $change->items()->get();
            $oldBoxes = MeterBox::query()->visibleTo($actor)->whereKey($items->pluck('old_value')->filter()->unique())->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $subscriptions = Subscription::query()->visibleTo($actor)->whereNull('archived_at')->whereKey($items->pluck('subscription_id'))->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $restored = 0;

            foreach ($items as $item) {
                $subscription = $subscriptions->get($item->subscription_id);
                $oldBox = $oldBoxes->get($item->old_value);
                if ($subscription === null || self::currentValue($subscription, 'meter_box_id') !== $item->new_value
                    || $subscription->branch_id !== $change->branch_id
                    || ($item->old_value !== null && ($oldBox === null || $oldBox->branch_id !== $subscription->branch_id))) {
                    continue;
                }

                $subscription->update(['meter_box_id' => $item->old_value]);
                $restored++;
            }

            $change->update(['undone_at' => now(), 'undone_by' => $actor->id, 'restored_count' => $restored]);
        });

        $actor->notify(new ActionCompleted('subscriptions-bulk-undone', $change->description));

        return back()->with('status', 'subscriptions-bulk-undone');
    }

    /**
     * One bulk change's subscriptions with their value before and after,
     * and what each has now.
     *
     * @return array{id: int, field: string, items: Collection<int, array<string, mixed>>}|null
     */
    public static function details(Request $request, User $actor): ?array
    {
        $change = SubscriptionBulkChange::query()->visibleTo($actor)->find($request->integer('change'));

        if ($change === null) {
            return null;
        }

        $items = $change->items()->with('subscription')->get();
        $meterBoxLabels = $change->field === 'meter_box_id'
            ? MeterBox::query()->visibleTo($actor)->whereKey($items->flatMap(fn (SubscriptionBulkChangeItem $item): array => [$item->old_value, $item->new_value, $item->subscription?->meter_box_id])->filter()->unique())->get()->mapWithKeys(fn (MeterBox $box): array => [$box->id => $box->label()])->all()
            : [];

        return [
            'id' => $change->id,
            'field' => $change->field,
            'items' => $items->map(fn (SubscriptionBulkChangeItem $item) => [
                'id' => $item->id,
                'name' => $item->subscription?->displayName() ?? 'مشترك محذوف',
                'accountNumber' => $item->subscription?->account_number,
                'old' => self::display($change->field, $item->old_value, $meterBoxLabels),
                'new' => self::display($change->field, $item->new_value, $meterBoxLabels),
                'now' => $item->subscription ? self::display($change->field, self::currentValue($item->subscription, $change->field), $meterBoxLabels) : '—',
            ]),
        ];
    }

    /**
     * Whether the change would put a subscription who has been active back to waiting.
     *
     * @param  array{subscription: Subscription, old: ?string, new: ?string}  $change
     */
    public static function returnsToWaiting(string $field, array $change): bool
    {
        return $field === 'status'
            && $change['new'] === SubscriptionStatus::Suspended->value
            && ($change['old'] === SubscriptionStatus::Active->value || $change['subscription']->activated_at !== null);
    }

    /**
     * What activating a subscription also sets on them (the dates), with each
     * field's value before and after, so that an undo can put them back.
     *
     * @return array<string, array{old: ?string, new: string}>
     */
    public static function activationEffects(Subscription $subscription): array
    {
        $effects = collect($subscription->datesWhenActivated())
            ->map(fn (string $date, string $field): array => ['old' => $subscription->getRawOriginal($field), 'new' => $date]);

        return $subscription->activated_at === null
            ? $effects->put('activated_at', ['old' => null, 'new' => now()->toDateTimeString()])->all()
            : $effects->all();
    }

    /**
     * The dates an activation set that are still as it left them, with the
     * value they had before; one edited since stays as it is.
     *
     * @return array<string, ?string>
     */
    public static function effectsToPutBack(SubscriptionBulkChangeItem $item): array
    {
        return collect($item->side_effects ?? [])
            ->filter(fn (array $effect, string $field): bool => self::moment($item->subscription->getRawOriginal($field)) === self::moment($effect['new']))
            ->map(fn (array $effect): ?string => $effect['old'])
            ->all();
    }

    /** A stored date or time in one form, whatever form the database kept it in. */
    public static function moment(?string $value): ?string
    {
        return $value === null ? null : Carbon::parse($value)->format('Y-m-d H:i:s');
    }

    /**
     * Whether the change would make a subscription active before their
     * starting reading has been entered.
     *
     * @param  array{subscription: Subscription, old: ?string, new: ?string}  $change
     */
    public static function activatesWithoutReading(string $field, array $change): bool
    {
        return $field === 'status' && $change['new'] === SubscriptionStatus::Active->value && $change['subscription']->initial_reading === null;
    }

    public static function currentValue(Subscription $subscription, string $field): ?string
    {
        return self::normalize($field, $subscription->getRawOriginal($field));
    }

    /** A value as kept: amounts with two decimals, statuses as their key. */
    public static function normalize(string $field, mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $field === 'minimum_charge' ? Money::amount($value) : (string) $value;
    }

    /** A kept value as people read it. */
    public static function display(string $field, ?string $value, array $meterBoxLabels = []): string
    {
        if ($field === 'meter_box_id') {
            return $value === null ? 'بدون طبلون' : ($meterBoxLabels[$value] ?? 'طبلون غير متاح (#'.$value.')');
        }
        if ($value === null) {
            return '—';
        }

        return $field === 'status'
            ? __(SubscriptionStatus::from($value)->label())
            : rtrim(rtrim($value, '0'), '.').' شيكل';
    }

    public static function describe(string $field, bool $byCircuitBreaker, mixed $value): string
    {
        return match (true) {
            $field === 'status' => 'الحالة ← '.self::display('status', (string) $value),
            $byCircuitBreaker => 'الحد الأدنى ← حد القاطع لكل مشترك',
            default => 'الحد الأدنى ← '.self::display('minimum_charge', self::normalize('minimum_charge', $value)),
        };
    }
}
