<?php

namespace Tests\Feature;

use App\Models\Closing;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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

    public function test_a_table_that_still_holds_rows_is_kept_and_the_empty_ones_go(): void
    {
        $migration = $this->migration();
        $migration->down();
        DB::table('closing_versions')->insert([
            'closing_id' => Closing::factory()->create()->id, 'version' => 1, 'snapshot' => '{}',
            'user_id' => User::factory()->create()->id, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $migration->up();

        $this->assertTrue(Schema::hasTable('closing_versions'));
        $this->assertSame(1, DB::table('closing_versions')->count());
        $this->assertFalse(Schema::hasTable('safe_counts'));
    }

    public function test_the_old_counting_columns_go_unless_a_closing_still_holds_a_value(): void
    {
        $migration = require database_path('migrations/2026_11_11_171152_drop_unused_counting_columns_from_closings.php');
        $this->assertFalse(Schema::hasColumn('closings', 'counted_cash'));

        $migration->down();
        DB::table('closings')->where('id', Closing::factory()->create()->id)->update(['counted_cash' => '120.00']);
        $migration->up();

        $this->assertTrue(Schema::hasColumn('closings', 'counted_cash'));
        $this->assertSame(1, DB::table('closings')->whereNotNull('counted_cash')->count());
    }
}
