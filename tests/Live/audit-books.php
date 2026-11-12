<?php

use App\Models\Subscription;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

/**
 * An audit of the books straight from the tables, written apart from the
 * application's own classes so it does not repeat their mistakes: every
 * amount is counted in whole agorot. Prints the violations as JSON.
 */
$cents = function (mixed $amount): int {
    $amount = (string) ($amount ?? '0');
    $negative = str_starts_with($amount, '-');
    [$whole, $fraction] = array_pad(explode('.', ltrim($amount, '-'), 2), 2, '');
    $value = ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');

    return $negative ? -$value : $value;
};
$times = fn (mixed $left, mixed $right): int => $cents((string) BigDecimal::of((string) $left)->multipliedBy((string) $right)->toScale(2, RoundingMode::HalfUp));
$violations = [];
$flag = function (string $rule, string $detail) use (&$violations): void {
    $violations[] = ['rule' => $rule, 'detail' => $detail];
};
$counts = [];

$lines = DB::table('subscription_transactions')->orderBy('created_at')->orderBy('id')->get();
$counts['lines'] = $lines->count();
$bySubscription = $lines->groupBy('subscription_id');
$sealed = DB::table('cash_box_payments')->join('cash_boxes', 'cash_boxes.id', '=', 'cash_box_payments.cash_box_id')
    ->whereNotIn('cash_boxes.status', ['open', 'pending'])->pluck('subscription_transaction_id')->flip();

foreach (DB::table('subscriptions')->get() as $subscription) {
    $own = $bySubscription->get($subscription->id, collect());
    $running = 0;
    $byId = $own->keyBy('id');
    foreach ($own as $line) {
        if ($line->branch_id !== $subscription->branch_id) {
            $flag('line-branch', "line {$line->id} is in branch {$line->branch_id} but its subscription {$subscription->id} is in {$subscription->branch_id}");
        }
        $running += $cents($line->amount);
        if ($line->type !== 'bank_audit_adjustment' && ! $sealed->has($line->id) && $cents($line->balance_after) !== $running) {
            $flag('running-balance', "line {$line->id} ({$line->type}) of subscription {$subscription->id} stores balance_after {$line->balance_after} but the lines before it add up to ".($running / 100));
        }
        if (in_array($line->type, ['reversal', 'cancellation', 'refund'], true)) {
            if (! $byId->has($line->reverses_id ?? $line->reference_transaction_id)) {
                $flag('orphan-reversal', "reversal {$line->id} takes back a line that is not on the same statement");
            }

            continue;
        }
        $net = $cents($line->amount) + $own->where('reverses_id', $line->id)->sum(fn ($reversal) => $cents($reversal->amount));
        if ($line->status === 'active' && $line->cancelled_at !== null) {
            $flag('status', "line {$line->id} is active but has a cancellation date");
        }
        if ($line->status === 'active' && $own->where('reverses_id', $line->id)->isNotEmpty() && $net === 0) {
            $flag('status', "line {$line->id} is active but fully reversed");
        }
        if ($line->status !== 'active' && $net !== 0) {
            $flag('reversal-sum', "line {$line->id} is {$line->status} but its reversals leave ".($net / 100));
        }
        $credit = in_array($line->type, ['payment', 'credit', 'discount', 'reading_discount', 'clearing'], true);
        if ($line->type !== 'bank_audit_adjustment' && ($credit ? $cents($line->amount) > 0 : $cents($line->amount) < 0)) {
            $flag('sign', "line {$line->id} ({$line->type}) has amount {$line->amount} on the wrong side");
        }
        if ($line->type === 'payment' && $cents($line->amount) !== -$times($line->currency_amount, $line->exchange_rate)) {
            $flag('conversion', "payment {$line->id}: {$line->currency_amount} {$line->currency} at {$line->exchange_rate} is not {$line->amount}");
        }
    }
    $model = Subscription::query()->acrossBranches()->find($subscription->id);
    if ($cents($model->balance()) !== $running) {
        $flag('balance', "subscription {$subscription->id}: balance() says {$model->balance()} but its lines add up to ".($running / 100));
    }
}

$vouchers = $lines->whereNotNull('voucher_number')->groupBy('voucher_number')->filter(fn ($group) => $group->count() > 1);
foreach ($vouchers as $number => $group) {
    $flag('voucher-duplicate', "voucher {$number} is on lines ".$group->pluck('id')->implode(', '));
}
$counts['vouchers'] = $lines->whereNotNull('voucher_number')->count();
$lastVoucher = (int) DB::table('payment_voucher_sequences')->where('id', 1)->value('last_number');
if ($lastVoucher < (int) $lines->max('voucher_number')) {
    $flag('voucher-sequence', "the voucher counter is at {$lastVoucher}, below the highest voucher ".$lines->max('voucher_number'));
}
$references = $lines->whereNotNull('active_reference')->groupBy(fn ($line) => $line->active_reference)->filter(fn ($group) => $group->unique(fn ($line) => $line->split_payment_id ?? 'single:'.$line->id)->count() > 1);
$counts['sharedReferences'] = $references->map(fn ($group) => $group->pluck('id')->all())->all();
foreach (['mobile_operation_id', 'late_payment_token', 'source_key'] as $column) {
    foreach ($lines->whereNotNull($column)->groupBy($column)->filter(fn ($group) => $group->count() > 1) as $value => $group) {
        $flag('duplicate-'.$column, "{$column} {$value} is on lines ".$group->pluck('id')->implode(', '));
    }
}

$readings = DB::table('meter_readings')->orderBy('subscription_id')->orderBy('week_start')->get();
$counts['readings'] = $readings->count();
$subscriptions = DB::table('subscriptions')->get()->keyBy('id');
foreach ($readings->groupBy('subscription_id') as $subscriptionId => $weeks) {
    $previous = null;
    foreach ($weeks as $reading) {
        $own = $lines->where('meter_reading_id', $reading->id);
        $charges = $own->where('type', 'meter_reading')->whereNull('cancelled_at');
        $discounts = $own->where('type', 'reading_discount')->whereNull('cancelled_at');
        if ($charges->count() > 1) {
            $flag('reading-billed-twice', "reading {$reading->id} has standing charge lines ".$charges->pluck('id')->implode(', '));
        }
        if ($discounts->count() > 1) {
            $flag('reading-discount-twice', "reading {$reading->id} has standing discount lines ".$discounts->pluck('id')->implode(', '));
        }
        if ($discounts->isNotEmpty() && $charges->isEmpty()) {
            $flag('reading-discount-alone', "reading {$reading->id} has a standing discount without its charge");
        }
        if ($reading->status === 'pending' && $charges->isNotEmpty()) {
            $flag('pending-reading-billed', "pending reading {$reading->id} is billed by line ".$charges->pluck('id')->implode(', '));
        }
        if ($reading->status !== 'pending' && ($charge = $charges->first())) {
            if ($cents($charge->amount) !== $cents($reading->amount_due) + $cents($reading->discount_amount)) {
                $flag('reading-amount', "reading {$reading->id} costs {$reading->amount_due} + {$reading->discount_amount} but line {$charge->id} bills {$charge->amount}");
            }
            if ($cents($reading->discount_amount) > 0 && -$cents($discounts->first()?->amount) !== $cents($reading->discount_amount)) {
                $flag('reading-discount-amount', "reading {$reading->id} was given {$reading->discount_amount} off but its line takes off ".($discounts->first()?->amount ?? 'nothing'));
            }
        }
        if (! $reading->requires_reentry) {
            if ($cents($reading->consumption) !== $cents($reading->current_reading) - $cents($reading->previous_reading)) {
                $flag('consumption', "reading {$reading->id}: {$reading->current_reading} - {$reading->previous_reading} is not {$reading->consumption}");
            }
            $fee = $times($reading->consumption, $reading->unit_price);
            if ($cents($reading->reading_fee) !== $fee) {
                $flag('reading-fee', "reading {$reading->id}: {$reading->consumption} kWh at {$reading->unit_price} is not {$reading->reading_fee}");
            }
            $expected = $reading->discount_method === null ? max($fee, $cents($reading->minimum_payment)) : $fee - $cents($reading->discount_amount);
            if ($cents($reading->amount_due) !== $expected) {
                $flag('amount-due', "reading {$reading->id} is due {$reading->amount_due}, expected ".($expected / 100));
            }
        }
        if ($previous !== null && ! $previous->requires_reentry && $cents($reading->previous_reading) !== $cents($previous->next_previous_reading ?? $previous->current_reading)) {
            $flag('reading-chain', "reading {$reading->id} starts from {$reading->previous_reading} but the week before it ended on ".($previous->next_previous_reading ?? $previous->current_reading));
        }
        if ($reading->branch_id !== $subscriptions[$subscriptionId]->branch_id) {
            $flag('reading-branch', "reading {$reading->id} is in another branch than its subscription");
        }
        $previous = $reading;
    }
}

$entries = DB::table('cash_box_payments')->join('cash_boxes', 'cash_boxes.id', '=', 'cash_box_payments.cash_box_id')
    ->get(['cash_box_payments.*', 'cash_boxes.status as box_status', 'cash_boxes.branch_id as box_branch', 'cash_boxes.type as box_type']);
$counts['boxEntries'] = $entries->count();
$linesById = $lines->keyBy('id');
foreach ($entries->groupBy('subscription_transaction_id') as $lineId => $group) {
    if ($lineId !== '' && $group->count() > 1) {
        $flag('line-in-two-boxes', "line {$lineId} is in boxes ".$group->pluck('cash_box_id')->implode(', '));
    }
}
foreach ($lines->whereIn('type', ['payment', 'clearing'])->where('status', 'active') as $line) {
    $entry = $entries->firstWhere('subscription_transaction_id', $line->id);
    if ($entry === null) {
        $flag('payment-in-no-box', "standing {$line->type} {$line->id} is in no box");

        continue;
    }
    if ($entry->box_branch !== $line->branch_id) {
        $flag('box-branch', "line {$line->id} of branch {$line->branch_id} is in a box of branch {$entry->box_branch}");
    }
    if (in_array($entry->box_status, ['open', 'pending'], true) && $cents($entry->amount) !== abs($cents($line->currency_amount ?? $line->amount)) && $cents($entry->amount) !== abs($cents($line->amount))) {
        $flag('box-amount', "box entry {$entry->id} holds {$entry->amount} for line {$line->id} of {$line->currency_amount} {$line->currency}");
    }
}
foreach (DB::table('cash_box_audits')->join('cash_boxes', 'cash_boxes.id', '=', 'cash_box_audits.cash_box_id')->whereIn('cash_boxes.status', ['open', 'pending'])->pluck('cash_boxes.id') as $boxId) {
    $flag('open-box-audited', "open box {$boxId} was approved by the audit");
}
foreach (DB::table('bank_transfer_audits')->whereNotNull('posted_at')->get() as $audit) {
    $adjustment = $audit->adjustment_transaction_id === null ? null : $linesById->get($audit->adjustment_transaction_id);
    if (($cents($audit->difference) === 0) !== ($adjustment === null)) {
        $flag('audit-adjustment', "posted bank audit {$audit->id} has difference {$audit->difference} and adjustment ".($audit->adjustment_transaction_id ?? 'none'));
    } elseif ($adjustment !== null && $cents($adjustment->amount) !== $cents($audit->difference)) {
        $flag('audit-adjustment', "the adjustment of bank audit {$audit->id} is {$adjustment->amount}, not its difference {$audit->difference}");
    }
}
foreach (DB::table('web_payment_operations')->get() as $operation) {
    if ($operation->subscription_transaction_id === null || ! $linesById->has($operation->subscription_transaction_id)) {
        $flag('payment-token', "payment token {$operation->token} points at no line");
    }
}
foreach (DB::table('web_payment_operations')->select('subscription_transaction_id')->groupBy('subscription_transaction_id')->havingRaw('count(*) > 1')->pluck('subscription_transaction_id') as $lineId) {
    $flag('payment-token', "line {$lineId} was recorded by two payment tokens");
}

$counts['subscriptions'] = $subscriptions->count();
$counts['totalOwed'] = $lines->sum(fn ($line) => $cents($line->amount)) / 100;
echo "\n".json_encode(['counts' => $counts, 'violations' => $violations], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
