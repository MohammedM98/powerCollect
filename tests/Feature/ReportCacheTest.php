<?php

namespace Tests\Feature;

use App\Enums\ChargeType;
use App\Models\Branch;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Ledger\RecordCharge;
use App\Support\Ledger\RecordPayment;
use App\Support\Reports\BranchReport;
use App\Support\Reports\DashboardOverview;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReportCacheTest extends TestCase
{
    use RefreshDatabase;

    private Branch $branch;

    private Subscription $subscription;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.business_timezone' => 'Asia/Gaza']);
        $this->travelTo(Carbon::parse('2026-09-01 10:00', 'Asia/Gaza'));
        $this->branch = Branch::factory()->create();
        $this->subscription = Subscription::factory()->create(['branch_id' => $this->branch->id]);
        $this->admin = User::factory()->branchAdmin()->create(['branch_id' => $this->branch->id]);
    }

    private function opening(): string
    {
        return (new BranchReport(collect([$this->branch]), CarbonImmutable::parse('2026-10-01'), CarbonImmutable::parse('2026-10-31')))->flow()['opening'];
    }

    private function openingSums(callable $run): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $run();
        // MySQL quotes names with backticks, SQLite with double quotes.
        $count = collect(DB::getQueryLog())->filter(fn (array $query): bool => str_contains(str_replace('`', '"', $query['query']), 'sum("amount")'))->count();
        DB::disableQueryLog();

        return $count;
    }

    public function test_a_past_periods_opening_balance_is_summed_once_and_new_payments_do_not_drop_it(): void
    {
        RecordCharge::handle($this->subscription, $this->admin, ChargeType::Penalty, '100', null);
        $this->travelTo(Carbon::parse('2026-11-15 10:00', 'Asia/Gaza'));

        $this->assertSame(1, $this->openingSums(fn () => $this->assertSame('100.00', $this->opening())));
        RecordPayment::handle($this->subscription, $this->admin, ['amount' => '30', 'currency' => 'ILS', 'payment_method' => 'cash']);

        $this->assertSame(0, $this->openingSums(fn () => $this->assertSame('100.00', $this->opening())));
    }

    public function test_changing_an_older_line_or_recording_one_with_an_earlier_date_recomputes_the_opening_balance(): void
    {
        $charge = RecordCharge::handle($this->subscription, $this->admin, ChargeType::Penalty, '100', null);
        $this->travelTo(Carbon::parse('2026-11-15 10:00', 'Asia/Gaza'));
        $this->assertSame('100.00', $this->opening());

        $charge->update(['amount' => '120.00']);
        $this->assertSame('120.00', $this->opening());

        SubscriptionTransaction::factory()->for($this->subscription)->create(['type' => 'penalty', 'amount' => '5', 'created_at' => Carbon::parse('2026-09-15 10:00', 'Asia/Gaza')]);
        $this->assertSame('125.00', $this->opening());
    }

    public function test_moving_a_subscription_to_another_branch_recomputes_the_opening_balance(): void
    {
        RecordCharge::handle($this->subscription, $this->admin, ChargeType::Penalty, '100', null);
        $this->travelTo(Carbon::parse('2026-11-15 10:00', 'Asia/Gaza'));
        $this->assertSame('100.00', $this->opening());

        $this->subscription->update(['branch_id' => Branch::factory()->create()->id]);

        $this->assertSame('0.00', $this->opening());
    }

    public function test_the_version_moves_only_once_the_change_is_committed(): void
    {
        $before = cache()->get('report-version:activity');

        DB::transaction(function () use ($before): void {
            RecordCharge::handle($this->subscription, $this->admin, ChargeType::Penalty, '100', null);
            $this->assertSame($before, cache()->get('report-version:activity'));
        });

        $this->assertNotSame($before, cache()->get('report-version:activity'));
    }

    public function test_the_dashboard_follows_a_new_payment_at_once_and_each_viewers_access(): void
    {
        $overview = fn (User $user): ?array => (new DashboardOverview($user, Branch::query()->whereKey($this->branch->id)->get(), 7))->collections();
        $before = $overview($this->admin);

        RecordPayment::handle($this->subscription, $this->admin, ['amount' => '30', 'currency' => 'ILS', 'payment_method' => 'cash']);

        $this->assertNotSame($before, $overview($this->admin));
        $this->assertNull($overview(User::factory()->create(['branch_id' => $this->branch->id])));
    }
}
