import Icon from '@/Components/Icon';
import BrandLogo from '@/Components/BrandLogo';
import { SuperPowerWordmark } from '@/Components/SuperPowerMark';
import { useBrand } from '@/hooks/useBrand';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { describeBalance } from '@/lib/accountStatement';
import { formatClock, formatMoney } from '@/lib/format';
import InputError from '@/Components/InputError';
import Switch from '@/Components/Switch';
import { BankReceivedDateField } from '@/Components/BankReceivedDate';
import { BankDropdown, BankRow } from '@/Components/Banks';
import { balanceText, FieldLabel } from './AccountFormParts';

export const inputClass = 'block h-[46px] w-full px-4 text-base';

/** One way of paying, as the prototype's choice tile (a radio). */
export function MethodTile({ value, checked, onChange, icon, title, hint }) {
    return (
        <label className="gl-method" data-checked={checked || undefined}>
            <input type="radio" name="payment_method" value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
            <span className="gl-method-icon">
                <Icon name={icon} className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
                <b className="block text-[15px]">{title}</b>
                <small className="gl-sub block !m-0 !text-[12.5px]">{hint}</small>
            </span>
            <span className="gl-method-dot" aria-hidden="true" />
        </label>
    );
}

/**
 * The receipt beside the form, as the prototype's preview: the receipt as
 * it will print (the product's mark, the amount, the balance before and
 * after), updating with every figure typed, before saving.
 */
export function PaymentSummary({ amount, currency, inShekels, balance, methodText, collector }) {
    const before = describeBalance(balance);
    const after = inShekels === null ? null : describeBalance(Number(balance) - inShekels);
    const owed = Number(balance) > 0 ? Number(balance) : 0;
    const coverage = owed > 0 && inShekels !== null ? Math.min(100, Math.round((inShekels / owed) * 100)) : 0;
    const now = new Date();
    const brand = useBrand();
    const afterColor = after ? { owes: 'var(--gl-bad)', credit: 'var(--gl-ok)', settled: 'var(--gl-ink)' }[after.tone] : 'var(--gl-faint)';

    return (
        <aside aria-live="polite" className="gl-pay-side flex flex-col gap-4 p-5 sm:p-6 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:overflow-y-auto">
            <div className="flex items-center gap-2">
                <h4 className="text-base font-bold" style={{ fontFamily: 'var(--gl-head)' }}>معاينة الوصل</h4>
                <span className="gl-pill gl-info ms-auto">قبل الحفظ</span>
            </div>

            <div className="gl-receipt gl-receipt-cut">
                <div className="flex items-center justify-between gap-3">
                    <span className="gl-lockup">
                        <BrandLogo markSize={28} className="h-7 w-auto" />
                        <span className="gl-lockup-name">
                            <b dir="auto">{brand.shortName ?? brand.name}</b>
                            {brand.animatedLogo ? <SuperPowerWordmark height={8} className="gl-lockup-wordmark" label={brand.nameEnglish ?? 'Super Power'} /> : brand.nameEnglish && <small dir="ltr">{brand.nameEnglish.toUpperCase()}</small>}
                        </span>
                    </span>
                    <Icon name="receipt" className="h-[18px] w-[18px]" />
                </div>
                <div className="gl-receipt-line" />
                <div>
                    <span className="gl-sub !m-0">المبلغ المستلم</span>
                    <p className="gl-big gl-num text-end" dir="ltr">
                        {formatMoney(amount || 0)}
                        <span className="ms-1.5 text-lg font-semibold" style={{ color: 'var(--gl-muted)' }}>{currency === 'ILS' ? '₪' : currency}</span>
                    </p>
                </div>
                <div className="gl-kv"><span>الرصيد الحالي</span><b className="gl-num">{balanceText(before)}</b></div>
                <div className="gl-kv"><span>هذه الدفعة</span><b className="gl-num" dir="ltr">{formatMoney(inShekels ?? 0)} ₪</b></div>
                <div className="gl-receipt-line" />
                <div className="gl-kv"><span>الرصيد بعد الدفعة</span><b className="gl-num text-base" style={{ color: afterColor }}>{after ? balanceText(after) : '—'}</b></div>
            </div>

            {owed > 0 && (
                <div>
                    <div className="gl-kv mb-1.5"><span>تغطية المبلغ المستحق</span><b className="gl-num">{coverage}%</b></div>
                    <div className="gl-bar" aria-hidden="true"><i style={{ width: `${coverage}%` }} /></div>
                </div>
            )}

            <div className="hidden gap-2 lg:grid">
                <div className="gl-kv"><span>الطريقة</span><b>{methodText}</b></div>
                <div className="gl-kv"><span>المحصّل</span><b>{collector}</b></div>
                <div className="gl-kv"><span>الوقت</span><b className="gl-num">اليوم، {formatClock(`${now.getHours()}:${now.getMinutes()}`)}</b></div>
            </div>
            <p className="gl-sub !mt-auto text-center">الدفعة تُرتجع ولا تُحذف، وتبقى في السجل المالي.</p>
        </aside>
    );
}

/** After saving: what was recorded, the voucher it got and the balance it left, with its receipt to print. */
export function PaymentReceipt({ receipt, subscriptionName, title, onAnother, onDone }) {
    const after = describeBalance(receipt.balanceAfter);
    const rows = [
        ['رقم السند', receipt.voucherNumber ?? '—'],
        ['المبلغ', `${formatMoney(receipt.amount)} ${receipt.currency === 'ILS' ? '₪' : receipt.currency}`],
        ...(receipt.currency !== 'ILS' ? [['القيمة بالشيكل', `${formatMoney(receipt.inShekels)} ₪`]] : []),
        ['الطريقة', receipt.methodText],
        ['الرصيد بعد الدفعة', balanceText(after)],
    ];

    return (
        <div className="px-6 pb-8 pt-10 text-center sm:px-8">
            <span className="gl-tone mx-auto mb-3.5 flex h-[76px] w-[76px] items-center justify-center rounded-3xl" style={{ '--gl-c': 'var(--gl-ok)' }}>
                <Icon name="check" className="h-10 w-10" strokeWidth={2.2} />
            </span>
            <h3 className="text-[24px] font-extrabold" style={{ fontFamily: 'var(--gl-head)' }}>{title}</h3>
            <p className="gl-sub mt-1.5 !text-sm">
                {formatMoney(receipt.currency === 'ILS' ? receipt.amount : receipt.inShekels)} شيكل من {subscriptionName} · الرصيد الجديد {balanceText(after)}
            </p>
            <dl className="gl-receipt gl-receipt-cut mx-auto mt-6 w-full max-w-[420px] text-start">
                {rows.map(([label, value]) => (
                    <div key={label} className="gl-kv">
                        <dt>{label}</dt>
                        <dd className="gl-num font-semibold" style={{ color: 'var(--gl-ink)' }}>{value}</dd>
                    </div>
                ))}
            </dl>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                {receipt.receiptUrl && (
                    <SecondaryButton
                        onClick={() => window.open(receipt.receiptUrl, '_blank')}
                        title="يُفتح سند القبض في نافذة جديدة جاهزًا للطباعة"
                        className="tone-print h-12 rounded-[14px] px-5 text-[15.5px]"
                    >
                        <Icon name="printer" className="h-[18px] w-[18px]" />
                        طباعة السند
                    </SecondaryButton>
                )}
                {onAnother && (
                    <SecondaryButton onClick={onAnother} className="h-12 rounded-[14px] px-5 text-[15.5px]">
                        <Icon name="plus" className="h-[18px] w-[18px]" strokeWidth={2} />
                        دفعة جديدة
                    </SecondaryButton>
                )}
                <PrimaryButton type="button" onClick={onDone} autoFocus className="h-12 min-w-28 rounded-[14px] px-5 text-[15.5px]">
                    تم
                </PrimaryButton>
            </div>
        </div>
    );
}

/**
 * A transfer's details: the company bank it reached, the bank it came from
 * and the day it arrived, who sent it (the subscriber unless switched off)
 * and its reference, with what the reference check found.
 */
export function TransferFields({ data, setData, errors, transferBanks, senderBanks, senderIsSubscriber, onSenderToggle, checkingReference, referenceStatus }) {
    return (
        <div className="animate-menu gl-receipt mt-3 grid gap-4 !border-solid p-4">
            <fieldset>
                <legend className="mb-2 text-[14.5px] font-semibold text-gray-700">
                    البنك المستلم <span className="text-brand-600">*</span>
                </legend>
                <div className="grid gap-2">
                    {transferBanks.map((bank) => (
                        <BankRow
                            key={bank}
                            bank={bank}
                            checked={data.bank_name === bank}
                            name="bank_name"
                            onChange={(value) => setData('bank_name', value)}
                            required
                        />
                    ))}
                </div>
                <InputError message={errors.bank_name} className="mt-2" />
            </fieldset>

            <div>
                <FieldLabel htmlFor="sender_bank_name">
                    البنك المرسل
                </FieldLabel>
                <BankDropdown
                    banks={senderBanks}
                    id="sender_bank_name"
                    name="sender_bank_name"
                    value={data.sender_bank_name}
                    onChange={(value) => setData('sender_bank_name', value)}
                />
                <InputError message={errors.sender_bank_name} className="mt-2" />
            </div>
            <BankReceivedDateField value={data.bank_received_on} onChange={(value) => setData('bank_received_on', value)} error={errors.bank_received_on} />

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <div className="mb-2 flex items-center justify-between gap-2.5">
                        <label htmlFor="sender_name" className="text-[14.5px] font-semibold text-gray-700">
                            اسم المحوِّل <span className="text-brand-600">*</span>
                        </label>
                        <Switch
                            checked={senderIsSubscriber}
                            onChange={onSenderToggle}
                            label={<span className="text-[13.5px] font-medium text-gray-600">المشترك نفسه</span>}
                            ariaLabel="المحوِّل هو المشترك نفسه"
                        />
                    </div>
                    <input
                        id="sender_name"
                        name="sender_name"
                        required
                        readOnly={senderIsSubscriber}
                        placeholder="اسم صاحب الحساب الذي حُوّل منه المبلغ"
                        value={data.sender_name}
                        onChange={(e) => setData('sender_name', e.target.value)}
                        className={inputClass}
                    />
                    <InputError message={errors.sender_name} className="mt-2" />
                </div>
                <div>
                    <FieldLabel htmlFor="reference_number" hint="من إشعار الحوالة">
                        الرقم المرجعي
                    </FieldLabel>
                    <input
                        id="reference_number"
                        name="reference_number"
                        dir="ltr"
                        autoComplete="off"
                        placeholder="مثال: TRX-48213"
                        value={data.reference_number}
                        onChange={(e) => setData((current) => ({ ...current, reference_number: e.target.value, confirm_duplicate_reference: false }))}
                        className={`${inputClass} text-end font-display placeholder:font-sans placeholder:font-normal`}
                    />
                    <InputError message={errors.reference_number} className="mt-2" />
                    {checkingReference && <p className="mt-2 text-xs text-gray-500">جارٍ التحقق من الرقم المرجعي...</p>}
                    {referenceStatus?.conflict && (
                        <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-800">
                            <p>
                                الرقم المرجعي مكرر: مسجَّل مسبقًا في{' '}
                                <a href={referenceStatus.conflict.url} className="underline">
                                    {referenceStatus.conflict.voucherNumber
                                        ? `السند ${referenceStatus.conflict.voucherNumber} — `
                                        : 'دفعة '}
                                    {referenceStatus.conflict.subscriptionName}
                                </a>
                            </p>
                            <label className="mt-1.5 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={Boolean(data.confirm_duplicate_reference)}
                                    onChange={(e) => setData('confirm_duplicate_reference', e.target.checked)}
                                />
                                أؤكد تسجيل الدفعة بالرقم نفسه
                            </label>
                        </div>
                    )}
                    {referenceStatus?.available && !referenceStatus.warning && (
                        <p className="mt-2 text-xs font-medium text-emerald-600">الرقم المرجعي متاح.</p>
                    )}
                    {referenceStatus?.warning && (
                        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-800">
                            تنبيه فقط: توجد دفعة اليوم بالمبلغ واسم المحوِّل نفسيهما —{' '}
                            <a href={referenceStatus.warning.url} className="underline">
                                {referenceStatus.warning.voucherNumber ? `السند ${referenceStatus.warning.voucherNumber}` : 'الدفعة'}
                            </a>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
