<?php

namespace App\Support\Closing;

use App\Enums\CashBoxType;
use App\Models\CashBox;
use App\Models\Closing;
use App\Models\SubscriptionTransaction;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Puts a payment or clearing into its collector's open box for the period
 * it happened in (the current one when that period has ended or was sent),
 * opening the box when there is none.
 */
class CashBoxEntries
{
    public function attach(SubscriptionTransaction $payment, ?CarbonImmutable $originalTime = null): void
    {
        $type = CashBoxType::for($payment);
        $occurred = ($originalTime ?? $payment->created_at->toImmutable())->utc();
        $closing = Closing::query()->where('branch_id', $payment->branch_id)->whereNotNull('workflow_settings')->where('coverage_from', '<=', $occurred)->where('coverage_until', '>', $occurred)->whereIn('book', [$type->book(), 'combined'])->orderBy('id')->first();
        $late = $closing !== null && ($closing->submitted_snapshot !== null || $closing->coverage_until->lessThanOrEqualTo(now()));
        if (! $closing || $late) {
            $closing = Closing::currentFor($payment->branch_id);
        } elseif ($closing->book === 'bank') {
            $closing = Closing::query()->where('branch_id', $payment->branch_id)->where('coverage_from', $closing->coverage_from)->where('book', 'cash')->firstOrFail();
        }
        // Late syncs join the current period without reopening a completed week.
        $box = $this->openBox($closing, $payment->recorded_by, $type);
        $box->payments()->create(['subscription_transaction_id' => $payment->id, ...$this->amount($payment), 'method' => $this->method($payment), 'status' => $type === CashBoxType::Cash ? 'cash' : 'pending', 'occurred_at' => $occurred, 'synced_at' => now(), 'is_late' => $late]);
    }

    private function openBox(Closing $closing, int $userId, CashBoxType $type): CashBox
    {
        $key = $closing->branch_id.':'.$userId.':'.$type->value;

        return CashBox::query()->where('open_key', $key)->first()
            ?? $this->newBox(['open_key' => $key, 'branch_id' => $closing->branch_id, 'user_id' => $userId, 'type' => $type, 'closing_id' => $closing->id, 'opened_at' => now(), 'status' => 'open']);
    }

    /**
     * Create a box numbered by its id: short, so people can read, print and
     * quote it, and never reused.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function newBox(array $attributes): CashBox
    {
        $box = CashBox::query()->create(['number' => 'BOX-'.Str::ulid(), ...$attributes]);
        $box->update(['number' => (string) $box->id]);

        return $box;
    }

    public function method(SubscriptionTransaction $transaction): string
    {
        return $transaction->isClearing() ? 'clearing' : $transaction->payment_method->value;
    }

    /**
     * What an entry holds: always shekels, the company's only currency. A
     * payment in dollars or dinars counts at its value in shekels, at the
     * rate it was recorded at; the transaction keeps what was paid.
     *
     * @return array{currency: string, amount: string}
     */
    public function amount(SubscriptionTransaction $payment): array
    {
        return ['currency' => 'ILS', 'amount' => Closing::money(abs(Closing::cents($payment->amount)))];
    }
}
