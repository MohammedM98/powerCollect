<?php

namespace Tests\Feature;

use App\Models\ClosingSetting;
use App\Support\Closing\ClosingPeriods;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

/**
 * A business day closes at midnight on the wall clock in the business
 * time zone, including the two days a year the clocks change.
 */
class ClosingPeriodsTest extends TestCase
{
    use RefreshDatabase;

    #[TestWith(['2026-03-28', '2026-03-29 00:00:00'], 'the night clocks go forward')]
    #[TestWith(['2026-10-24', '2026-10-25 00:00:00'], 'the night clocks go back')]
    #[TestWith(['2026-07-15', '2026-07-16 00:00:00'], 'an ordinary day')]
    public function test_a_business_day_ends_at_the_next_midnight_on_the_wall_clock(string $day, string $expectedEnd): void
    {
        config(['app.business_timezone' => 'Asia/Gaza']);

        $end = ClosingPeriods::for()->dayEnd($day);

        $this->assertSame($expectedEnd, $end->setTimezone('Asia/Gaza')->format('Y-m-d H:i:s'));
    }

    #[TestWith(['2026-03-28', '2026-03-28 03:00:00'], 'the cut-off falls in the hour the clocks skip')]
    #[TestWith(['2026-03-27', '2026-03-27 02:30:00'], 'the day before')]
    public function test_a_cut_off_the_clocks_skip_closes_the_day_when_they_jump(string $day, string $expectedEnd): void
    {
        config(['app.business_timezone' => 'Asia/Gaza']);
        ClosingSetting::company()->update(['cutoff_time' => '02:30']);

        $end = ClosingPeriods::for()->dayEnd($day);

        $this->assertSame($expectedEnd, $end->setTimezone('Asia/Gaza')->format('Y-m-d H:i:s'));
    }

    public function test_a_payment_after_the_jump_past_a_skipped_cut_off_counts_for_the_next_day(): void
    {
        config(['app.business_timezone' => 'Asia/Gaza']);
        ClosingSetting::company()->update(['cutoff_time' => '02:30']);

        $day = ClosingPeriods::for()->dayOf('2026-03-28 00:10:00');

        $this->assertSame('2026-03-29', $day);
    }
}
