<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Drops closings.counted_cash and closings.denominations, left from the
 * earlier counting-based closing that no code reads or writes any more.
 * While any closing still holds a value in them they are kept, so no
 * history is lost and the deploy is not stopped.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::table('closings')->whereNotNull('counted_cash')->orWhereNotNull('denominations')->exists()) {
            return;
        }

        Schema::table('closings', function (Blueprint $table): void {
            $table->dropColumn(['counted_cash', 'denominations']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('closings', 'counted_cash')) {
            return;
        }

        Schema::table('closings', function (Blueprint $table): void {
            $table->decimal('counted_cash', 12, 2)->nullable();
            $table->json('denominations')->nullable();
        });
    }
};
