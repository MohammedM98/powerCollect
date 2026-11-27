<?php

namespace Tests\Feature;

use App\Models\MeterReading;
use App\Models\SubscriptionTransaction;
use App\Support\Ledger\LinePresenter;
use Illuminate\Database\LazyLoadingViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Outside production, app code that loads a relation line by line (N+1)
 * throws; a test reading a relation itself to check a result does not.
 */
class LazyLoadingGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_app_code_loading_a_relation_per_line_throws(): void
    {
        $this->readingLines();
        $lines = SubscriptionTransaction::query()->where('type', SubscriptionTransaction::TYPE_METER_READING)->get();

        $this->expectException(LazyLoadingViolationException::class);

        LinePresenter::description($lines->first());
    }

    public function test_a_test_may_read_a_relation_itself(): void
    {
        $this->readingLines();
        $lines = SubscriptionTransaction::query()->where('type', SubscriptionTransaction::TYPE_METER_READING)->get();

        $this->assertNotNull($lines->first()->meterReading);
    }

    private function readingLines(): void
    {
        foreach (MeterReading::factory()->count(2)->create() as $reading) {
            SubscriptionTransaction::factory()->create(['subscription_id' => $reading->subscription_id, 'type' => SubscriptionTransaction::TYPE_METER_READING, 'meter_reading_id' => $reading->id]);
        }
    }
}
