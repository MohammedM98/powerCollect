import { Button, Input } from '@heroui/react';
import { useId, useRef, useState } from 'react';
import ConfirmDialog from '@/Components/ConfirmDialog';
import InputError from '@/Components/InputError';
import Icon from '@/Components/Icon';
import Modal from '@/Components/Modal';
import { useResourceForm } from '@/hooks/useResourceForm';
import { describeBalance } from '@/lib/accountStatement';
import { formatMoney, normalizeDecimalInput } from '@/lib/format';
import { amountForChargeType } from '@/lib/subscriptionCharges';
import { clearErrorOnInput, submitOnCtrlEnter, validateFormFields } from '@/lib/formValidation';
import {
    balanceText,
    ChoiceCards,
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

/** How each type of charge looks in the form: its icon, a hint, quick amounts and an example note. */
const TYPE_LOOKS = {
    penalty: { icon: 'warning', hint: 'مخالفة أو عبث بالعداد', quick: [50, 100, 200], example: 'اكتب سبب الغرامة، مثال: توصيل خط بدون عداد' },
    disconnection_fee: { icon: 'power', hint: 'قطع الكهرباء أو إعادتها', quick: [25, 50], example: 'مثال: فصل بسبب تراكم الدين' },
    subscription_fee: { icon: 'document-plus', hint: 'تحميل رسوم الاشتراك على الحساب', quick: [50, 100, 200], example: 'مثال: رسوم اشتراك المشترك' },
    minimum_charge: { icon: 'bolt', hint: 'تحميل الحد الأدنى المحدد لهذا المشترك', quick: [], example: 'ملاحظات على تحميل الحد الأدنى (اختياري)' },
};

/** A charge above this many shekels asks the user to double-check it. */
const LARGE_CHARGE = 500;

/**
 * Charge a subscription by hand (تحميل): a financial penalty (which must say
 * why), a service disconnection fee, subscription fee or their minimum.
 * The charge is written as the statement's next line, under the account's
 * last lines (`recentLines`), with the balance it leaves beside it; once saved, the window shows what was recorded. Keys: Ctrl +
 * Enter saves; number keys pick the type.
 *
 * With `correcting` (a statement line), it corrects that charge instead:
 * the form starts from it, `balance` leaves it out, and saving cancels it
 * and records this one in its place, with one of `correctionReasons`.
 */
export default function ChargeModal({ show, onClose, subscription, balance, chargeTypes, recentLines = [], correcting = null, correctionReasons = [] }) {
    const titleId = useId();
    const amountInput = useRef(null);
    const form = useResourceForm(
        correcting ? `/subscriptions/${subscription.id}/transactions` : `/subscriptions/${subscription.id}/charges`,
        correcting,
        correcting
            ? { type: correcting.recorded.type, amount: correcting.recorded.amount, notes: correcting.recorded.notes, override_minimum_amount: false, ...EMPTY_CORRECTION }
            : { type: chargeTypes[0]?.value ?? '', amount: '', notes: '', override_minimum_amount: false },
    );
    const { data, setData, errors } = form;
    const [discarding, setDiscarding] = useState(false);
    const [confirmingSave, setConfirmingSave] = useState(false);
    const [confirmingAmountUnlock, setConfirmingAmountUnlock] = useState(false);
    const [receipt, setReceipt] = useState(null);

    const type = chargeTypes.find((option) => option.value === data.type) ?? chargeTypes[0];
    const look = TYPE_LOOKS[type?.value] ?? TYPE_LOOKS.penalty;
    const isMinimumCharge = data.type === 'minimum_charge';
    const amount = Number(data.amount) > 0 ? Number(data.amount) : 0;
    const balanceAfter = amount > 0 ? Number(balance) + amount : null;
    const missingReason = Boolean(type?.needsReason && !data.notes.trim());
    const tone = correcting ? 'correction' : 'charge';
    const typeKeys = `1–${chargeTypes.length}`;
    const reasonLabel = type?.needsReason ? 'سبب الغرامة' : 'ملاحظات';

    function close() {
        setDiscarding(false);
        setConfirmingAmountUnlock(false);
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

    /** Picks a type, filling in its usual amount when none is typed yet. */
    function chooseType(value) {
        setData((current) => ({ ...current, type: value, amount: amountForChargeType(current, value, subscription, chargeTypes), override_minimum_amount: false }));
        setConfirmingAmountUnlock(false);
        form.clearErrors('type', 'notes', 'amount');
    }

    function setAmount(value) {
        setData('amount', value);
        form.clearErrors('amount');
        amountInput.current?.focus();
    }

    /** Number keys pick the type — unless a field is being typed in. */
    function onKeyDown(event) {
        submitOnCtrlEnter(event);

        const typing = event.target.matches('textarea, input:not([type=radio])');
        const index = Number(event.key) - 1;

        if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && chargeTypes[index]) {
            event.preventDefault();
            chooseType(chargeTypes[index].value);
        }
    }

    function submit(event) {
        event.preventDefault();

        if (!validateFormFields(event.currentTarget, form)) {
            return;
        }

        setConfirmingSave(true);
    }

    function save() {
        setConfirmingSave(false);

        const recorded = { typeLabel: type.label, amount, notes: data.notes.trim(), balanceAfter };

        form.save({
            preserveScroll: true,
            onSuccess: () => {
                setReceipt(recorded);
                form.resetAndClearErrors();
            },
        });
    }

    return (
        <>
            <Modal show={show} onClose={requestClose} maxWidth="5xl">
                {receipt ? (
                    <DoneScreen
                        tone={correcting ? 'amber' : 'red'}
                        title={correcting ? 'صُحّح التحميل' : 'أُضيف التحميل'}
                        text={`${formatMoney(receipt.amount)} ₪ ${receipt.typeLabel} على حساب ${subscription.fullName}.`}
                        rows={[
                            ['النوع', receipt.typeLabel],
                            ['المبلغ', `${formatMoney(receipt.amount)} ₪`],
                            ['الرصيد بعد', balanceText(describeBalance(receipt.balanceAfter))],
                            ['ملاحظات', receipt.notes || '—'],
                        ]}
                        anotherLabel="تحميل آخر"
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
                        onKeyDown={onKeyDown}
                        className={SHEET_FORM_CLASS}
                        data-ledger-tone={correcting ? 'correction' : 'charge'}
                        style={movementStyle(tone)}
                    >
                        <FormHeader
                            titleId={titleId}
                            icon={correcting ? 'repeat' : 'receipt'}
                            tone={correcting ? 'amber' : 'charge'}
                            title={correcting ? 'تصحيح تحميل' : 'تحميل حركة'}
                            subtitle={correcting ? 'صحّح التحميل؛ يبقى الأصلي في الكشف ملغى مع سبب التصحيح.' : [subscription.fullName, subscription.accountNumber && `حساب ${subscription.accountNumber}`].filter(Boolean).join('، ')}
                            onClose={requestClose}
                        />

                        <SheetBody>
                            {correcting && <OriginalLine entry={correcting} />}

                            <div className="gl-cl-types">
                                <ChoiceCards
                                    name="type"
                                    label="نوع التحميل"
                                    isRequired
                                    columns={4}
                                    value={data.type}
                                    onChange={chooseType}
                                    options={chargeTypes.map((option) => ({ value: option.value, icon: TYPE_LOOKS[option.value]?.icon ?? 'document-plus', title: option.label, hint: TYPE_LOOKS[option.value]?.hint }))}
                                />
                                <InputError message={errors.type} className="mt-2" />
                            </div>

                            <div>
                                <LedgerLine
                                    lines={correcting ? [] : recentStatementLines(recentLines)}
                                    balance={balance}
                                    balanceAfter={balanceAfter}
                                    shortcuts={typeKeys}
                                    description={
                                        <div className="gl-cl-in" data-invalid={errors.notes || (missingReason && amount > 0) ? true : undefined}>
                                            <label htmlFor="charge_notes" className="sr-only">{reasonLabel}</label>
                                            <Input
                                                id="charge_notes"
                                                name="notes"
                                                required={type?.needsReason}
                                                maxLength={1000}
                                                autoComplete="off"
                                                placeholder={`${type?.label ?? ''}: ${look.example}`}
                                                value={data.notes}
                                                onChange={(e) => setData('notes', e.target.value)}
                                            />
                                        </div>
                                    }
                                    amount={
                                        <div className="gl-cl-in is-amount" data-invalid={errors.amount ? true : undefined} data-readonly={isMinimumCharge && !data.override_minimum_amount ? true : undefined}>
                                            <Input
                                                ref={amountInput}
                                                id="amount"
                                                name="amount"
                                                required
                                                autoFocus
                                                inputMode="decimal"
                                                autoComplete="off"
                                                dir="ltr"
                                                placeholder="0.00"
                                                aria-label="مبلغ التحميل"
                                                value={data.amount}
                                                readOnly={isMinimumCharge && !data.override_minimum_amount}
                                                onChange={(e) => setData('amount', normalizeDecimalInput(e.target.value))}
                                            />
                                            <span aria-hidden="true">₪</span>
                                        </div>
                                    }
                                />

                                <div className="gl-cl-under">
                                    {look.quick.length > 0 && (
                                        <div className="gl-cl-quick">
                                            {look.quick.map((quick) => (
                                                <Button key={quick} className="gl-num" aria-label={`${quick} شيكل`} onClick={() => setAmount(String(quick))}>
                                                    {quick}
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                    {isMinimumCharge && (
                                        <Button aria-pressed={data.override_minimum_amount} onClick={() => {
                                            if (data.override_minimum_amount) {
                                                setData((current) => ({ ...current, amount: String(subscription.minimumPayment ?? '0'), override_minimum_amount: false }));
                                                form.clearErrors('amount');
                                            } else {
                                                setConfirmingAmountUnlock(true);
                                            }
                                        }} className="gl-cl-lock">
                                            <Icon name={data.override_minimum_amount ? 'unlock' : 'lock'} className="h-3.5 w-3.5" />
                                            {data.override_minimum_amount ? 'إعادة الحد الأدنى وقفل المبلغ' : `مقفل على الحد الأدنى ${formatMoney(subscription.minimumPayment)} ₪، فتح القفل لتعديله`}
                                        </Button>
                                    )}
                                    {type?.usualAmount && (
                                        <span className="gl-cl-hint">
                                            المعتاد لهذا النوع <b className="gl-num">{formatMoney(type.usualAmount)} ₪</b>
                                        </span>
                                    )}
                                    <span className={`gl-cl-hint ms-auto ${missingReason && amount > 0 ? 'is-bad' : ''}`}>
                                        {type?.needsReason ? 'سبب الغرامة إلزامي، يُكتب في خانة البيان.' : 'البيان يظهر في كشف الحساب كما تكتبه.'}
                                    </span>
                                </div>
                                <InputError message={errors.amount} className="mt-2" />
                                <InputError message={errors.notes} className="mt-2" />
                                {amount > LARGE_CHARGE && (
                                    <FieldWarning>مبلغ كبير. تأكد أنه صحيح قبل الحفظ، فهو يظهر في كشف حساب المشترك.</FieldWarning>
                                )}
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
                            disabled={amount <= 0 || missingReason || form.processing}
                            keys={<><span className="kbd">{typeKeys}</span> النوع</>}
                            label={form.processing ? 'جارٍ الحفظ...' : correcting ? 'حفظ التصحيح' : amount > 0 ? `إضافة ${formatMoney(amount)} ₪ إلى الكشف` : 'إضافة السطر'}
                        />
                    </form>
                )}
            </Modal>

            <ConfirmDialog
                show={show && confirmingAmountUnlock}
                onConfirm={() => {
                    setConfirmingAmountUnlock(false);
                    setData('override_minimum_amount', true);
                    form.clearErrors('amount');
                    amountInput.current?.focus();
                }}
                onCancel={() => setConfirmingAmountUnlock(false)}
                title="تعديل مبلغ التحميل؟"
                message="سيُفتح المبلغ لتعديله لهذا التحميل فقط. يبقى الحد الأدنى المحفوظ للمشترك كما هو."
                confirmLabel="نعم، افتح القفل"
                icon="pencil"
            />

            <ConfirmDialog
                show={show && discarding}
                onConfirm={close}
                onCancel={() => setDiscarding(false)}
                title="تجاهل التحميل؟"
                message="أدخلت بيانات لم تُحفظ بعد. إذا أغلقت النافذة الآن فستفقدها."
                confirmLabel="تجاهل التحميل"
                cancelLabel="البقاء ومتابعة الإدخال"
                icon="alert"
                tone="danger"
            />

            <ConfirmDialog
                show={show && confirmingSave}
                onConfirm={save}
                onCancel={() => setConfirmingSave(false)}
                title={correcting ? 'تأكيد حفظ التصحيح؟' : 'تأكيد إضافة التحميل؟'}
                message={`${correcting ? 'سيُصحَّح التحميل إلى' : 'سيُضاف تحميل'} ${type.label} بقيمة ${formatMoney(amount)} ₪ على حساب ${subscription.fullName}. هل تريد المتابعة؟`}
                confirmLabel={correcting ? 'نعم، احفظ التصحيح' : 'نعم، أضف التحميل'}
                cancelLabel="رجوع للمراجعة"
                icon="check"
            />
        </>
    );
}
