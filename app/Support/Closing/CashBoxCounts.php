<?php

namespace App\Support\Closing;

use App\Models\CashBox;
use App\Models\Closing;
use App\Models\SubscriptionTransaction;

/**
 * What a cash box should hold in each currency, from its active cash
 * entries, and how a count differs from it.
 */
class CashBoxCounts
{
    public const CURRENCIES = ['ILS', 'USD', 'JOD'];

    /** @return array<string, string> */
    public static function expected(CashBox $box): array
    {
        $payments = $box->payments()->where('method', 'cash')->whereHas('transaction', fn ($query) => $query->where('status', SubscriptionTransaction::STATUS_ACTIVE))->get();

        return collect(self::CURRENCIES)->mapWithKeys(fn (string $currency): array => [$currency => Closing::money($payments->where('currency', $currency)->sum(fn ($payment): int => Closing::cents($payment->amount)))])->all();
    }

    /** @param array<string, mixed> $counts @param array<string, mixed> $expected @return array<string, string> */
    public static function differences(array $counts, array $expected): array
    {
        return collect(self::CURRENCIES)->mapWithKeys(fn (string $currency): array => [$currency => Closing::money(Closing::cents($counts[$currency] ?? 0) - Closing::cents($expected[$currency] ?? 0))])->all();
    }
}
