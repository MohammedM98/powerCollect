import { Input } from '@heroui/react';
import Icon from '@/Components/Icon';
import { describeBalance } from '@/lib/accountStatement';
import { formatMoney } from '@/lib/format';
import InputError from '@/Components/InputError';
import { BankReceivedDateField } from '@/Components/BankReceivedDate';
import { BankChips, BankDropdown } from '@/Components/Banks';
import { balanceText, FieldLabel } from './AccountFormParts';
import { CheckBox, PrimaryKey, SecondaryKey, Switch } from '@/Components/UI';

export const inputClass = 'block h-[46px] w-full px-4 text-base';

/** A payment method's face inside its choice (RadioCards in PaymentMethodStep): its icon, name and line, and the dot that marks the chosen one. */
export function MethodTile({ icon, title, hint }) {
    return (
        <>
            <span className="gl-method-icon">
                <Icon name={icon} className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
                <b className="block text-[15px]">{title}</b>
                <small className="gl-sub block m-0! text-[12.5px]!">{hint}</small>
            </span>
            <span className="gl-method-dot" aria-hidden="true" />
        </>
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
        <div className="px-6 pb-8 pt-8 text-center sm:px-8">
            <span className="gl-tone mx-auto mb-3 flex h-[76px] w-[76px] items-center justify-center rounded-3xl" style={{ '--gl-c': 'var(--gl-ok)' }}>
                <Icon name="check" className="h-10 w-10" strokeWidth={2.2} />
            </span>
            <h3 className="text-[24px] font-extrabold font-(family-name:--gl-head)!">{title}</h3>
            <p className="gl-sub mt-2 text-sm!">
                {formatMoney(receipt.currency === 'ILS' ? receipt.amount : receipt.inShekels)} شيكل من {subscriptionName}، الرصيد الجديد {balanceText(after)}
            </p>
            <dl className="gl-receipt gl-receipt-cut mx-auto mt-6 w-full max-w-[420px] text-start">
                {rows.map(([label, value]) => (
                    <div key={label} className="gl-kv">
                        <dt>{label}</dt>
                        <dd className="gl-num font-semibold text-(--gl-ink)!">{value}</dd>
                    </div>
                ))}
            </dl>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                {receipt.receiptUrl && (
                    <SecondaryKey
                        onClick={() => window.open(receipt.receiptUrl, '_blank')}
                        title="يُفتح سند القبض في نافذة جديدة جاهزًا للطباعة"
                        className="tone-print h-12 rounded-[14px] px-4 text-[15.5px]"
                    >
                        <Icon name="printer" className="h-[18px] w-[18px]" />
                        طباعة السند
                    </SecondaryKey>
                )}
                {onAnother && (
                    <SecondaryKey onClick={onAnother} className="h-12 rounded-[14px] px-4 text-[15.5px]">
                        <Icon name="plus" className="h-[18px] w-[18px]" strokeWidth={2} />
                        دفعة جديدة
                    </SecondaryKey>
                )}
                <PrimaryKey type="button" onClick={onDone} autoFocus className="h-12 min-w-28 rounded-[14px] px-4 text-[15.5px]">
                    تم
                </PrimaryKey>
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
        <div className="animate-menu gl-receipt mt-3 grid gap-4 border-solid! p-4">
            <div>
                <p className="gl-label mb-2">البنك المستلم <span className="text-brand-600">*</span></p>
                <BankChips banks={transferBanks} name="bank_name" label="البنك المستلم" isRequired value={data.bank_name} onChange={(value) => setData('bank_name', value)} />
                <InputError message={errors.bank_name} className="mt-2" />
            </div>

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
                    <div className="mb-2 flex items-center justify-between gap-3">
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
                    <Input
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
                    <Input
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
                            <label className="mt-2 flex items-center gap-2">
                                <CheckBox
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
