<?php

namespace Tests\Feature\MeterReadings;

use App\Models\Branch;
use App\Models\MeterReading;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class MovedSubscriptionReadingTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_subscription_moved_to_another_branch_is_read_on_from_its_last_reading_there(): void
    {
        $oldBranch = Branch::factory()->create();
        $newBranch = Branch::factory()->create();
        $subscription = Subscription::factory()->for($oldBranch)->create(['initial_reading' => 1000]);
        MeterReading::factory()->approved()->for($subscription)->create(['week_start' => '2026-10-03', 'previous_reading' => 1000, 'current_reading' => 1500]);
        $subscription->update(['branch_id' => $newBranch->id]);
        request()->attributes->add(['domain_branch' => $newBranch, 'branch_domain_authorized' => true]);

        $previous = $subscription->fresh()->previousReadingBefore(Carbon::parse('2026-10-10'));

        $this->assertSame(1500.0, $previous);
    }
}
