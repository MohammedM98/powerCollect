import { usePage } from '@inertiajs/react';
import { Button, Input, Label, Radio, RadioGroup, Switch, TextField } from '@heroui/react';
import Icon from '@/Components/Icon';
import InputError from '@/Components/InputError';
import BrandLogo from '@/Components/BrandLogo';
import { BankReceivedDateField } from '@/Components/BankReceivedDate';
import { BankDropdown, BankMark } from '@/Components/Banks';
import { useBrand } from '@/hooks/useBrand';
import { describeBalance } from '@/lib/accountStatement';
import { formatMoney, normalizeDecimalInput } from '@/lib/format';
import { balanceText, FormHeader } from './AccountFormParts';
import { CheckBox, SearchableSelect } from '@/Components/UI';

const QUICK_AMOUNTS = [50, 100, 200];

/**
 * Recording a payment, laid out as in the redesign (docs/redesign) with
 * HeroUI's components: the amount large in the middle with its currency and
 * quick amounts, the ways of paying as two big cards, the company's banks as
 * chips, the transfer's details two by two, and one green button carrying
 * the amount; beside it, the receipt the payment will print, filled in as
 * the form is. The fields, their names and their checks are the payment
 * window's own (PaymentModal.jsx), so nothing about saving changes.
 */
export default function PaymentCheckout(props) {
    const { titleId, requestClose, subscription } = props;

    return (
        <div className="gl-co">
            <div className="gl-co-head">
                <FormHeader
                    titleId={titleId}
                    icon="banknotes"
                    tone="payment"
                    title="تسجيل دفعة"
                    subtitle={`${subscription.fullName}، حساب ${subscription.accountNumber}`}
                    onClose={requestClose}
                />
            </div>
            <div className="gl-co-body">
                <CheckoutAmount {...props} />
                <CheckoutMethods {...props} />
                {props.throughBank ? <CheckoutTransfer {...props} /> : <CheckoutCash {...props} />}
                <NotesField {...props} />
            </div>
            <aside className="gl-co-aside" aria-label="معاينة الوصل">
                <ReceiptPreview {...props} />
                <p className="gl-co-aside-note">
                    <Icon name="shield" className="h-4 w-4 shrink-0" />
                    تُسجَّل في صندوقك، ويُطبع الوصل بعد التأكيد.
                </p>
            </aside>
            <CheckoutFooter {...props} />
        </div>
    );
}

/** The amount received, large, with its currency, the quick amounts and what it comes to in shekels. */
function CheckoutAmount({ amountInput, currencies, currencyLabel, currencyMark, data, errors, exchangeRate, inShekels, overpayment, owed, setAmount, setCurrency, setData, subscription, titleId }) {
    const ownedInCurrency = data.currency === 'ILS' ? owed : Number(exchangeRate) > 0 ? owed / Number(exchangeRate) : null;
    const weeklyMinimum = Number(subscription.weeklyMinimumPayment ?? subscription.minimumPayment ?? 0);

    return (
        <section className="gl-co-amount">
            <label id={`${titleId}-amount`} htmlFor="amount" className="gl-co-amount-label">المبلغ المستلم</label>
            <div className="gl-co-amount-row" data-invalid={errors.amount ? true : undefined}>
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
                    onChange={(e) => setData((current) => ({ ...current, amount: normalizeDecimalInput(e.target.value), confirm_overpayment: false }))}
                    className="gl-co-amount-input gl-num"
                    style={{ width: `${data.amount ? Math.max(2, String(data.amount).length + 1) : 4.6}ch` }}
                />
                <div className="gl-co-currency">
                    <label htmlFor="payment-currency" className="sr-only">عملة الدفع</label>
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

            <div className="gl-co-quick">
                {owed > 0 && (
                    <Button
                        size="sm"
                        variant="secondary"
                        className="gl-co-chip is-accent"
                        aria-label="تسديد كامل الدين"
                        isDisabled={ownedInCurrency === null}
                        onPress={() => setAmount(String(Number(ownedInCurrency.toFixed(2))))}
                    >
                        تسديد كامل الدين، <bdi className="gl-num">{formatMoney(owed)}</bdi> ₪
                    </Button>
                )}
                {weeklyMinimum > 0 && data.currency === 'ILS' && (
                    <Button size="sm" variant="secondary" className="gl-co-chip" onPress={() => setAmount(String(weeklyMinimum))}>
                        الحد الأدنى <bdi className="gl-num">{formatMoney(weeklyMinimum)}</bdi>
                    </Button>
                )}
                {QUICK_AMOUNTS.map((quick) => (
                    <Button key={quick} size="sm" variant="secondary" className="gl-co-chip gl-num" onPress={() => setAmount(String(quick))}>
                        {quick}
                    </Button>
                ))}
            </div>

            {data.currency !== 'ILS' && (
                <p className="gl-co-note" role="status" style={{ color: Number(exchangeRate) > 0 ? undefined : 'var(--gl-bad)' }}>
                    {Number(exchangeRate) > 0 ? (
                        <>
                            سعر الصرف المعتمد: 1 {currencyLabel} = <bdi className="gl-num">{Number(exchangeRate)}</bdi> شيكل
                            {inShekels !== null && <>، على حساب المشترك: <bdi className="gl-num">{formatMoney(inShekels)}</bdi> شيكل</>}
                        </>
                    ) : (
                        'لم يُضبط سعر لهذه العملة؛ يجب ضبطه من صفحة العملات وأسعار الصرف أولًا.'
                    )}
                </p>
            )}

            <InputError message={errors.currency} className="mt-2" />
            <InputError message={errors.payment_token} className="mt-2" />
            <InputError message={errors.exchange_rate} className="mt-2" />
            {errors.amount && (
                <p id={`${titleId}-amount-error`} role="alert" className="gl-error mt-2 flex items-center justify-center gap-1.5">
                    <Icon name="info" className="h-[18px] w-[18px]" />
                    {errors.amount}
                </p>
            )}
            {overpayment !== 'none' && (
                <div role={overpayment === 'confirm' ? 'alert' : 'status'} className="gl-notice mt-3 text-start" style={{ '--gl-c': overpayment === 'confirm' ? 'var(--gl-bad)' : 'var(--gl-warn)' }}>
                    <p className="flex items-start gap-2 font-medium">
                        <Icon name="alert" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                        <span>
                            {overpayment === 'confirm' ? 'المبلغ أكبر بكثير من المستحق' : 'المبلغ أكبر من المستحق'} على المشترك (
                            <bdi className="gl-num">{formatMoney(owed)}</bdi> ₪)، وسيبقى له رصيد دائن قدره <bdi className="gl-num font-bold">{formatMoney((inShekels ?? 0) - owed)}</bdi> ₪.
                            {overpayment === 'confirm' && ' تأكد أنك لم تكتب رقمًا زائدًا بالخطأ.'}
                        </span>
                    </p>
                    {overpayment === 'confirm' && (
                        <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
                            <CheckBox checked={data.confirm_overpayment} onChange={(e) => setData('confirm_overpayment', e.target.checked)} />
                            أؤكد أن المبلغ <bdi className="gl-num">{formatMoney(data.amount)}</bdi> {currencyMark} صحيح
                        </label>
                    )}
                    <InputError message={errors.confirm_overpayment} className="mt-2" />
                </div>
            )}
        </section>
    );
}

const METHOD_CARDS = {
    bank_transfer: { icon: 'bank', title: 'تحويل بنكي أو محفظة', tone: 'transfer' },
    cash: { icon: 'banknotes', title: 'نقد', hint: 'استُلم المبلغ نقدًا', tone: 'cash' },
};

/** How it was paid: two big cards (HeroUI's radio group), picked with the mouse or the 1 and 2 keys. */
function CheckoutMethods({ data, errors, methods, setData, transferBanks }) {
    return (
        <section className="gl-co-section">
            <div className="gl-co-h-row">
                <h4 className="gl-co-h">طريقة الدفع</h4>
                <span className="gl-co-opt" aria-hidden="true">اضغط 1 أو 2</span>
            </div>
            <RadioGroup name="payment_method" aria-label="طريقة الدفع" orientation="horizontal" value={data.payment_method} onChange={(value) => setData('payment_method', value)} className="gl-co-methods">
                {methods.map((method, index) => {
                    const card = METHOD_CARDS[method];

                    return (
                        <Radio key={method} value={method} className="gl-co-method" data-tone={card.tone}>
                            <Radio.Content className="gl-co-method-content">
                                <span className="gl-co-method-icon"><Icon name={card.icon} className="h-6 w-6" strokeWidth={1.8} /></span>
                                <span className="min-w-0">
                                    <b>{card.title}</b>
                                    <small>{card.hint ?? transferBanks.join('، ')}</small>
                                </span>
                                <Radio.Control className="gl-co-check"><Radio.Indicator><Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /></Radio.Indicator></Radio.Control>
                                <span className="gl-co-key gl-num" aria-hidden="true">{index + 1}</span>
                            </Radio.Content>
                        </Radio>
                    );
                })}
            </RadioGroup>
            <InputError message={errors.payment_method} className="mt-2" />
        </section>
    );
}

/** A transfer: the company bank it reached (chips), then the bank it came from, the day it arrived, who sent it and its reference. */
function CheckoutTransfer({ data, errors, referenceCheck, referenceStatus, senderBanks, senderIsSubscriber, setData, toggleSender, transferBanks }) {
    return (
        <section className="gl-co-section gl-co-transfer">
            <RadioGroup name="bank_name" isRequired value={data.bank_name || null} onChange={(value) => setData('bank_name', value)} className="gl-co-banks-group">
                <Label className="gl-co-h">البنك المستلم</Label>
                <div className="gl-co-banks">
                    {transferBanks.map((bank) => (
                        <Radio key={bank} value={bank} className="gl-co-bank">
                            <Radio.Content className="gl-co-bank-content">
                                <BankMark bank={bank} className="h-7 w-7 rounded-lg" />
                                <span>{bank}</span>
                                <Radio.Control className="sr-only"><Radio.Indicator /></Radio.Control>
                            </Radio.Content>
                        </Radio>
                    ))}
                </div>
            </RadioGroup>
            <InputError message={errors.bank_name} className="mt-2" />

            <div className="gl-co-grid">
                <div>
                    <label htmlFor="sender_bank_name" className="gl-label mb-2 block">البنك المرسل</label>
                    <BankDropdown banks={senderBanks} id="sender_bank_name" name="sender_bank_name" value={data.sender_bank_name} onChange={(value) => setData('sender_bank_name', value)} />
                    <InputError message={errors.sender_bank_name} className="mt-2" />
                </div>
                <BankReceivedDateField value={data.bank_received_on} onChange={(value) => setData('bank_received_on', value)} error={errors.bank_received_on} />

                <TextField name="sender_name" isRequired isReadOnly={senderIsSubscriber} value={data.sender_name} onChange={(value) => setData('sender_name', value)} className="gl-co-field">
                    <div className="gl-co-field-head">
                        <Label>اسم المحوِّل</Label>
                        <Switch size="sm" isSelected={senderIsSubscriber} onChange={toggleSender} className="gl-co-switch">
                            <Switch.Content>
                                <Switch.Control><Switch.Thumb /></Switch.Control>
                                <Label>المشترك نفسه</Label>
                            </Switch.Content>
                        </Switch>
                    </div>
                    <Input id="sender_name" placeholder="اسم صاحب الحساب الذي حُوّل منه المبلغ" />
                    <InputError message={errors.sender_name} className="mt-2" />
                </TextField>

                <TextField name="reference_number" value={data.reference_number} onChange={(value) => setData((current) => ({ ...current, reference_number: value, confirm_duplicate_reference: false }))} className="gl-co-field">
                    <Label>الرقم المرجعي</Label>
                    <Input id="reference_number" dir="ltr" autoComplete="off" placeholder="مثال: TRX-48213" className="gl-num" />
                    <InputError message={errors.reference_number} className="mt-2" />
                    {referenceCheck.processing && <p className="gl-co-hint">جارٍ التحقق من الرقم المرجعي...</p>}
                    {referenceStatus?.conflict && (
                        <div className="gl-notice mt-2 text-xs" style={{ '--gl-c': 'var(--gl-warn)' }}>
                            <p>
                                الرقم المرجعي مكرر: مسجَّل مسبقًا في{' '}
                                <a href={referenceStatus.conflict.url} className="underline">
                                    {referenceStatus.conflict.voucherNumber ? `السند ${referenceStatus.conflict.voucherNumber} — ` : 'دفعة '}
                                    {referenceStatus.conflict.subscriptionName}
                                </a>
                            </p>
                            <label className="mt-1.5 flex items-center gap-2">
                                <CheckBox checked={Boolean(data.confirm_duplicate_reference)} onChange={(e) => setData('confirm_duplicate_reference', e.target.checked)} />
                                أؤكد تسجيل الدفعة بالرقم نفسه
                            </label>
                        </div>
                    )}
                    {referenceStatus?.available && !referenceStatus.warning && <p className="gl-co-hint is-ok"><Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} /> الرقم المرجعي متاح.</p>}
                    {referenceStatus?.warning && (
                        <p className="gl-notice mt-2 text-xs" style={{ '--gl-c': 'var(--gl-warn)' }}>
                            تنبيه فقط: توجد دفعة اليوم بالمبلغ واسم المحوِّل نفسيهما —{' '}
                            <a href={referenceStatus.warning.url} className="underline">{referenceStatus.warning.voucherNumber ? `السند ${referenceStatus.warning.voucherNumber}` : 'الدفعة'}</a>
                        </p>
                    )}
                </TextField>
            </div>
        </section>
    );
}

/** Cash: the paper voucher's number, if one was written. */
function CheckoutCash({ data, errors, setData }) {
    return (
        <section className="gl-co-section">
            <TextField name="manual_voucher_number" value={data.manual_voucher_number} onChange={(value) => setData('manual_voucher_number', value)} className="gl-co-field">
                <div className="gl-co-field-head">
                    <Label>رقم السند اليدوي</Label>
                    <span className="gl-co-opt">رقم الوصل الورقي، اختياري</span>
                </div>
                <Input id="manual_voucher_number" dir="ltr" autoComplete="off" placeholder="مثال: 00412" className="gl-num" />
                <InputError message={errors.manual_voucher_number} className="mt-2" />
            </TextField>
        </section>
    );
}

/** A note kept with the payment, shown on the statement. */
function NotesField({ data, errors, setData }) {
    return (
        <section className="gl-co-section">
            <TextField name="notes" value={data.notes} onChange={(value) => setData('notes', value)} className="gl-co-field">
                <div className="gl-co-field-head">
                    <Label>ملاحظة</Label>
                    <span className="gl-co-opt">اختياري، تظهر في كشف الحساب</span>
                </div>
                <Input id="payment_notes" autoComplete="off" placeholder="أي تفصيل يُحفظ مع الدفعة" />
                <InputError message={errors.notes} className="mt-2" />
            </TextField>
        </section>
    );
}

/** One green button carrying the amount, and what happens after it. */
function CheckoutFooter({ currencyMark, data, form, inShekels, overpayment, referenceStatus, requestClose }) {
    const disabled =
        !(Number(data.amount) > 0) ||
        inShekels === null ||
        form.processing ||
        (Boolean(referenceStatus?.conflict) && !data.confirm_duplicate_reference) ||
        (overpayment === 'confirm' && !data.confirm_overpayment);

    return (
        <footer className="gl-co-foot">
            <p className="gl-co-foot-hint">
                <span className="kbd">Esc</span> إغلاق دون حفظ
                <span className="gl-co-foot-sep" aria-hidden="true" />
                <span className="kbd" dir="ltr">Ctrl ↵</span> تسجيل
            </p>
            <div className="gl-co-foot-row">
                <div className="gl-co-foot-sum" aria-live="polite">
                    <small>سيُسجَّل</small>
                    <b className="gl-num"><bdi>{formatMoney(Number(data.amount) > 0 ? data.amount : 0)}</bdi> {currencyMark}</b>
                </div>
                <Button variant="tertiary" size="lg" onPress={requestClose} isDisabled={form.processing} className="gl-co-cancel">
                    إلغاء
                </Button>
                <Button type="submit" size="lg" isDisabled={disabled} className="gl-co-pay">
                    <Icon name="check" className="h-5 w-5" strokeWidth={2.2} />
                    {form.processing ? 'جارٍ الحفظ...' : Number(data.amount) > 0 ? <>تسجيل <bdi className="gl-num">{formatMoney(data.amount)}</bdi> {currencyMark}</> : 'تسجيل الدفعة'}
                </Button>
            </div>
        </footer>
    );
}

/** The receipt this payment will print, filled in as the form is: the balance now, this payment, and the balance after. */
function ReceiptPreview({ subscription, balance, inShekels, methodText, owed }) {
    const brand = useBrand();
    const collector = usePage().props.auth?.user?.name;
    const paid = Number(inShekels) > 0 ? Number(inShekels) : 0;
    const before = describeBalance(balance);
    const after = describeBalance(Number(balance) - paid);
    const coverage = owed > 0 ? Math.min(100, Math.round((paid / owed) * 100)) : null;
    const today = new Date().toLocaleDateString('en-GB');

    return (
        <div className="gl-co-paper">
            <header className="gl-co-paper-brand">
                <BrandLogo alt="" className="h-9 w-auto max-w-[70px] object-contain" />
                <span className="min-w-0">
                    <b>{brand.name}</b>
                    {brand.tagline && <small>{brand.tagline}</small>}
                </span>
            </header>
            <div className="gl-co-paper-line">
                <b>وصل قبض</b>
                <span className="gl-num">{today}</span>
            </div>
            <div className="gl-co-paper-who">
                <b>{subscription.fullName}</b>
                <small>
                    حساب <bdi className="gl-num">{subscription.accountNumber}</bdi>
                    {subscription.meterBoxNumber && `، طبلون ${subscription.meterBoxNumber}`}
                </small>
            </div>
            <dl className="gl-co-paper-rows">
                <div><dt>الرصيد الحالي</dt><dd className="gl-num">{balanceText(before)}</dd></div>
                <div><dt>هذه الدفعة <small>{methodText}</small></dt><dd className="gl-num is-pay">− {formatMoney(paid)} ₪</dd></div>
            </dl>
            <div className="gl-co-paper-after">
                <span>الرصيد بعدها</span>
                <b className="gl-num" data-tone={after.tone}>{after.tone === 'settled' ? 'مسدّد ✓' : balanceText(after)}</b>
            </div>
            {coverage !== null && (
                <div className="gl-co-paper-cover">
                    <div><span>تغطية المستحق</span><b className="gl-num">{coverage}%</b></div>
                    <i aria-hidden="true"><span style={{ width: `${coverage}%` }} /></i>
                </div>
            )}
            <i className="gl-co-paper-code" aria-hidden="true" />
            {(collector || subscription.branchName) && (
                <p className="gl-co-paper-foot">
                    {collector && <span>المحصّل: {collector}</span>}
                    {subscription.branchName && <span>{subscription.branchName}</span>}
                </p>
            )}
        </div>
    );
}
