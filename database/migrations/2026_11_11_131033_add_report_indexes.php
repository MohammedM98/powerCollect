<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indexes for the filters the reports, the ledger and the dashboard run:
 * ledger lines by the day they were recorded (with their type and status),
 * a box's entries by when they happened, and messages by their status.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('subscription_transactions', function (Blueprint $table): void {
            $table->index(['created_at', 'id'], 'subscription_transactions_recorded_index');
            $table->index(['type', 'status', 'created_at'], 'subscription_transactions_kind_index');
        });

        Schema::table('cash_box_payments', function (Blueprint $table): void {
            $table->index(['cash_box_id', 'occurred_at'], 'cash_box_payments_box_occurred_index');
        });

        Schema::table('subscription_messages', function (Blueprint $table): void {
            $table->index(['status', 'created_at'], 'subscription_messages_status_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscription_messages', function (Blueprint $table): void {
            $table->dropIndex('subscription_messages_status_index');
        });

        // MySQL serves the cash_box_id foreign key from this index, so the key gets its own first.
        if (! Schema::hasIndex('cash_box_payments', ['cash_box_id'])) {
            Schema::table('cash_box_payments', function (Blueprint $table): void {
                $table->index('cash_box_id');
            });
        }

        Schema::table('cash_box_payments', function (Blueprint $table): void {
            $table->dropIndex('cash_box_payments_box_occurred_index');
        });

        Schema::table('subscription_transactions', function (Blueprint $table): void {
            $table->dropIndex('subscription_transactions_kind_index');
            $table->dropIndex('subscription_transactions_recorded_index');
        });
    }
};
