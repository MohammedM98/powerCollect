<?php

namespace App\Support\Closing;

use App\Models\Branch;
use Illuminate\Support\Facades\DB;

/**
 * Runs a money or closing operation in a transaction holding its branch's
 * row lock, so two operations on one branch's ledger and boxes never
 * interleave. Retried up to three times on a deadlock.
 */
class BranchLock
{
    public static function run(int $branchId, callable $operation): mixed
    {
        return DB::transaction(function () use ($branchId, $operation): mixed {
            Branch::query()->whereKey($branchId)->lockForUpdate()->firstOrFail();

            return $operation();
        }, 3);
    }
}
