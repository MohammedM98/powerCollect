<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\MeterReading;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HistoryTablesMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(string $name): Migration
    {
        return require database_path("migrations/{$name}.php");
    }

    public function test_a_readings_adjustment_history_becomes_rows_and_the_json_column_goes(): void
    {
        $editor = User::factory()->create();
        $reading = MeterReading::factory()->create();
        $migration = $this->migration('2026_11_11_170100_create_meter_reading_adjustments_table');
        $migration->down();
        DB::table('meter_readings')->where('id', $reading->id)->update(['adjustment_history' => json_encode([
            ['kind' => 'reading_correction', 'before' => ['currentReading' => 200], 'after' => ['currentReading' => 210], 'reason' => null, 'userId' => $editor->id, 'userName' => 'Sami', 'at' => '2026-10-01T08:00:00+00:00'],
            ['kind' => 'baseline_reset', 'before' => [], 'after' => [], 'reason' => 'عداد جديد', 'userId' => 999999, 'userName' => 'Gone', 'at' => '2026-10-02T08:00:00+00:00'],
        ])]);

        $migration->up();

        $this->assertFalse(Schema::hasColumn('meter_readings', 'adjustment_history'));
        $rows = $reading->adjustments()->get();
        $this->assertSame(['reading_correction', 'baseline_reset'], $rows->pluck('kind')->all());
        $this->assertSame(['currentReading' => 210], $rows[0]->after);
        $this->assertSame([$editor->id, null], $rows->pluck('user_id')->all());
        $this->assertSame('Gone', $rows[1]->user_name);
    }

    public function test_a_subscriptions_archive_history_becomes_rows(): void
    {
        $subscription = Subscription::factory()->create();
        $migration = $this->migration('2026_11_11_170159_create_subscription_archive_events_table');
        $migration->down();
        DB::table('subscriptions')->where('id', $subscription->id)->update(['archive_history' => json_encode([
            ['action' => 'archive', 'at' => '2026-10-01T08:00:00+00:00', 'reason' => 'انتقل', 'service_ended_on' => '2026-09-30'],
            ['action' => 'restore', 'at' => '2026-10-05T08:00:00+00:00', 'reason' => 'عاد'],
        ])]);

        $migration->up();

        $this->assertFalse(Schema::hasColumn('subscriptions', 'archive_history'));
        $this->assertSame(['archive', 'restore'], $subscription->archiveEvents()->pluck('action')->all());
        $this->assertSame('2026-09-30', $subscription->archiveEvents()->first()->service_ended_on->toDateString());
    }

    public function test_an_auditors_settings_become_a_scope_and_branch_rows(): void
    {
        $branch = Branch::factory()->create();
        $auditor = User::factory()->create();
        $migration = $this->migration('2026_11_11_170314_create_user_audit_scopes_table');
        $migration->down();
        DB::table('users')->where('id', $auditor->id)->update(['audit_settings' => json_encode(['scope' => 'selected', 'branch_ids' => [$branch->id], 'actions' => ['approve_boxes']])]);

        $migration->up();

        $this->assertFalse(Schema::hasColumn('users', 'audit_settings'));
        $this->assertSame(['scope' => 'selected', 'branch_ids' => [$branch->id], 'actions' => ['approve_boxes']], $auditor->fresh()->audit_settings);
        $this->assertTrue(User::query()->whereHas('auditBranches', fn ($branches) => $branches->whereKey($branch->id))->whereKey($auditor->id)->exists());
    }
}
