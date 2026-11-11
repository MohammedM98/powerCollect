<?php

namespace Tests\Feature;

use App\Models\Closing;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class DropUnusedClosingTablesMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): Migration
    {
        return require database_path('migrations/2026_11_11_131920_drop_unused_closing_tables.php');
    }

    public function test_the_old_closing_tables_are_gone(): void
    {
        foreach (['safe_counts', 'closing_versions', 'closing_adjustments', 'debt_repayments'] as $table) {
            $this->assertFalse(Schema::hasTable($table), $table);
        }
    }

    public function test_tables_that_still_hold_rows_are_kept_and_the_migration_stops(): void
    {
        $migration = $this->migration();
        $migration->down();
        DB::table('closing_versions')->insert([
            'closing_id' => Closing::factory()->create()->id, 'version' => 1, 'snapshot' => '{}',
            'user_id' => User::factory()->create()->id, 'created_at' => now(), 'updated_at' => now(),
        ]);

        try {
            $migration->up();
            $this->fail('The migration dropped a table that still held rows.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('closing_versions', $exception->getMessage());
        }

        $this->assertTrue(Schema::hasTable('closing_versions'));
        $this->assertTrue(Schema::hasTable('safe_counts'));
    }
}
