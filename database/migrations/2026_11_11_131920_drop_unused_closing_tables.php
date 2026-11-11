<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Drops the tables of the earlier, counting-based closing model that no code
 * reads or writes any more: safe counts, closing versions, closing
 * adjustments and debt repayments. A database that still holds rows in any
 * of them is left untouched and the migration stops, so no history is lost.
 * The closing model in use is BranchClosingWorkflow (boxes, box entries,
 * audit notes and closings).
 */
return new class extends Migration
{
    /** @var list<string> */
    private const TABLES = ['debt_repayments', 'closing_adjustments', 'closing_versions', 'safe_counts'];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach (self::TABLES as $table) {
            if (Schema::hasTable($table) && DB::table($table)->exists()) {
                throw new RuntimeException("The {$table} table still holds rows; move or archive them before dropping the old closing tables.");
            }
        }

        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('debt_repayments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('collector_debt_id')->constrained()->restrictOnDelete();
            $table->foreignId('closing_id')->constrained()->restrictOnDelete();
            $table->foreignId('received_by')->constrained('users')->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->timestamps();
        });
        Schema::create('safe_counts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('closing_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->json('counts');
            $table->json('expected');
            $table->json('differences');
            $table->text('reason')->nullable();
            $table->timestamps();
        });
        Schema::create('closing_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('closing_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->json('snapshot');
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('withdrawn_at')->nullable();
            $table->timestamps();
            $table->unique(['closing_id', 'version']);
        });
        Schema::create('closing_adjustments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('closing_id')->constrained()->restrictOnDelete();
            $table->foreignId('original_closing_id')->constrained('closings')->restrictOnDelete();
            $table->foreignId('audit_note_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('book');
            $table->string('currency', 3);
            $table->decimal('amount', 12, 2);
            $table->text('reason');
            $table->timestamps();
        });
    }
};
