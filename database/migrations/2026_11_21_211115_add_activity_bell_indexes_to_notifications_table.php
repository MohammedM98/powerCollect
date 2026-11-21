<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The top bar's bell asks on every page for the user's unread count and
 * latest ten saved actions; every action adds a row and none are removed,
 * so both are served from an index rather than sorting the user's history.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table): void {
            $table->index(['notifiable_type', 'notifiable_id', 'created_at'], 'notifications_notifiable_latest_index');
            $table->index(['notifiable_type', 'notifiable_id', 'read_at'], 'notifications_notifiable_unread_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table): void {
            $table->dropIndex('notifications_notifiable_latest_index');
            $table->dropIndex('notifications_notifiable_unread_index');
        });
    }
};
