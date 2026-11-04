import { useId, useRef, useState } from 'react';
import ConfirmDialog from '@/Components/ConfirmDialog';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { useResourceForm } from '@/hooks/useResourceForm';
import { describeBalance } from '@/lib/accountStatement';
import { formatMoney, normalizeDecimalInput } from '@/lib/format';
import { clearErrorOnInput, submitOnCtrlEnter, validateFormFields } from '@/lib/formValidation';
import {
    AmountBox,
    balanceCells,
    balanceText,
    DoneScreen,
    FieldWarning,
    FormFooter,
    FormHeader,
    FormStep,
    MovementCard,
    MOVEMENT_TONES,
    QuickPick,
    SheetBody,
    SHEET_FORM_CLASS,
} from './AccountFormParts';
import { CorrectionReasonFields, EMPTY_CORRECTION, OriginalLine } from './CorrectionFields';
import { inputClass } from './PaymentModal';

const QUICK_AMOUNTS = [50, 100, 200];

/** A clearing above this many shekels asks the user to double-check it. */
const LARGE_CLEARING = 500;

const notesClass =
    'block min-h-[76px] w-full resize-y rounded-[14px] border-[1.5px] border-gray-200 bg-surface px-4 py-3 text-base leading-relaxed text-gray-900 transition placeholder:text-gray-400 hover:border-brand-500/45 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15';

/**
 * Record a clearing (مقاصة): a service for a service. The subscription gets
 * electricity and gives the company a service in return — the service's
 * value comes off what they owe, like a payment made in work instead of
 * money; more than they owe leaves them in credit and is saved only once
 * confirmed. The service must be named; it shows
 * on the statement. The movement card under the title shows the balance
 * it leaves; once saved, the window shows what was recorded. Keys: Ctrl +
 * Enter saves.
 *
 * With `correcting` (a statement line), it corrects that clearing instead:
 * the form starts from it, `balance` leaves it out, and saving cancels it
 * and records this one in its place, with one of `correctionReasons`.
 */
export default function ClearingModal({ show, onClose, subscription, balance, correcting = null, correctionReasons = [] }) {
    const titleId = useId();
    const amountInput = useRef(null);
    const form = useResourceForm(
        correcting ? `/subscriptions/${subscription.id}/transactions` : `/subscriptions/${subscription.id}/clearings`,
        correcting,
        correcting
            ? { amount: correcting.recorded.amount, notes: correcting.recorded.notes, manual_voucher_number: correcting.recorded.manual_voucher_number ?? '', confirm_over_balance: false, ...EMPTY_CORRECTION }
            : { amount: '', notes: '', manual_voucher_number: '', confirm_over_balance: false },
    );
    const { data, setData, errors } = form;
    const [discarding, setDiscarding] = useState(false);
    const [confirmingSave, setConfirmingSave] = useState(false);
    const [receipt, setReceipt] = useState(null);

    const owed = Math.max(Number(balance), 0);
    const amount = Number(data.amount) > 0 ? Number(data.amount) : 0;
    const missingService = !data.notes.trim();

    // Worth more than what is owed (even when nothing is owed), it leaves the subscription in credit: allowed once confirmed.
    const overBalance = amount > owed;
    const creditLeft = overBalance ? Math.round((amount - Number(balance)) * 100) / 100 : 0;
    const balanceAfter = amount > 0 ? Number(balance) - amount : null;
    const tone = correcting ? 'correction' : 'credit';

    function close() {
        setDiscarding(false);
        setReceipt(null);
        form.resetAndClearErrors();
        onClose();
    }

    function requestClose() {
        if (!receipt && form.isDirty) {
            setDiscarding(true);
        } else {
            close();
        }
    }

    function setAmount(value) {
        setData('amount', value);
        form.clearErrors('amount');
        amountInput.current?.focus();
    }

    function submit(event) {
        event.preventDefault();

        if (!validateFormFields(event.currentTarget, form) || (overBalance && !data.confirm_over_balance)) {
            return;
        }

        setConfirmingSave(true);
    }

    function save() {
        setConfirmingSave(false);

        const recorded = { amount, service: data.notes.trim(), balanceAfter };

        form.save({
            preserveScroll: true,
            onSuccess: (page) => {
                const flashed = page.flash?.recordedClearing ?? {};

                setReceipt({ ...recorded, voucherNumber: flashed.voucherNumber ?? null, receiptUrl: flashed.receiptUrl ?? null });
                form.resetAndClearErrors();
            },
        });
    }

    return (
        <>
            <Modal show={show} onClose={requestClose} maxWidth="3xl">
                {receipt ? (
                    <DoneScreen
                        tone={correcting ? 'amber' : 'green'}
                        title={correcting ? 'صُحّحت المقاصة' : 'سُجّلت المقاصة'}
                        text={`نزل ${formatMoney(receipt.amount)} ₪ من حساب ${subscription.fullName} مقابل خدمته للشركة.`}
                        rows={[
                            ...(receipt.voucherNumber ? [['رقم السند', receipt.voucherNumber]] : []),
                            ['الخدمة', receipt.service],
                            ['قيمة المقاصة', `${formatMoney(receipt.amount)} ₪`],
                            ['الرصيد بعد', balanceText(describeBalance(receipt.balanceAfter))],
                        ]}
                        printUrl={receipt.receiptUrl}
                        anotherLabel="مقاصة أخرى"
                        onAnother={correcting ? null : () => setReceipt(null)}
                        onDone={close}
                    />
                ) : (
                    <form
                        noValidate
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        onSubmit={submit}
                        onInput={(e) => clearErrorOnInput(e, form)}
                        onKeyDown={submitOnCtrlEnter}
                        className={SHEET_FORM_CLASS}
                        style={{ '--gl-t': MOVEMENT_TONES[tone] }}
                    >
                        <FormHeader
                            titleId={titleId}
                            icon={correcting ? 'repeat' : 'scale'}
                            tone={correcting ? 'amber' : 'green'}
                            title={correcting ? 'تصحيح مقاصة' : 'مقاصة'}
                            subtitle={
                                correcting
                                    ? 'صحّح المقاصة؛ تبقى الأصلية في الكشف ملغاة مع سبب التصحيح.'
                                    : 'خدمة مقابل خدمة: المشترك يأخذ الكهرباء ويقدّم للشركة خدمة، فتُنزَّل قيمتها من حسابه.'
                            }
                            onClose={requestClose}
                        />

                        <MovementCard
                            subscription={subscription}
                            tone={tone}
                            tag="خدمة مقابل خدمة"
                            ops={['−', '=']}
                            cells={balanceCells({
                                balance,
                                balanceLabel: correcting ? 'الرصيد بدون الأصلية' : 'الرصيد الحالي',
                                amount: amount > 0 ? amount : null,
                                sign: -1,
                                moveLabel: 'المقاصة',
                                moveNote: data.notes.trim().slice(0, 40),
                            })}
                        />

                        <SheetBody>
                                {correcting && <OriginalLine entry={correcting} />}

                                <FormStep number={1} title="الخدمة التي قدّمها المشترك" hint="تظهر في كشف الحساب" done={!missingService}>
                                <div>
                                    <label htmlFor="clearing_service" className="sr-only">الخدمة التي قدّمها المشترك للشركة</label>
                                    <textarea
                                        id="clearing_service"
                                        name="notes"
                                        rows={2}
                                        required
                                        autoFocus
                                        maxLength={1000}
                                        placeholder="مثال: صيانة المولد في شهر 9"
                                        value={data.notes}
                                        onChange={(e) => setData('notes', e.target.value)}
                                        className={notesClass}
                                    />
                                    <InputError message={errors.notes} className="mt-2" />
                                </div>
                                </FormStep>

                                <FormStep number={2} title="قيمة الخدمة" done={amount > 0}>
                                <div>
                                    <AmountBox
                                        id="amount"
                                        inputRef={amountInput}
                                        value={data.amount}
                                        onChange={(e) => setData((current) => ({ ...current, amount: normalizeDecimalInput(e.target.value), confirm_over_balance: false }))}
                                        unit="₪"
                                        placeholder="0.00"
                                        label="قيمة المقاصة"
                                        error={Boolean(errors.amount)}
                                    >
                                        {QUICK_AMOUNTS.map((quick) => (
                                            <QuickPick key={quick} onClick={() => setAmount(String(quick))}>
                                                {quick} ₪
                                            </QuickPick>
                                        ))}
                                        {owed > 0 && (
                                            <QuickPick tone="green" onClick={() => setAmount(String(owed))}>
                                                كل ما عليه
                                            </QuickPick>
                                        )}
                                    </AmountBox>
                                    <InputError message={errors.amount} className="mt-2" />
                                    {overBalance && (
                                        <div role="alert" className="mt-2.5 rounded-[14px] border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[13.5px] leading-relaxed text-amber-900 dark:text-amber-200">
                                            <p>
                                                {owed > 0 ? `قيمة المقاصة أكبر من الرصيد المستحق (${formatMoney(owed)} ₪)` : 'لا يوجد رصيد مستحق على هذا المشترك'}، فيصبح له رصيد لصالحه قدره{' '}
                                                <b className="font-display">{formatMoney(creditLeft)} ₪</b>.
                                            </p>
                                            <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
                                                <input type="checkbox" checked={Boolean(data.confirm_over_balance)} onChange={(e) => setData('confirm_over_balance', e.target.checked)} className="rounded border-gray-300 text-emerald-600" />
                                                نعم، أريد فعلًا إضافة هذه المقاصة لهذا المشترك
                                            </label>
                                            <InputError message={errors.confirm_over_balance} className="mt-1" />
                                        </div>
                                    )}
                                    {amount > LARGE_CLEARING && !overBalance && (
                                        <FieldWarning>مبلغ كبير. تأكد أنه صحيح قبل الحفظ، فهو يظهر في كشف حساب المشترك.</FieldWarning>
                                    )}
                                </div>
                                </FormStep>

                                <FormStep number={3} title="رقم السند اليدوي" hint="اختياري: رقم السند الورقي إن وُجد" done={Boolean(data.manual_voucher_number.trim())}>
                                <div>
                                    <label htmlFor="clearing_manual_voucher_number" className="sr-only">رقم السند اليدوي</label>
                                    <input
                                        id="clearing_manual_voucher_number"
                                        name="manual_voucher_number"
                                        dir="ltr"
                                        autoComplete="off"
                                        maxLength={50}
                                        placeholder="مثال: 00412"
                                        value={data.manual_voucher_number}
                                        onChange={(e) => setData('manual_voucher_number', e.target.value)}
                                        className={`${inputClass} text-end font-display placeholder:font-sans placeholder:font-normal`}
                                    />
                                    <InputError message={errors.manual_voucher_number} className="mt-2" />
                                </div>
                                </FormStep>

                                {correcting && (
                                    <FormStep number={4} title="سبب التصحيح">
                                        <CorrectionReasonFields form={form} reasons={correctionReasons} />
                                    </FormStep>
                                )}
                        </SheetBody>

                        <FormFooter
                            onCancel={requestClose}
                            tone={correcting ? 'amber' : 'green'}
                            disabled={amount <= 0 || missingService || (overBalance && !data.confirm_over_balance)}
                            processing={form.processing}
                            submitLabel={correcting ? 'حفظ التصحيح' : amount > 0 ? `مقاصة ${formatMoney(amount)} ₪ من الحساب` : 'تسجيل المقاصة'}
                        />
                    </form>
                )}
            </Modal>

            <ConfirmDialog
                show={show && discarding}
                onConfirm={close}
                onCancel={() => setDiscarding(false)}
                title="تجاهل المقاصة؟"
                message="أدخلت بيانات لم تُحفظ بعد. إذا أغلقت النافذة الآن فستفقدها."
                confirmLabel="تجاهل المقاصة"
                cancelLabel="البقاء ومتابعة الإدخال"
                icon="alert"
                tone="danger"
            />

            <ConfirmDialog
                show={show && confirmingSave}
                onConfirm={save}
                onCancel={() => setConfirmingSave(false)}
                title={correcting ? 'تأكيد حفظ التصحيح؟' : 'تأكيد تسجيل المقاصة؟'}
                message={`${correcting ? 'ستُصحَّح المقاصة إلى' : 'سينزل'} ${formatMoney(amount)} ₪ من حساب ${subscription.fullName}${correcting ? '' : ' مقابل خدمته للشركة'}. هل تريد المتابعة؟`}
                confirmLabel={correcting ? 'نعم، احفظ التصحيح' : 'نعم، سجّل المقاصة'}
                cancelLabel="رجوع للمراجعة"
                icon="check"
            />
        </>
    );
}
