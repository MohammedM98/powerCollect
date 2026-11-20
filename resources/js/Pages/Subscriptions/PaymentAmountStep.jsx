import { Button, Input } from '@heroui/react';
import Icon from '@/Components/Icon';
import InputError from '@/Components/InputError';
import SearchableSelect from '@/Components/SearchableSelect';
import { formatMoney, normalizeDecimalInput } from '@/lib/format';
import { FormStep } from './AccountFormParts';

const QUICK_AMOUNTS = [50, 100, 200];

/** The amount received: currency, amount, quick amounts, the exchange rate and what it comes to in shekels. */
export default function PaymentAmountStep({
    amountInput,
    currencies,
    currencyLabel,
    currencyMark,
    data,
    errors,
    exchangeRate,
    inShekels,
    overpayment,
    owed,
    setAmount,
    setCurrency,
    setData,
    titleId,
}) {
    return (
        <FormStep number={1} title="المبلغ المستلم" done={Number(data.amount) > 0 && inShekels !== null}>
            <div>
                <label htmlFor="amount" className="sr-only">
                    المبلغ المستلم
                </label>
                <div className="gl-amount" data-invalid={errors.amount ? true : undefined}>
                    <div className="flex items-center gap-3">
                        <Input
                            ref={amountInput}
                            id="amount"
                            name="amount"
                            required
                            autoFocus
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            dir="ltr"
                            aria-describedby={errors.amount ? `${titleId}-amount-error` : undefined}
                            value={data.amount}
                            onChange={(e) =>
                                setData((current) => ({ ...current, amount: normalizeDecimalInput(e.target.value), confirm_overpayment: false }))
                            }
                            className="gl-amount-input"
                        />
                        <div className="w-40 shrink-0 sm:w-44">
                            <label htmlFor="payment-currency" className="sr-only">
                                عملة الدفع
                            </label>
                            <SearchableSelect
                                id="payment-currency"
                                name="currency"
                                required
                                value={data.currency}
                                onChange={setCurrency}
                                options={currencies.map((currency) => ({ value: currency.code, label: `${currency.label} (${currency.code})` }))}
                                searchable={false}
                                clearable={false}
                            />
                        </div>
                    </div>
                    {data.currency !== 'ILS' && (
                        <p className="mt-3 text-sm" style={{ color: Number(exchangeRate) > 0 ? 'var(--gl-muted)' : 'var(--gl-bad)' }} role="status">
                            {Number(exchangeRate) > 0 ? (
                                <>
                                    سعر الصرف المعتمد: 1 {currencyLabel} = <bdi className="font-display font-semibold">{Number(exchangeRate)}</bdi>{' '}
                                    شيكل
                                </>
                            ) : (
                                'لم يُضبط سعر لهذه العملة؛ يجب ضبطه من صفحة العملات وأسعار الصرف أولًا.'
                            )}
                        </p>
                    )}
                    <div className="gl-amount-quick">
                        {owed > 0 && (
                            <Button
                                isDisabled={data.currency !== 'ILS' && !(Number(exchangeRate) > 0)}
                                onClick={() => setAmount(String(Number((owed / (data.currency === 'ILS' ? 1 : Number(exchangeRate))).toFixed(2))))}
                                className="gl-chip gl-chip-sm"
                                style={{ color: 'var(--gl-ok)', borderColor: 'color-mix(in srgb, var(--gl-ok) 40%, transparent)' }}
                            >
                                تسديد كامل الدين
                            </Button>
                        )}
                        {QUICK_AMOUNTS.map((quick) => (
                            <Button key={quick} onClick={() => setAmount(String(quick))} className="gl-chip gl-chip-sm gl-num">
                                {quick}
                            </Button>
                        ))}
                    </div>
                </div>
                <InputError message={errors.currency} className="mt-2" />
                <InputError message={errors.payment_token} className="mt-2" />
                <InputError message={errors.exchange_rate} className="mt-2" />
                {errors.amount && (
                    <p id={`${titleId}-amount-error`} role="alert" className="gl-error mt-2 flex items-center gap-1.5">
                        <Icon name="info" className="h-[18px] w-[18px]" />
                        {errors.amount}
                    </p>
                )}
                {overpayment !== 'none' && (
                    <div
                        role={overpayment === 'confirm' ? 'alert' : 'status'}
                        className="gl-notice mt-3"
                        style={{ '--gl-c': overpayment === 'confirm' ? 'var(--gl-bad)' : 'var(--gl-warn)' }}
                    >
                        <p className="flex items-start gap-2 font-medium">
                            <Icon name="alert" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                            <span>
                                {overpayment === 'confirm' ? 'المبلغ أكبر بكثير من المستحق' : 'المبلغ أكبر من المستحق'} على المشترك (
                                <bdi className="font-display">{formatMoney(owed)}</bdi> ₪)، وسيبقى له رصيد دائن قدره{' '}
                                <bdi className="font-display font-bold">{formatMoney((inShekels ?? 0) - owed)}</bdi> ₪.
                                {overpayment === 'confirm' && ' تأكد أنك لم تكتب رقمًا زائدًا بالخطأ.'}
                            </span>
                        </p>
                        {overpayment === 'confirm' && (
                            <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
                                <input
                                    type="checkbox"
                                    className="h-[18px] w-[18px]"
                                    checked={data.confirm_overpayment}
                                    onChange={(e) => setData('confirm_overpayment', e.target.checked)}
                                />
                                أؤكد أن المبلغ <bdi className="font-display">{formatMoney(data.amount)}</bdi> {currencyMark} صحيح
                            </label>
                        )}
                        <InputError message={errors.confirm_overpayment} className="mt-2" />
                    </div>
                )}
                {data.currency !== 'ILS' && inShekels !== null && (
                    <p role="status" className="mt-3 text-sm text-gray-600">
                        القيمة المسجلة على حساب المشترك: <bdi className="font-display font-semibold">{formatMoney(inShekels)}</bdi> شيكل.
                    </p>
                )}
            </div>
        </FormStep>
    );
}
