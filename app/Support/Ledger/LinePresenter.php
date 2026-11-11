<?php

namespace App\Support\Ledger;

use App\Enums\ChargeType;
use App\Enums\Currency;
use App\Enums\DiscountMethod;
use App\Enums\PaymentMethod;
use App\Models\Bank;
use App\Models\SubscriptionTransaction;
use App\Models\User;
use App\Support\Reports\DailySeries;
use Carbon\CarbonImmutable;
use Closure;

/**
 * How a ledger line is described and labelled on statements, receipts, box tables and reports.
 */
class LinePresenter
{
    /** A final box number after closure, retaining legacy values for ungrouped payments. */
    public static function cashBoxNumber(SubscriptionTransaction $transaction): ?string
    {
        $box = $transaction->boxEntry?->box;

        return $box ? ($box->isEditable() ? null : $box->number) : $transaction->cash_box;
    }

    /** Why a permitted user cannot amend this line right now. */
    public static function amendmentUnavailableReason(SubscriptionTransaction $transaction): ?string
    {
        return match (true) {
            ! $transaction->isPayment() => 'متاح للدفعات فقط',
            $transaction->isCancelled() => 'الحركة ملغاة',
            LineHistory::isInClosedDay($transaction) => 'بعد إغلاق اليوم',
            default => null,
        };
    }

    /**
     * The statement's البيان for this line.
     */
    public static function description(SubscriptionTransaction $transaction): string
    {
        return match ($transaction->type) {
            SubscriptionTransaction::TYPE_SUBSCRIPTION_FEE => 'رسوم اشتراك جديد',
            SubscriptionTransaction::TYPE_METER_READING => $transaction->meterReading
                ? implode(' · ', array_filter([
                    sprintf('قراءة أسبوعية من %s إلى %s', $transaction->meterReading->week_start->format('d/m/Y'), $transaction->meterReading->week_end->format('d/m/Y')),
                    self::billedConsumption($transaction) === null ? null : self::billedConsumption($transaction).' كيلو',
                ]))
                : 'قراءة أسبوعية',
            SubscriptionTransaction::TYPE_PAYMENT => match ($transaction->payment_method) {
                PaymentMethod::Cash => 'دفعة نقدية',
                PaymentMethod::BankTransfer => $transaction->sender_name ? 'دفعة بتحويل بنكي من '.$transaction->sender_name : 'دفعة بتحويل بنكي',
                PaymentMethod::Cheque => 'دفعة بشيك',
                PaymentMethod::EWallet => 'دفعة بمحفظة إلكترونية',
                default => 'دفعة',
            },
            SubscriptionTransaction::TYPE_DISCOUNT => 'خصم لمرة واحدة · '.match ($transaction->discount_method) {
                DiscountMethod::Percentage => sprintf('نسبة %s%% من الرصيد المستحق (%s شيكل)', LedgerAmounts::formatAmount($transaction->discount_value), LedgerAmounts::formatAmount($transaction->discount_base)),
                DiscountMethod::Kilowatt => sprintf('%s كيلو × %s شيكل', LedgerAmounts::formatAmount($transaction->discount_value), LedgerAmounts::formatAmount($transaction->discount_base)),
                default => 'مبلغ ثابت',
            },
            SubscriptionTransaction::TYPE_CLEARING => 'مقاصة مقابل خدمة للشركة',
            SubscriptionTransaction::TYPE_BANK_AUDIT_ADJUSTMENT => self::bankAuditDescription($transaction),
            SubscriptionTransaction::TYPE_INVOICE => 'فاتورة',
            SubscriptionTransaction::TYPE_CREDIT => 'رصيد دائن',
            SubscriptionTransaction::TYPE_READING_DISCOUNT => implode(' · ', array_filter([
                'خصم القراءة الأسبوعية',
                match ($transaction->discount_method) {
                    DiscountMethod::Percentage => 'نسبة '.LedgerAmounts::formatAmount($transaction->discount_value).'%',
                    DiscountMethod::Kilowatt => LedgerAmounts::formatAmount($transaction->discount_value).' كيلو مجاني',
                    default => LedgerAmounts::formatAmount($transaction->discount_value).' شيكل من سعر الكيلو',
                },
                self::readingDiscountSegment($transaction),
            ])),
            SubscriptionTransaction::TYPE_REVERSAL, SubscriptionTransaction::TYPE_CANCELLATION => $transaction->referenceTransaction
                ? 'إلغاء: '.self::description($transaction->referenceTransaction).($transaction->referenceTransaction->voucher_number ? ' · سند '.self::printedVoucherNumber($transaction->referenceTransaction) : '')
                : 'قيد عكسي',
            SubscriptionTransaction::TYPE_REFUND => $transaction->referenceTransaction
                ? 'إرجاع: '.self::description($transaction->referenceTransaction).($transaction->referenceTransaction->voucher_number ? ' · سند '.self::printedVoucherNumber($transaction->referenceTransaction) : '')
                : 'إرجاع دفعة',
            default => self::typeLabel($transaction),
        };
    }

    public static function bankAuditDescription(SubscriptionTransaction $transaction): string
    {
        $audit = $transaction->bankTransferAudit;
        if ($audit === null) {
            return 'تصحيح ناتج عن التدقيق المالي';
        }

        $original = $transaction->referenceTransaction;
        $context = implode(' · ', array_filter([
            'تصحيح ناتج عن التدقيق المالي لحوالة سابقة',
            $original?->reference_number ? 'مرجع الحوالة '.$original->reference_number : null,
            $original !== null && self::printedVoucherNumber($original) ? 'سند '.self::printedVoucherNumber($original) : null,
            $original?->created_at ? 'تاريخ تسجيل الحوالة '.CarbonImmutable::parse(DailySeries::localDate($original->created_at))->format('d/m/Y') : null,
            'تاريخ اعتماد التصحيح '.CarbonImmutable::parse(DailySeries::localDate($audit->posted_at ?? $transaction->created_at))->format('d/m/Y'),
        ]));

        $difference = LedgerAmounts::formatAmount(Money::amount(Money::decimal($audit->difference)->abs()));
        if ($audit->outcome === 'missing') {
            return $context.' · '.sprintf('حوالة لم تصل للبنك؛ تحميل %s شيكل على المشترك.', $difference);
        }

        $effect = Money::decimal($audit->difference)->isPositive()
            ? sprintf('تحميل فرق %s شيكل.', $difference)
            : sprintf('إضافة فرق %s شيكل لصالح المشترك.', $difference);

        return $context.' · '.sprintf('حوالة وصلت %s بدل %s %s؛ %s',
            LedgerAmounts::formatAmount($audit->bank_amount),
            LedgerAmounts::formatAmount($audit->recorded_amount),
            __($transaction->currency->label()),
            $effect,
        );
    }

    /**
     * The kWh a weekly reading's charge was billed for: kept on the line
     * when it was billed, else its reading's while the line stands. A line
     * cancelled before that was kept no longer knows it (its reading may
     * have been corrected since), so it says nothing rather than the new one.
     */
    public static function billedConsumption(SubscriptionTransaction $transaction): ?string
    {
        if ($transaction->billed_consumption !== null) {
            return LedgerAmounts::formatAmount($transaction->billed_consumption);
        }

        return $transaction->isCancelled() || $transaction->meterReading === null ? null : LedgerAmounts::formatAmount($transaction->meterReading->consumption);
    }

    /**
     * The customer segment a weekly reading's standing discount was given
     * to, or null when none was named.
     */
    public static function readingDiscountSegment(SubscriptionTransaction $transaction): ?string
    {
        return $transaction->meterReading?->discount_segment ?? $transaction->notes;
    }

    /**
     * The line as the subscriber's statement shows it, for the tables of
     * box entries: its voucher, bank details, date, description, type,
     * method, currency and rate, and who recorded it. Loads `recordedBy`
     * when not loaded already.
     *
     * @return array{voucherNumber: ?string, referenceNumber: ?string, bankName: ?string, senderBankName: ?string, date: string, description: string, typeLabel: string, isCredit: bool, paymentMethodLabel: ?string, currencyLabel: string, paidAmount: string, isShekel: bool, exchangeRate: string, recordedByName: ?string}
     */
    public static function ledgerDetails(SubscriptionTransaction $transaction): array
    {
        return [
            'voucherNumber' => self::displayVoucherNumber($transaction),
            'referenceNumber' => $transaction->reference_number,
            'bankName' => $transaction->bank_name,
            'senderBankName' => $transaction->sender_bank_name,
            'date' => $transaction->created_at->copy()->setTimezone(config('app.business_timezone'))->format('Y-m-d H:i'),
            'paidOn' => $transaction->paid_on?->toDateString(),
            'bankReceivedOn' => $transaction->bank_received_on?->toDateString(),
            'lateReason' => $transaction->late_reason,
            'description' => self::description($transaction),
            'typeLabel' => self::typeLabel($transaction),
            'isCredit' => $transaction->isCredit(),
            'paymentMethodLabel' => $transaction->payment_method ? __($transaction->payment_method->label()) : null,
            'currencyLabel' => __($transaction->currency->label()),
            // What was paid in its own currency; boxes hold its value in shekels.
            'paidAmount' => $transaction->currency_amount ?? ltrim($transaction->amount, '-'),
            'isShekel' => $transaction->currency === Currency::Shekel,
            'exchangeRate' => rtrim(rtrim($transaction->exchange_rate, '0'), '.'),
            'recordedByName' => $transaction->recordedBy?->name,
        ];
    }

    /**
     * The type of line, shown with its عليه / له tag.
     */
    public static function typeLabel(SubscriptionTransaction $transaction): string
    {
        return self::typeLabels()[$transaction->type] ?? 'حركة';
    }

    /**
     * Every type of line and its name, charges first.
     *
     * @return array<string, string>
     */
    public static function typeLabels(): array
    {
        return [
            SubscriptionTransaction::TYPE_INVOICE => 'فاتورة',
            SubscriptionTransaction::TYPE_METER_READING => 'قراءة أسبوعية',
            SubscriptionTransaction::TYPE_SUBSCRIPTION_FEE => 'رسوم اشتراك',
            ...collect(ChargeType::cases())->mapWithKeys(fn (ChargeType $type) => [$type->value => __($type->label())])->all(),
            SubscriptionTransaction::TYPE_PAYMENT => 'دفعة',
            SubscriptionTransaction::TYPE_CREDIT => 'رصيد دائن',
            SubscriptionTransaction::TYPE_DISCOUNT => 'خصم',
            SubscriptionTransaction::TYPE_READING_DISCOUNT => 'خصم القراءة الأسبوعية',
            SubscriptionTransaction::TYPE_CLEARING => 'مقاصة',
            SubscriptionTransaction::TYPE_REVERSAL => 'قيد عكسي',
            SubscriptionTransaction::TYPE_CANCELLATION => 'إلغاء',
            SubscriptionTransaction::TYPE_REFUND => 'إرجاع',
            SubscriptionTransaction::TYPE_BANK_AUDIT_ADJUSTMENT => 'حركة تصحيح',
        ];
    }

    /**
     * The voucher number as it is printed, six digits (000042), or null
     * for a line that has none.
     */
    public static function printedVoucherNumber(SubscriptionTransaction $transaction): ?string
    {
        return $transaction->voucher_number ? str_pad((string) $transaction->voucher_number, 6, '0', STR_PAD_LEFT) : null;
    }

    /** The one voucher shown to users: paper/manual first, otherwise system-generated. */
    public static function displayVoucherNumber(SubscriptionTransaction $transaction): ?string
    {
        return $transaction->manual_voucher_number ?: self::printedVoucherNumber($transaction);
    }
}
