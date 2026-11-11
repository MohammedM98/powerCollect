<?php

namespace App\Support\Ledger;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

/** Exact decimal arithmetic, rounded half away from zero at monetary boundaries. */
final class Money
{
    public static function decimal(int|float|string|null $value): BigDecimal
    {
        return BigDecimal::of((string) ($value ?? '0'));
    }

    public static function amount(int|float|string|BigDecimal|null $value): string
    {
        return (string) ($value instanceof BigDecimal ? $value : self::decimal($value))->toScale(2, RoundingMode::HalfUp);
    }

    public static function add(int|float|string $left, int|float|string $right): string
    {
        return self::amount(self::decimal($left)->plus((string) $right));
    }

    public static function subtract(int|float|string $left, int|float|string $right): string
    {
        return self::amount(self::decimal($left)->minus((string) $right));
    }

    public static function multiply(int|float|string $left, int|float|string $right): string
    {
        return self::amount(self::decimal($left)->multipliedBy((string) $right));
    }

    public static function negate(int|float|string $value): string
    {
        return self::amount(self::decimal($value)->negated());
    }

    /** @param iterable<int|float|string> $amounts */
    public static function sum(iterable $amounts): string
    {
        $total = BigDecimal::zero();
        foreach ($amounts as $amount) {
            $total = $total->plus((string) $amount);
        }

        return self::amount($total);
    }
}
