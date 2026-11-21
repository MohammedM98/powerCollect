<?php

namespace Tests\Feature;

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
}
