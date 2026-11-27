<?php

namespace App\Support\Ledger;

use App\Enums\ChargeType;
use App\Enums\DiscountMethod;
use App\Models\SplitPayment;
use App\Models\Subscription;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Closing\BranchLock;
use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Records a money line from a web window once per form: the window sends a
 * key (a UUID), and a second request with the same key — a double click or a
 * retried request — gets the line already recorded instead of another one.
 * The same key with other details, another subscription or another user is
 * refused. A payment sends its key as `payment_token`; a charge, clearing,
 * discount or split transfer as `operation_token`.
 */
class WebPaymentOperation
{
    public const PAYMENT = 'payment';

    public const CHARGE = 'charge';

    public const CLEARING = 'clearing';

    public const DISCOUNT = 'discount';

    public const SPLIT = 'split';

    /** The details each kind of line is recorded from; a retry must send the same ones. */
    private const FIELDS = [
        self::PAYMENT => ['amount', 'currency', 'payment_method', 'bank_name', 'sender_bank_name', 'bank_received_on', 'sender_name', 'reference_number', 'cash_box', 'manual_voucher_number', 'notes'],
        self::CHARGE => ['type', 'amount', 'notes'],
        self::CLEARING => ['amount', 'notes', 'manual_voucher_number'],
        self::DISCOUNT => ['method', 'value', 'notes'],
        self::SPLIT => ['total_amount', 'bank_name', 'sender_bank_name', 'bank_received_on', 'sender_name', 'reference_number', 'notes'],
    ];

    /**
     * The `operation_token` rule a charge, clearing, discount or split transfer request adds.
     *
     * @return array<string, array<int, string>>
     */
    public static function operationTokenRules(): array
    {
        return ['operation_token' => ['required', 'uuid']];
    }

    /** @return array<string, string> */
    public static function operationTokenMessages(): array
    {
        return [
            'operation_token.required' => __('The recording request could not be identified. Reopen the form and try again.'),
            'operation_token.uuid' => __('The recording request is not valid. Reopen the form and try again.'),
        ];
    }

    /** @param array<string, mixed> $payment */
    public function record(Subscription $subscription, User $actor, array $payment): SubscriptionTransaction
    {
        return $this->once(self::PAYMENT, $subscription, $actor, $payment, fn (): SubscriptionTransaction => RecordPayment::handle($subscription, $actor, $payment));
    }

    /** @param array<string, mixed> $charge */
    public function recordCharge(Subscription $subscription, User $actor, array $charge): SubscriptionTransaction
    {
        return $this->once(self::CHARGE, $subscription, $actor, $charge, fn (): SubscriptionTransaction => RecordCharge::handle($subscription, $actor, ChargeType::from($charge['type']), $charge['amount'], $charge['notes'] ?? null));
    }

    /** @param array<string, mixed> $clearing */
    public function recordClearing(Subscription $subscription, User $actor, array $clearing): SubscriptionTransaction
    {
        return $this->once(self::CLEARING, $subscription, $actor, $clearing, fn (): SubscriptionTransaction => RecordClearing::handle($subscription, $actor, $clearing['amount'], $clearing['notes'], $clearing['manual_voucher_number'] ?? null));
    }

    /** @param array<string, mixed> $discount */
    public function recordDiscount(Subscription $subscription, User $actor, array $discount): SubscriptionTransaction
    {
        return $this->once(self::DISCOUNT, $subscription, $actor, $discount, fn (): SubscriptionTransaction => RecordDiscount::handle($subscription, $actor, DiscountMethod::from($discount['method']), $discount['value'], $discount['notes'] ?? null));
    }

    /**
     * Record a split transfer once; its key points at the transfer's first
     * part, from which a retry finds the transfer.
     *
     * @param  array<string, mixed>  $shared
     * @param  array<int, array{subscription: Subscription, amount: string}>  $parts
     */
    public function recordSplit(User $actor, array $shared, array $parts): SplitPayment
    {
        $replaySplit = fn (): ?SplitPayment => $this->replaySplit($actor, $shared, $parts);

        try {
            return DB::transaction(function () use ($actor, $shared, $parts, $replaySplit): SplitPayment {
                if ($existing = $replaySplit()) {
                    return $existing;
                }

                $split = SplitPayment::record($actor, $shared, $parts);
                $this->remember($shared, $this->splitFingerprint($actor, $shared, $parts), $split->payments()->value('id'));

                return $split;
            });
        } catch (UniqueConstraintViolationException $exception) {
            return $replaySplit() ?? throw $exception;
        }
    }

    /**
     * The line already recorded with this request's key, or null when the
     * key is new. A key used with other details is refused.
     *
     * @param  array<string, mixed>  $data
     */
    public function replay(Subscription $subscription, User $actor, array $data, string $kind = self::PAYMENT): ?SubscriptionTransaction
    {
        return $this->find($data, $this->fingerprint($kind, $subscription, $actor, $data));
    }

    /**
     * The split transfer already recorded with this request's key, or null.
     *
     * @param  array<string, mixed>  $shared
     * @param  array<int, array{subscription: Subscription, amount: string}>  $parts
     */
    public function replaySplit(User $actor, array $shared, array $parts): ?SplitPayment
    {
        $part = $this->find($shared, $this->splitFingerprint($actor, $shared, $parts));

        return $part ? SplitPayment::query()->acrossBranches()->findOrFail($part->split_payment_id) : null;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  Closure(): SubscriptionTransaction  $recordLine
     */
    private function once(string $kind, Subscription $subscription, User $actor, array $data, Closure $recordLine): SubscriptionTransaction
    {
        try {
            return BranchLock::run($subscription->branch_id, function () use ($kind, $subscription, $actor, $data, $recordLine): SubscriptionTransaction {
                if ($existing = $this->replay($subscription, $actor, $data, $kind)) {
                    return $existing;
                }

                $transaction = $recordLine();
                $this->remember($data, $this->fingerprint($kind, $subscription, $actor, $data), $transaction->id);

                return $transaction;
            });
        } catch (UniqueConstraintViolationException $exception) {
            return $this->replay($subscription, $actor, $data, $kind) ?? throw $exception;
        }
    }

    /** @param array<string, mixed> $data */
    private function remember(array $data, string $fingerprint, int $transactionId): void
    {
        DB::table('web_payment_operations')->insert([
            'token' => $this->token($data),
            'fingerprint' => $fingerprint,
            'subscription_transaction_id' => $transactionId,
        ]);
    }

    /** @param array<string, mixed> $data */
    private function find(array $data, string $fingerprint): ?SubscriptionTransaction
    {
        $existing = DB::table('web_payment_operations')->where('token', $this->token($data))->first();
        if ($existing === null) {
            return null;
        }

        if (! hash_equals($existing->fingerprint, $fingerprint) || $existing->subscription_transaction_id === null) {
            throw isset($data['payment_token'])
                ? ValidationException::withMessages(['payment_token' => __('This recording request was already used with different details. Reopen the form for a new payment.')])
                : ValidationException::withMessages(['operation_token' => __('This recording request was already used with different details. Reopen the form and try again.')]);
        }

        return SubscriptionTransaction::query()->acrossBranches()->findOrFail($existing->subscription_transaction_id);
    }

    /** @param array<string, mixed> $data */
    private function token(array $data): string
    {
        return strtolower($data['payment_token'] ?? $data['operation_token']);
    }

    /**
     * A payment's fingerprint is kept as it always was; the other kinds also
     * carry their kind, so one window's key is refused by another.
     *
     * @param  array<string, mixed>  $data
     */
    private function fingerprint(string $kind, Subscription $subscription, User $actor, array $data): string
    {
        $fingerprint = [...($kind === self::PAYMENT ? [] : ['operation' => $kind]), 'subscription' => $subscription->id, 'branch' => $subscription->branch_id, 'actor' => $actor->id];

        return $this->hash([...$fingerprint, ...$this->details($kind, $data)]);
    }

    /**
     * @param  array<string, mixed>  $shared
     * @param  array<int, array{subscription: Subscription, amount: string}>  $parts
     */
    private function splitFingerprint(User $actor, array $shared, array $parts): string
    {
        return $this->hash([
            'operation' => self::SPLIT,
            'actor' => $actor->id,
            ...$this->details(self::SPLIT, $shared),
            'parts' => array_map(fn (array $part): array => [$part['subscription']->id, Money::amount($part['amount'])], $parts),
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function details(string $kind, array $data): array
    {
        $details = [];
        foreach (self::FIELDS[$kind] as $field) {
            $details[$field] = $data[$field] ?? null;
        }
        foreach (['amount', 'total_amount', 'value'] as $field) {
            if (array_key_exists($field, $details) && is_numeric($details[$field])) {
                $details[$field] = Money::amount($details[$field]);
            }
        }

        return $details;
    }

    /** @param array<string, mixed> $data */
    private function hash(array $data): string
    {
        return hash('sha256', json_encode($data, JSON_THROW_ON_ERROR));
    }
}
