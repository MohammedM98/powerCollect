<?php

namespace App\Models;

use App\Enums\ChargeType;
use App\Enums\CorrectionReason;
use App\Enums\Currency;
use App\Enums\DiscountMethod;
use App\Enums\PaymentMethod;
use App\Support\BranchClosingWorkflow;
use App\Support\Ledger\LineHistory;
use App\Support\Money;
use Closure;
use Database\Factories\SubscriptionTransactionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Validation\ValidationException;

/**
 * One line of a subscription's account. `amount` is its effect on the
 * balance in shekels: charges (تحميل) are positive, payments, discounts
 * and clearings negative, so the balance is the sum of `amount`. A charge
 * recorded by hand stores its ChargeType as its `type`.
 *
 * A line is normally never edited or removed. Deleting it cancels it —
 * marked with who, when and why — and adds a later reversal line that
 * takes its amount back off the balance; correcting it does the same, then
 * records the right line in its place (`corrects_id`). Legacy deletion actions
 * also preserve the original and record a linked cancellation or refund.
 */
#[Fillable([
    'subscription_id', 'branch_id', 'recorded_by', 'employee_id', 'meter_reading_id', 'reverses_id', 'corrects_id',
    'reference_transaction_id', 'type', 'status', 'source_key', 'mobile_operation_id', 'amount', 'balance_after',
    'currency', 'currency_amount', 'exchange_rate', 'payment_method', 'bank_name', 'sender_bank_name',
    'bank_received_on', 'sender_name', 'reference_number', 'active_reference', 'split_payment_id', 'voucher_number',
    'manual_voucher_number', 'cash_box', 'discount_method', 'discount_value', 'discount_base', 'billed_consumption',
    'notes', 'paid_on', 'late_reason', 'late_payment_token', 'late_payment_fingerprint', 'cancelled_at',
    'cancelled_by', 'cancellation_reason', 'cancellation_notes',
])]
class SubscriptionTransaction extends Model
{
    protected $hidden = ['late_payment_token', 'late_payment_fingerprint'];

    /** @use HasFactory<SubscriptionTransactionFactory> */
    use HasFactory;

    /** The fee charged when a subscription is registered. */
    public const TYPE_SUBSCRIPTION_FEE = 'subscription_fee';

    /** An approved weekly reading's amount due. */
    public const TYPE_METER_READING = 'meter_reading';

    /** Money the subscription paid. */
    public const TYPE_PAYMENT = 'payment';

    /** A generic amount charged to the subscription. */
    public const TYPE_INVOICE = 'invoice';

    /** An adjustment in the subscription's favour. */
    public const TYPE_CREDIT = 'credit';

    /** An amount taken off what the subscription owes. */
    public const TYPE_DISCOUNT = 'discount';

    /**
     * A clearing (مقاصة): a service the subscription gave the company, whose
     * value comes off what they owe as a payment would.
     */
    public const TYPE_CLEARING = 'clearing';

    /**
     * The standing discount taken off an approved weekly reading, beside
     * the reading's own line.
     */
    public const TYPE_READING_DISCOUNT = 'reading_discount';

    /**
     * Takes a cancelled line's amount back off the balance, on the other
     * side of the account from it.
     */
    public const TYPE_REVERSAL = 'reversal';

    /** A reversal of an invoice-like transaction. */
    public const TYPE_CANCELLATION = 'cancellation';

    /** A full or partial reversal of a payment-like transaction. */
    public const TYPE_REFUND = 'refund';

    public const TYPE_BANK_AUDIT_ADJUSTMENT = 'bank_audit_adjustment';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_LINKED_CANCELLATION = 'linked_cancellation';

    /**
     * The lines in the subscription's favour (له); every other type is a
     * charge (عليه).
     */
    public const CREDIT_TYPES = [self::TYPE_PAYMENT, self::TYPE_CREDIT, self::TYPE_DISCOUNT, self::TYPE_READING_DISCOUNT, self::TYPE_CLEARING];

    public const INVOICE_LIKE_TYPES = [self::TYPE_INVOICE, self::TYPE_METER_READING, self::TYPE_SUBSCRIPTION_FEE, 'penalty', 'disconnection_fee', ChargeType::MinimumCharge->value];

    public const PAYMENT_LIKE_TYPES = [self::TYPE_PAYMENT, self::TYPE_CREDIT, self::TYPE_DISCOUNT, self::TYPE_READING_DISCOUNT, self::TYPE_CLEARING];

    public const REVERSAL_TYPES = [self::TYPE_REVERSAL, self::TYPE_CANCELLATION, self::TYPE_REFUND];

    /** Payment details that may change without touching its financial meaning. */
    public const AMENDABLE_FIELDS = ['bank_name', 'sender_bank_name', 'sender_name', 'reference_number', 'notes', 'bank_received_on'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'balance_after' => 'decimal:2',
            'currency' => Currency::class,
            'currency_amount' => 'decimal:2',
            'exchange_rate' => 'decimal:4',
            'payment_method' => PaymentMethod::class,
            'discount_method' => DiscountMethod::class,
            'discount_value' => 'decimal:2',
            'discount_base' => 'decimal:2',
            'billed_consumption' => 'decimal:2',
            'cancelled_at' => 'datetime',
            'paid_on' => 'date',
            'bank_received_on' => 'date:Y-m-d',
            'cancellation_reason' => CorrectionReason::class,
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $transaction): void {
            $transaction->status ??= self::STATUS_ACTIVE;
            $transaction->employee_id ??= $transaction->recorded_by;
            $transaction->reference_transaction_id ??= $transaction->reverses_id;
            $transaction->branch_id ??= $transaction->subscription()->value('branch_id');

            if ($transaction->balance_after === null && $transaction->subscription_id !== null) {
                $currentBalance = Money::sum(self::query()
                    ->where('subscription_id', $transaction->subscription_id)
                    ->pluck('amount'));

                $transaction->balance_after = Money::add($currentBalance, $transaction->amount);
            }
        });
    }

    /**
     * Serialize writes with box closure, including quiet saves and stale models.
     * A closed box's historical transaction must never change in place.
     *
     * @param  array<string, mixed>  $options
     */
    public function save(array $options = []): bool
    {
        if (! $this->exists) {
            return parent::save($options);
        }

        return $this->withMutationLock(function () use ($options): bool {
            $this->ensureMutable();

            return parent::save($options);
        });
    }

    public function delete(): ?bool
    {
        throw ValidationException::withMessages(['action' => 'يجب حفظ السجل المالي؛ ألغِ الحركة أو أرجع الدفعة بدلًا من حذفها.']);
    }

    public function withMutationLock(Closure $operation): mixed
    {
        $branchId = self::query()->whereKey($this->getKey())->value('branch_id');

        return app(BranchClosingWorkflow::class)->locked((int) $branchId, $operation);
    }

    public function ensureMutable(): void
    {
        $stored = self::query()->lockForUpdate()->findOrFail($this->getKey());

        if ($stored->type === self::TYPE_BANK_AUDIT_ADJUSTMENT || LineHistory::isInClosedDay($stored, lockForUpdate: true)) {
            throw ValidationException::withMessages(['action' => 'لا يمكن تغيير أو حذف حركة ضمن صندوق مغلق أو كشف إغلاق أُرسل للتدقيق أو اعتُمد.']);
        }
    }

    public function currentStatus(): string
    {
        if ($this->status !== null) {
            return $this->status;
        }

        return $this->cancelled_at === null ? self::STATUS_ACTIVE : self::STATUS_CANCELLED;
    }

    /**
     * Whether a reading billed this line. Its row must stay, even cancelled,
     * so its source key keeps the reading from billing it again.
     */
    public function isBilledByReading(): bool
    {
        return $this->meter_reading_id !== null;
    }

    public function isCancelled(): bool
    {
        return $this->currentStatus() !== self::STATUS_ACTIVE || $this->cancelled_at !== null;
    }

    public function isReversal(): bool
    {
        return in_array($this->type, self::REVERSAL_TYPES, true);
    }

    public function isPayment(): bool
    {
        return $this->type === self::TYPE_PAYMENT;
    }

    public function isClearing(): bool
    {
        return $this->type === self::TYPE_CLEARING;
    }

    /**
     * Whether the line is a discount: one given by hand, or a weekly
     * reading's standing discount.
     */
    public function isDiscount(): bool
    {
        return in_array($this->type, [self::TYPE_DISCOUNT, self::TYPE_READING_DISCOUNT], true);
    }

    /**
     * Whether the line is in the subscription's favour (له): a payment, a
     * discount or a clearing, or the reversal of a charge. Everything else
     * is a charge (عليه).
     */
    public function isCredit(): bool
    {
        return self::isCreditLine($this->type, $this->amount);
    }

    /** Classify both model instances and report rows without hydrating extra models. */
    public static function isCreditLine(string $type, int|float|string $amount): bool
    {
        return in_array($type, [...self::REVERSAL_TYPES, self::TYPE_BANK_AUDIT_ADJUSTMENT], true)
            ? Money::decimal($amount)->isNegative()
            : in_array($type, self::CREDIT_TYPES, true);
    }

    /**
     * Only the lines that count in the totals: neither cancelled nor the
     * reversal of a cancelled line, which cancel each other out.
     */
    #[Scope]
    protected function counted(Builder $query): void
    {
        $query->whereNull($query->qualifyColumn('cancelled_at'))->whereNull($query->qualifyColumn('reverses_id'));
    }

    /**
     * Only the charges (عليه) that count: readings, fees and penalties.
     */
    #[Scope]
    protected function charges(Builder $query): void
    {
        $query->counted()->whereNotIn($query->qualifyColumn('type'), [...self::CREDIT_TYPES, self::TYPE_REVERSAL])
            ->where(fn (Builder $side): Builder => $side->where($query->qualifyColumn('type'), '!=', self::TYPE_BANK_AUDIT_ADJUSTMENT)->orWhere($query->qualifyColumn('amount'), '>=', 0));
    }

    /**
     * Only the lines in the subscription's favour (له) that count: payments,
     * discounts and clearings.
     */
    #[Scope]
    protected function credits(Builder $query): void
    {
        $query->counted()->where(fn (Builder $side): Builder => $side->whereIn($query->qualifyColumn('type'), self::CREDIT_TYPES)
            ->orWhere(fn (Builder $audit): Builder => $audit->where($query->qualifyColumn('type'), self::TYPE_BANK_AUDIT_ADJUSTMENT)->where($query->qualifyColumn('amount'), '<', 0)));
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function meterReading(): BelongsTo
    {
        return $this->belongsTo(MeterReading::class);
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    /**
     * The cancelled line a reversal takes back.
     */
    public function reverses(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reverses_id');
    }

    /** The original transaction referenced by a cancellation or refund. */
    public function referenceTransaction(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reference_transaction_id');
    }

    /** Cancellation and refund rows that point back to this transaction. */
    public function linkedReversals(): HasMany
    {
        return $this->hasMany(self::class, 'reference_transaction_id')->oldest('created_at')->orderBy('id');
    }

    /**
     * The cancelled line a correction replaces.
     */
    public function corrects(): BelongsTo
    {
        return $this->belongsTo(self::class, 'corrects_id');
    }

    /**
     * The line that replaced this one, when it was corrected rather than
     * deleted.
     */
    public function correction(): HasOne
    {
        return $this->hasOne(self::class, 'corrects_id');
    }

    public function bankTransferAudit(): HasOne
    {
        return $this->hasOne(BankTransferAudit::class, 'adjustment_transaction_id');
    }

    /** The split transfer this payment is a part of, if it is. */
    public function splitPayment(): BelongsTo
    {
        return $this->belongsTo(SplitPayment::class);
    }

    public function amendments(): HasMany
    {
        return $this->hasMany(TransactionAmendment::class, 'transaction_id')->oldest('created_at')->orderBy('id');
    }

    public function closingLine(): HasOne
    {
        return $this->hasOne(ClosingPayment::class, 'subscription_transaction_id');
    }

    /**
     * The payment's or clearing's place in a collector's cash box.
     */
    public function boxEntry(): HasOne
    {
        return $this->hasOne(CashBoxPayment::class, 'subscription_transaction_id');
    }
}
