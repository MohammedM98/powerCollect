<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Each time a subscription was archived or restored moves from the
 * subscriptions.archive_history JSON list into rows of their own.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('subscription_archive_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('subscription_id')->constrained()->cascadeOnDelete();
            $table->string('action');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('user_name')->nullable();
            $table->text('reason')->nullable();
            $table->date('service_ended_on')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['subscription_id', 'id']);
        });

        DB::table('subscriptions')->whereNotNull('archive_history')->orderBy('id')->chunkById(500, function ($subscriptions): void {
            foreach ($subscriptions as $subscription) {
                foreach (json_decode($subscription->archive_history, true) ?? [] as $event) {
                    DB::table('subscription_archive_events')->insert([
                        'subscription_id' => $subscription->id,
                        'action' => $event['action'],
                        'user_id' => DB::table('users')->where('id', $event['user_id'] ?? null)->exists() ? $event['user_id'] : null,
                        'user_name' => $event['user_name'] ?? null,
                        'reason' => $event['reason'] ?? null,
                        'service_ended_on' => $event['service_ended_on'] ?? null,
                        'created_at' => isset($event['at']) ? date('Y-m-d H:i:s', strtotime($event['at'])) : null,
                    ]);
                }
            }
        });

        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->dropColumn('archive_history');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->json('archive_history')->nullable();
        });

        DB::table('subscription_archive_events')->orderBy('id')->get()->groupBy('subscription_id')->each(function ($events, $subscriptionId): void {
            DB::table('subscriptions')->where('id', $subscriptionId)->update(['archive_history' => json_encode($events->map(fn ($event): array => array_filter([
                'action' => $event->action, 'at' => $event->created_at === null ? null : date(DATE_ATOM, strtotime($event->created_at)),
                'user_id' => $event->user_id, 'user_name' => $event->user_name, 'reason' => $event->reason, 'service_ended_on' => $event->service_ended_on,
            ], fn ($value): bool => $value !== null))->values()->all())]);
        });

        Schema::dropIfExists('subscription_archive_events');
    }
};
