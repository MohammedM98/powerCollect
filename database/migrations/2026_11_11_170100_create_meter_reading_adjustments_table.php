<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A reading's adjustments (corrections, baseline resets, price changes)
 * move from the meter_readings.adjustment_history JSON list into rows of
 * their own, so they can be queried, joined and counted.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('meter_reading_adjustments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('meter_reading_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('user_name')->nullable();
            $table->string('kind');
            $table->json('before');
            $table->json('after');
            $table->text('reason')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['meter_reading_id', 'id']);
        });

        DB::table('meter_readings')->whereNotNull('adjustment_history')->orderBy('id')->chunkById(500, function ($readings): void {
            foreach ($readings as $reading) {
                foreach (json_decode($reading->adjustment_history, true) ?? [] as $entry) {
                    DB::table('meter_reading_adjustments')->insert([
                        'meter_reading_id' => $reading->id,
                        'user_id' => DB::table('users')->where('id', $entry['userId'] ?? null)->exists() ? $entry['userId'] : null,
                        'user_name' => $entry['userName'] ?? null,
                        'kind' => $entry['kind'],
                        'before' => json_encode($entry['before'] ?? []),
                        'after' => json_encode($entry['after'] ?? []),
                        'reason' => $entry['reason'] ?? null,
                        'created_at' => isset($entry['at']) ? date('Y-m-d H:i:s', strtotime($entry['at'])) : null,
                    ]);
                }
            }
        });

        Schema::table('meter_readings', function (Blueprint $table): void {
            $table->dropColumn('adjustment_history');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('meter_readings', function (Blueprint $table): void {
            $table->json('adjustment_history')->nullable();
        });

        DB::table('meter_reading_adjustments')->orderBy('id')->get()->groupBy('meter_reading_id')->each(function ($adjustments, $readingId): void {
            DB::table('meter_readings')->where('id', $readingId)->update(['adjustment_history' => json_encode($adjustments->map(fn ($adjustment): array => [
                'kind' => $adjustment->kind, 'before' => json_decode($adjustment->before, true), 'after' => json_decode($adjustment->after, true),
                'reason' => $adjustment->reason, 'userId' => $adjustment->user_id, 'userName' => $adjustment->user_name,
                'at' => $adjustment->created_at === null ? null : date(DATE_ATOM, strtotime($adjustment->created_at)),
            ])->values()->all())]);
        });

        Schema::dropIfExists('meter_reading_adjustments');
    }
};
