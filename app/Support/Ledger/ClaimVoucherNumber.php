<?php

namespace App\Support\Ledger;

use Illuminate\Support\Facades\DB;

/**
 * Hands out the next number of the one voucher sequence that cash payments and clearings share.
 */
class ClaimVoucherNumber
{
    /**
     * Reserve the next global voucher number. The counter survives permanent
     * payment deletion, leaving the deliberate gap in the voucher sequence.
     */
    public static function next(): int
    {
        $counter = DB::table('payment_voucher_sequences')->where('id', 1);
        $voucherNumber = (int) $counter->lockForUpdate()->value('last_number') + 1;

        $counter->update(['last_number' => $voucherNumber]);

        return $voucherNumber;
    }
}
