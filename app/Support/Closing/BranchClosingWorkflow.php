<?php

namespace App\Support\Closing;

use App\Enums\ClosingStatus;
use App\Models\CashBox;
use App\Models\CashBoxPayment;
use App\Models\Closing;
use App\Models\ClosingSetting;
use App\Models\ClosingSettingChange;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * The closing model in use: each collector's cash boxes (one open box per
 * person, type and period) collect the box entries of their payments, are
 * closed at the branch's cut-off, received by the branch head and audited;
 * closings group the closed boxes of a period for the financial audit, with
 * audit notes on what does not match. The earlier counting-based closing
 * (safe counts, closing versions and adjustments, debt repayments, counted
 * cash and denominations on closings) is gone; collector debts, closing
 * payments and box syncs remain only for the history they hold and the
 * field app's sync. Branch sessions and packages are separate from
 * historical company closings.
 *
 * This class runs the periods: starting a branch's closing, rolling its
 * weeks on and closing the boxes of ended weeks. ClosingLedgerSync keeps
 * boxes in step with the ledger, CashBoxReceiving is the branch's handling
 * of boxes, and BranchLock serialises a branch's operations.
 */
class BranchClosingWorkflow
{
    use RefusesClosingActions;

    public function __construct(private CashBoxEntries $entries) {}

    /** Automatic startup includes the collection that triggered it, even when processing crosses a second. */
    public function start(int $branchId, User $actor, ?CarbonImmutable $startedAt = null): void
    {
        BranchLock::run($branchId, function () use ($branchId, $actor, $startedAt): void {
            $startedAt ??= CarbonImmutable::now()->utc();
            $setting = ClosingSetting::ownFor($branchId);
            $this->require(! $setting?->workflow_started_at, __('The branch closing has already started.'));
            $defaults = ClosingSetting::forBranch($branchId);
            $setting ??= new ClosingSetting(['branch_id' => $branchId]);
            $setting->fill(['week_starts_on' => $defaults->week_starts_on, 'cutoff_time' => $defaults->cutoff_time, 'auto_open' => true, 'frequency' => 'weekly', 'arrangement' => 'combined', 'workflow_started_at' => $startedAt, 'updated_by' => $actor->id]);
            $setting->save();
            $settings = $this->settings($setting);
            $end = $this->nextEnd($startedAt, $settings);
            $start = $end->setTimezone(config('app.business_timezone'))->subWeek()->utc();
            $this->createPeriod($branchId, $start, $end, $settings);
            $this->refresh($branchId, attachMissed: true);
        });
    }

    /** @return array{frequency: string, arrangement: string, week_starts_on: int, cutoff_time: string} */
    public function settings(ClosingSetting $setting): array
    {
        return ['frequency' => 'weekly', 'arrangement' => 'combined', 'week_starts_on' => $setting->week_starts_on, 'cutoff_time' => ClosingSetting::DEFAULT_CUTOFF];
    }

    /** @param array<string, mixed> $settings @return array<string, mixed> */
    private function weekly(array $settings): array
    {
        unset($settings['continuation']);

        return [...$settings, 'frequency' => 'weekly', 'arrangement' => 'combined', 'cutoff_time' => ClosingSetting::DEFAULT_CUTOFF];
    }

    /** @param array<string, mixed> $settings */
    public function nextEnd(CarbonImmutable $from, array $settings): CarbonImmutable
    {
        $local = $from->setTimezone(config('app.business_timezone'));
        $end = $local->setTimeFromTimeString($settings['cutoff_time']);
        $end = $end->addDays(((int) $settings['week_starts_on'] - $end->dayOfWeek + 7) % 7);
        if ($end->lessThanOrEqualTo($local)) {
            $end = $end->addWeek();
        }

        return $end->utc();
    }

    /** @param array<string, mixed> $settings */
    private function createPeriod(int $branchId, CarbonImmutable $from, CarbonImmutable $until, array $settings): Closing
    {
        $settings = $this->weekly($settings);

        return Closing::query()->firstOrCreate(['branch_id' => $branchId, 'coverage_from' => $from, 'book' => 'combined'], [
            'number' => 'BR-'.Str::ulid(), 'type' => 'weekly', 'period_start' => $from->setTimezone(config('app.business_timezone'))->toDateString(), 'period_end' => $until->subSecond()->setTimezone(config('app.business_timezone'))->toDateString(),
            'coverage_until' => $until, 'scheduled_until' => $until, 'status' => ClosingStatus::Draft, 'workflow_settings' => $settings,
        ]);
    }

    /**
     * Roll the branch's periods on to now and close expired boxes. With
     * `attachMissed`, also give a box to every payment since the workflow
     * started that has none: a scan of the branch's whole history, so only
     * the scheduled closings:process and the start do it, never each
     * payment or page.
     */
    public function refresh(int $branchId, bool $attachMissed = false): void
    {
        BranchLock::run($branchId, function () use ($branchId, $attachMissed): void {
            $setting = ClosingSetting::ownFor($branchId);
            if (! $setting?->workflow_started_at) {
                return;
            }
            $latest = Closing::query()->where('branch_id', $branchId)->whereNotNull('workflow_settings')->orderByDesc('coverage_until')->orderBy('id')->firstOrFail();
            if ((int) $latest->workflow_settings['week_starts_on'] !== $setting->week_starts_on || $latest->workflow_settings['cutoff_time'] !== ClosingSetting::DEFAULT_CUTOFF) {
                $settings = $this->settings($setting);
                $until = $this->nextEnd($latest->coverage_from, $settings);
                $latest->update([
                    'workflow_settings' => $settings, 'coverage_until' => $until, 'scheduled_until' => $until,
                    'period_end' => $until->subSecond()->setTimezone(config('app.business_timezone'))->toDateString(),
                ]);
            }
            while ($latest->coverage_until->lessThanOrEqualTo(now())) {
                $change = ClosingSettingChange::query()->where('branch_id', $branchId)->whereNull('applied_at')->where('effective_from', '<=', $latest->coverage_until)->latest('id')->first();
                $settings = $this->settings($setting);
                if ($change) {
                    $settings = $this->weekly($change->settings);
                    $setting->update([...$settings, 'updated_by' => $change->user_id]);
                    ClosingSettingChange::query()->where('branch_id', $branchId)->whereNull('applied_at')->where('effective_from', '<=', $latest->coverage_until)->update(['applied_at' => now()]);
                }
                $until = $latest->scheduled_until->greaterThan($latest->coverage_until) ? $latest->scheduled_until : $this->nextEnd($latest->coverage_until, $settings);
                $latest = $this->createPeriod($branchId, $latest->coverage_until, $until, $settings);
            }
            $this->closeExpiredBoxes($branchId);
            if (! $attachMissed) {
                return;
            }
            SubscriptionTransaction::query()->where('branch_id', $branchId)->whereIn('type', [SubscriptionTransaction::TYPE_PAYMENT, SubscriptionTransaction::TYPE_CLEARING])
                ->where('status', SubscriptionTransaction::STATUS_ACTIVE)->where('created_at', '>=', $setting->workflow_started_at)
                ->whereNotIn('id', CashBoxPayment::query()->select('subscription_transaction_id'))->orderBy('id')
                ->chunkById(200, function ($payments): void {
                    foreach ($payments as $payment) {
                        $this->entries->attach($payment);
                    }
                });
        });
    }

    /**
     * Seal expired periods without attributing receipt or audit approval to
     * a person. Empty boxes are discarded as before; entries stay in place.
     */
    private function closeExpiredBoxes(int $branchId): void
    {
        CashBox::query()->where('branch_id', $branchId)->whereIn('status', ['open', 'pending'])
            ->whereHas('closing', fn ($query) => $query->whereNotNull('workflow_settings')->where('coverage_until', '<=', now()))
            ->with('closing')->withExists('payments')->withMax('payments', 'occurred_at')->chunkById(100, function ($boxes): void {
                foreach ($boxes as $box) {
                    if (! $box->payments_exists) {
                        $box->delete();

                        continue;
                    }
                    $lastEntryAt = CarbonImmutable::parse($box->payments_max_occurred_at, 'UTC');
                    if ($lastEntryAt->greaterThanOrEqualTo($box->closing->coverage_until)) {
                        $period = Closing::query()->where('branch_id', $box->branch_id)->whereNotNull('workflow_settings')
                            ->where('coverage_from', '<=', $lastEntryAt)->where('coverage_until', '>', $lastEntryAt)->orderBy('id')->firstOrFail();
                        $box->update(['closing_id' => $period->id]);
                        $box->setRelation('closing', $period);
                        if ($period->coverage_until->greaterThan(now())) {
                            continue;
                        }
                    }
                    $box->update([
                        'status' => 'received', 'closed_at' => $box->closing->coverage_until,
                        'close_reason' => CashBox::CLOSE_REASON_PERIOD_END, 'open_key' => null,
                        'expected_counts' => CashBoxCounts::expected($box),
                        'reason' => trim(($box->reason ? $box->reason."\n" : '').__('Closed automatically when the weekly period ended.')),
                    ]);
                }
            });
    }
}
