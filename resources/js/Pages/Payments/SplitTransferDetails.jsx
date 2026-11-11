import { BankReceivedDateField } from '@/Components/BankReceivedDate';
import Icon from '@/Components/Icon';
import InputError from '@/Components/InputError';
import { FieldLabel } from '@/Pages/Subscriptions/AccountFormParts';
import { BankDropdown, BankRow } from '@/Components/Banks';
import { inputClass } from '@/Pages/Subscriptions/PaymentModal';

/** The bank transfer itself: amount, currency, bank, reference, sender and arrival date, with the duplicate-reference warning. */
export default function SplitTransferDetails({
    currentStatus,
    data,
    duplicateReference,
    errors,
    form,
    referenceCheck,
    senderBanks,
    setData,
    transferBanks,
}) {
    return (
        <div className="grid gap-4 rounded-[20px] border border-gray-100 bg-gray-50 p-4">
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
                        />
                    ))}
                </div>
                <InputError message={errors.bank_name} className="mt-2" />
            </fieldset>

            <div>
                <FieldLabel htmlFor="sender_bank_name">البنك المرسل</FieldLabel>
                <BankDropdown
                    banks={senderBanks}
                    id="sender_bank_name"
                    name="sender_bank_name"
                    value={data.sender_bank_name}
                    onChange={(value) => setData('sender_bank_name', value)}
                />
                <InputError message={errors.sender_bank_name} className="mt-2" />
            </div>
            <BankReceivedDateField
                value={data.bank_received_on}
                onChange={(value) => setData('bank_received_on', value)}
                error={errors.bank_received_on}
            />

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <FieldLabel htmlFor="split_sender" required>
                        اسم المحوِّل
                    </FieldLabel>
                    <input
                        id="split_sender"
                        maxLength={255}
                        placeholder="اسم صاحب الحساب الذي حُوّل منه المبلغ"
                        value={data.sender_name}
                        onChange={(event) => setData('sender_name', event.target.value)}
                        className={inputClass}
                    />
                    <InputError message={errors.sender_name} className="mt-2" />
                </div>
                <div>
                    <FieldLabel htmlFor="split_reference" required hint="من إشعار الحوالة">
                        الرقم المرجعي
                    </FieldLabel>
                    <input
                        id="split_reference"
                        dir="ltr"
                        autoComplete="off"
                        maxLength={100}
                        placeholder="مثال: TRX-48213"
                        value={data.reference_number}
                        onChange={(event) => {
                            setData((current) => ({ ...current, reference_number: event.target.value, confirm_duplicate_reference: false }));
                            form.clearErrors('reference_number');
                        }}
                        className={`${inputClass} text-end font-display placeholder:font-sans placeholder:font-normal`}
                    />
                    <InputError message={currentStatus?.conflict ? null : errors.reference_number} className="mt-2" />
                    {referenceCheck.processing && <p className="mt-2 text-xs text-gray-500">جارٍ التحقق من الرقم المرجعي...</p>}
                    {currentStatus?.available && !referenceCheck.processing && (
                        <p className="mt-2 text-xs font-medium text-emerald-600">الرقم المرجعي متاح.</p>
                    )}
                </div>
            </div>

            {duplicateReference && (
                <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-gray-900">
                    <p className="mb-2 font-medium text-amber-900 dark:text-amber-200">
                        الرقم المرجعي مكرر: مسجَّل مسبقًا
                        {currentStatus?.conflict ? (
                            <>
                                {' في '}
                                <a href={currentStatus.conflict.url} className="underline">
                                    {currentStatus.conflict.voucherNumber ? `السند ${currentStatus.conflict.voucherNumber} — ` : 'دفعة '}
                                    {currentStatus.conflict.subscriptionName}
                                </a>
                            </>
                        ) : (
                            ' على دفعة أخرى'
                        )}
                        . يمكنك المتابعة بعد التأكيد.
                    </p>
                    <label className="flex cursor-pointer items-center gap-2 font-semibold">
                        <input
                            type="checkbox"
                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            checked={data.confirm_duplicate_reference}
                            onChange={(event) => setData('confirm_duplicate_reference', event.target.checked)}
                        />
                        أؤكد أن هذا الرقم المرجعي مسجَّل على دفعة أخرى وأريد المتابعة
                    </label>
                </div>
            )}

            <p className="flex items-center gap-2 text-[13.5px] text-gray-500">
                <Icon name="info" className="h-4 w-4 shrink-0" />
                تُكتب بيانات التحويل مرة واحدة، وتُحفظ كما هي على دفعة كل مشترك.
            </p>
        </div>
    );
}
