<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * An auditor's scope moves from the users.audit_settings JSON into rows:
 * one user_audit_scopes row (all branches or selected ones, and the audit
 * actions allowed) and one user_audit_branches row per selected branch, so
 * an auditor's branches can be joined like any other relation.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('user_audit_scopes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('scope');
            $table->json('actions');
            $table->timestamps();
        });

        Schema::create('user_audit_branches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->unique(['user_id', 'branch_id']);
        });

        DB::table('users')->whereNotNull('audit_settings')->orderBy('id')->chunkById(200, function ($users): void {
            foreach ($users as $user) {
                $settings = json_decode($user->audit_settings, true);
                if (! is_array($settings)) {
                    continue;
                }
                DB::table('user_audit_scopes')->insert([
                    'user_id' => $user->id, 'scope' => $settings['scope'] ?? 'all',
                    'actions' => json_encode(array_values($settings['actions'] ?? [])), 'created_at' => now(), 'updated_at' => now(),
                ]);
                foreach (array_unique($settings['branch_ids'] ?? []) as $branchId) {
                    if (DB::table('branches')->where('id', $branchId)->exists()) {
                        DB::table('user_audit_branches')->insert(['user_id' => $user->id, 'branch_id' => $branchId]);
                    }
                }
            }
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('audit_settings');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->json('audit_settings')->nullable();
        });

        foreach (DB::table('user_audit_scopes')->get() as $scope) {
            DB::table('users')->where('id', $scope->user_id)->update(['audit_settings' => json_encode([
                'scope' => $scope->scope,
                'branch_ids' => DB::table('user_audit_branches')->where('user_id', $scope->user_id)->orderBy('id')->pluck('branch_id')->all(),
                'actions' => json_decode($scope->actions, true),
            ])]);
        }

        Schema::dropIfExists('user_audit_branches');
        Schema::dropIfExists('user_audit_scopes');
    }
};
