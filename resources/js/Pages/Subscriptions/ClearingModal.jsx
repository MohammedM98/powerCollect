import { Button, Input } from '@heroui/react';
import { useId, useRef, useState } from 'react';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { useResourceForm } from '@/hooks/useResourceForm';
import { describeBalance } from '@/lib/accountStatement';
import { formatMoney, normalizeDecimalInput } from '@/lib/format';
import { clearErrorOnInput, submitOnCtrlEnter, validateFormFields } from '@/lib/formValidation';
import {
    balanceText,
    DoneScreen,
    FieldWarning,
    FormHeader,
    FormStep,
    movementStyle,
    SheetBody,
    SHEET_FORM_CLASS,
} from './AccountFormParts';
import { CorrectionReasonFields, EMPTY_CORRECTION, OriginalLine } from './CorrectionFields';
import LedgerLine, { LedgerFooter, recentStatementLines } from './LedgerLine';
import { CheckBox, ConfirmDialog } from '@/Components/UI';

const QUICK_AMOUNTS = [50, 100, 200];

/** A clearing above this many shekels asks the user to double-check it. */
const LARGE_CLEARING = 500;

/**
 * Record a clearing (مقاصة): a service for a service. The subscription gets
 * electricity and gives the company a service in return — the service's
 * value comes off what they owe, like a payment made in work instead of
 * money; more than they owe leaves them in credit and is saved only once
 * confirmed. The service must be named; it shows
 * on the statement. It is written as the statement's next line, under the
 * account's last lines (`recentLines`), with the balance it leaves; once saved, the window shows what was recorded. Keys: Ctrl +
 * Enter saves.
 *
 * With `correcting` (a statement line), it corrects that clearing instead:
 * the form starts from it, `balance` leaves it out, and saving cancels it
 * and records this one in its place, with one of `correctionReasons`.
 */
export default function ClearingModal({ show, onClose, subscription, balance, recentLines = [], correcting = null, correctionReasons = [] }) {
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
    const tone = correcting ? 'correction' : 'clearing';

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
            <Modal show={show} onClose={requestClose} maxWidth="5xl">
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
                        data-ledger-tone={correcting ? 'correction' : 'clearing'}
                        style={movementStyle(tone)}
                    >
                        <FormHeader
                            titleId={titleId}
                            icon={correcting ? 'repeat' : 'scale'}
                            tone={correcting ? 'amber' : 'clearing'}
                            title={correcting ? 'تصحيح مقاصة' : 'مقاصة'}
                            subtitle={
                                correcting
                                    ? 'صحّح المقاصة؛ تبقى الأصلية في الكشف ملغاة مع سبب التصحيح.'
                                    : `${[subscription.fullName, subscription.accountNumber && `حساب ${subscription.accountNumber}`].filter(Boolean).join('، ')}، خدمة مقابل خدمة تُنزَّل قيمتها من حسابه`
                            }
                            onClose={requestClose}
                        />

                        <SheetBody>
                            {correcting && <OriginalLine entry={correcting} />}

                            <div>
                                <LedgerLine
                                    tone={correcting ? 'correction' : 'clearing'}
                                    side="credit"
                                    lines={correcting ? [] : recentStatementLines(recentLines)}
                                    balance={balance}
                                    balanceAfter={balanceAfter}
                                    description={
                                        <div className="gl-cl-in" data-invalid={errors.notes ? true : undefined}>
                                            <label htmlFor="clearing_service" className="sr-only">الخدمة التي قدّمها المشترك للشركة</label>
                                            <Input
                                                id="clearing_service"
                                                name="notes"
                                                required
                                                autoFocus
                                                maxLength={1000}
                                                autoComplete="off"
                                                placeholder="الخدمة التي قدّمها، مثال: صيانة المولد في شهر 9"
                                                value={data.notes}
                                                onChange={(e) => setData('notes', e.target.value)}
                                            />
                                        </div>
                                    }
                                    amount={
                                        <div className="gl-cl-in is-amount" data-invalid={errors.amount ? true : undefined}>
                                            <Input
                                                ref={amountInput}
                                                id="amount"
                                                name="amount"
                                                required
                                                inputMode="decimal"
                                                autoComplete="off"
                                                dir="ltr"
                                                placeholder="0.00"
                                                aria-label="قيمة المقاصة"
                                                value={data.amount}
                                                onChange={(e) => setData((current) => ({ ...current, amount: normalizeDecimalInput(e.target.value), confirm_over_balance: false }))}
                                            />
                                            <span aria-hidden="true">₪</span>
                                        </div>
                                    }
                                />

                                <div className="gl-cl-under">
                                    <div className="gl-cl-quick">
                                        {QUICK_AMOUNTS.map((quick) => (
                                            <Button data-raw="" variant="ghost" key={quick} className="gl-num" aria-label={`${quick} شيكل`} onClick={() => setAmount(String(quick))}>
                                                {quick}
                                            </Button>
                                        ))}
                                        {owed > 0 && (
                                            <Button data-raw="" variant="ghost" className="is-settle" onClick={() => setAmount(String(owed))}>
                                                كل ما عليه <bdi className="gl-num">{formatMoney(owed)}</bdi>
                                            </Button>
                                        )}
                                    </div>
                                    <span className="gl-cl-hint ms-auto">الخدمة إلزامية، تُكتب في خانة البيان وتظهر في الكشف.</span>
                                </div>
                                <InputError message={errors.notes} className="mt-2" />
                                <InputError message={errors.amount} className="mt-2" />

                                {overBalance && (
                                    <div role="alert" className="gl-cl-note">
                                        <p className="m-0">
                                            {owed > 0 ? `قيمة المقاصة أكبر من الرصيد المستحق (${formatMoney(owed)} ₪)` : 'لا يوجد رصيد مستحق على هذا المشترك'}، فيصبح له رصيد لصالحه قدره{' '}
                                            <b className="gl-num">{formatMoney(creditLeft)} ₪</b>.
                                        </p>
                                        <label>
                                            <CheckBox checked={Boolean(data.confirm_over_balance)} onChange={(e) => setData('confirm_over_balance', e.target.checked)} />
                                            نعم، أريد فعلًا إضافة هذه المقاصة لهذا المشترك
                                        </label>
                                        <InputError message={errors.confirm_over_balance} className="mt-1" />
                                    </div>
                                )}
                                {amount > LARGE_CLEARING && !overBalance && (
                                    <FieldWarning>مبلغ كبير. تأكد أنه صحيح قبل الحفظ، فهو يظهر في كشف حساب المشترك.</FieldWarning>
                                )}

                                <div className="gl-cl-extra">
                                    <label htmlFor="clearing_manual_voucher_number">رقم السند اليدوي <small className="font-medium">(اختياري، رقم السند الورقي)</small></label>
                                    <div className="gl-cl-in">
                                        <Input
                                            id="clearing_manual_voucher_number"
                                            name="manual_voucher_number"
                                            dir="ltr"
                                            autoComplete="off"
                                            maxLength={50}
                                            placeholder="مثال: 00412"
                                            value={data.manual_voucher_number}
                                            onChange={(e) => setData('manual_voucher_number', e.target.value)}
                                        />
                                    </div>
                                    <InputError message={errors.manual_voucher_number} />
                                </div>
                            </div>

                            {correcting && (
                                <FormStep number={4} title="سبب التصحيح">
                                    <CorrectionReasonFields form={form} reasons={correctionReasons} />
                                </FormStep>
                            )}
                        </SheetBody>

                        <LedgerFooter
                            balance={balance}
                            balanceAfter={balanceAfter}
                            onCancel={requestClose}
                            disabled={amount <= 0 || missingService || (overBalance && !data.confirm_over_balance) || form.processing}
                            label={form.processing ? 'جارٍ الحفظ...' : correcting ? 'حفظ التصحيح' : amount > 0 ? `مقاصة ${formatMoney(amount)} ₪ من الحساب` : 'تسجيل المقاصة'}
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
