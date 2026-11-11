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
            ! $transaction->isPayment() => __('Payments only'),
            $transaction->isCancelled() => __('The transaction is cancelled'),
            LineHistory::isInClosedDay($transaction) => __('After the day was closed'),
            default => null,
        };
    }

    /**
     * The statement's البيان for this line.
     */
    public static function description(SubscriptionTransaction $transaction): string
    {
        return match ($transaction->type) {
            SubscriptionTransaction::TYPE_SUBSCRIPTION_FEE => __('New subscription fee'),
            SubscriptionTransaction::TYPE_METER_READING => $transaction->meterReading
                ? implode(' · ', array_filter([
                    sprintf(__('Weekly reading from %s to %s'), $transaction->meterReading->week_start->format('d/m/Y'), $transaction->meterReading->week_end->format('d/m/Y')),
                    self::billedConsumption($transaction) === null ? null : self::billedConsumption($transaction).__(' kWh'),
                ]))
                : __('Weekly reading'),
            SubscriptionTransaction::TYPE_PAYMENT => match ($transaction->payment_method) {
                PaymentMethod::Cash => __('Cash payment'),
                PaymentMethod::BankTransfer => $transaction->sender_name ? __('Bank transfer payment from ').$transaction->sender_name : __('Bank transfer payment'),
                PaymentMethod::Cheque => __('Cheque payment'),
                PaymentMethod::EWallet => __('E-wallet payment'),
                default => __('Payment'),
            },
            SubscriptionTransaction::TYPE_DISCOUNT => __('One-off discount · ').match ($transaction->discount_method) {
                DiscountMethod::Percentage => sprintf(__('%s%% of the balance owed (%s shekels)'), LedgerAmounts::formatAmount($transaction->discount_value), LedgerAmounts::formatAmount($transaction->discount_base)),
                DiscountMethod::Kilowatt => sprintf(__('%s kWh × %s shekels'), LedgerAmounts::formatAmount($transaction->discount_value), LedgerAmounts::formatAmount($transaction->discount_base)),
                default => __('Fixed amount'),
            },
            SubscriptionTransaction::TYPE_CLEARING => __('Clearing for a service to the company'),
            SubscriptionTransaction::TYPE_BANK_AUDIT_ADJUSTMENT => self::bankAuditDescription($transaction),
            SubscriptionTransaction::TYPE_INVOICE => __('Invoice'),
            SubscriptionTransaction::TYPE_CREDIT => __('Credit balance'),
            SubscriptionTransaction::TYPE_READING_DISCOUNT => implode(' · ', array_filter([
                __('Weekly reading discount'),
                match ($transaction->discount_method) {
                    DiscountMethod::Percentage => __('Rate ').LedgerAmounts::formatAmount($transaction->discount_value).'%',
                    DiscountMethod::Kilowatt => LedgerAmounts::formatAmount($transaction->discount_value).__(' free kWh'),
                    default => LedgerAmounts::formatAmount($transaction->discount_value).__(' shekels off the kWh price'),
                },
                self::readingDiscountSegment($transaction),
            ])),
            SubscriptionTransaction::TYPE_REVERSAL, SubscriptionTransaction::TYPE_CANCELLATION => $transaction->referenceTransaction
                ? __('Cancellation: ').self::description($transaction->referenceTransaction).($transaction->referenceTransaction->voucher_number ? __(' · voucher ').self::printedVoucherNumber($transaction->referenceTransaction) : '')
                : __('Reversing entry'),
            SubscriptionTransaction::TYPE_REFUND => $transaction->referenceTransaction
                ? __('Refund: ').self::description($transaction->referenceTransaction).($transaction->referenceTransaction->voucher_number ? __(' · voucher ').self::printedVoucherNumber($transaction->referenceTransaction) : '')
                : __('Payment refund'),
            default => self::typeLabel($transaction),
        };
    }

    public static function bankAuditDescription(SubscriptionTransaction $transaction): string
    {
        $audit = $transaction->bankTransferAudit;
        if ($audit === null) {
            return __('Correction from the financial audit');
        }

        $original = $transaction->referenceTransaction;
        $context = implode(' · ', array_filter([
            __('Correction from the financial audit of an earlier transfer'),
            $original?->reference_number ? __('Transfer reference ').$original->reference_number : null,
            $original !== null && self::printedVoucherNumber($original) ? __('Voucher ').self::printedVoucherNumber($original) : null,
            $original?->created_at ? __('Transfer recorded on ').CarbonImmutable::parse(DailySeries::localDate($original->created_at))->format('d/m/Y') : null,
            __('Correction approved on ').CarbonImmutable::parse(DailySeries::localDate($audit->posted_at ?? $transaction->created_at))->format('d/m/Y'),
        ]));

        $difference = LedgerAmounts::formatAmount(Money::amount(Money::decimal($audit->difference)->abs()));
        if ($audit->outcome === 'missing') {
            return $context.' · '.sprintf(__('Transfer never reached the bank; %s shekels charged to the subscriber.'), $difference);
        }

        $effect = Money::decimal($audit->difference)->isPositive()
            ? sprintf(__('Difference of %s shekels charged.'), $difference)
            : sprintf(__('Difference of %s shekels credited to the subscriber.'), $difference);

        return $context.' · '.sprintf(__('Transfer arrived as %s instead of %s %s; %s'),
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
        return self::typeLabels()[$transaction->type] ?? __('Transaction');
    }

    /**
     * Every type of line and its name, charges first.
     *
     * @return array<string, string>
     */
    public static function typeLabels(): array
    {
        return [
            SubscriptionTransaction::TYPE_INVOICE => __('Invoice'),
            SubscriptionTransaction::TYPE_METER_READING => __('Weekly reading'),
            SubscriptionTransaction::TYPE_SUBSCRIPTION_FEE => __('Subscription fee'),
            ...collect(ChargeType::cases())->mapWithKeys(fn (ChargeType $type) => [$type->value => __($type->label())])->all(),
            SubscriptionTransaction::TYPE_PAYMENT => __('Payment'),
            SubscriptionTransaction::TYPE_CREDIT => __('Credit balance'),
            SubscriptionTransaction::TYPE_DISCOUNT => __('Discount'),
            SubscriptionTransaction::TYPE_READING_DISCOUNT => __('Weekly reading discount'),
            SubscriptionTransaction::TYPE_CLEARING => __('Clearing'),
            SubscriptionTransaction::TYPE_REVERSAL => __('Reversing entry'),
            SubscriptionTransaction::TYPE_CANCELLATION => __('Cancellation'),
            SubscriptionTransaction::TYPE_REFUND => __('Refund'),
            SubscriptionTransaction::TYPE_BANK_AUDIT_ADJUSTMENT => __('Correction entry'),
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
