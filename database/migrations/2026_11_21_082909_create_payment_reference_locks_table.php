<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per bank reference, locked while a payment checks and claims it, so
 * two branches recording the same transfer at the same moment take turns
 * instead of both passing the duplicate check.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_reference_locks', function (Blueprint $table): void {
            $table->string('reference', 100)->primary();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_reference_locks');
    }
};
