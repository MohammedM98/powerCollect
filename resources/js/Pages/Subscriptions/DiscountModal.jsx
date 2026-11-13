import { useId, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import ConfirmDialog from '@/Components/ConfirmDialog';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { useResourceForm } from '@/hooks/useResourceForm';
import { describeBalance } from '@/lib/accountStatement';
import { formatAmount } from '@/lib/currency';
import { formatMoney } from '@/lib/format';
import { clearErrorOnInput, submitOnCtrlEnter, validateFormFields } from '@/lib/formValidation';
import { balanceCells, balanceText, DoneScreen, FormFooter, FormHeader, FormStep, MovementCard, MOVEMENT_TONES, SheetBody, SHEET_FORM_CLASS } from './AccountFormParts';
import { CorrectionReasonFields, EMPTY_CORRECTION, OriginalLine } from './CorrectionFields';
import { discountPreview, standingTerms, withSegment } from '@/lib/discountTerms';
import DiscountSegmentStep from './DiscountSegmentStep';
import DiscountValueStep from './DiscountValueStep';
import DiscountMethodStep from './DiscountMethodStep';
import DiscountKindStep from './DiscountKindStep';
import DiscountNotesStep from './DiscountNotesStep';
import StandingDiscountCard from './StandingDiscountCard';

/**
 * Give a subscription a discount (خصم). Once: shekels taken off what they
 * owe now. Weekly readings (خصم القراءات الأسبوعية): an advantage taken
 * off the latest week's reading, straight away if it has been entered,
 * and every weekly reading after it — a
 * percentage of the reading, free kilowatts, or shekels off the kilo price
 * — until it is stopped. The movement card under the title shows the balance a
 * discount leaves, or what the subscription pays for the latest week with a
 * standing one. Keys: Ctrl + Enter saves, 1 · 2 · 3 pick the weekly
 * readings discount's method.
 *
 * With `correcting` (a statement line), it corrects that one-off discount
 * instead: the form starts from its shekels, `balance` leaves it out, and
 * saving cancels it and records this one in its place, with one of
 * `correctionReasons`.
 */
export default function DiscountModal({
    show,
    onClose,
    subscription,
    balance,
    discountMethods,
    discountSegments = [],
    correcting = null,
    correctionReasons = [],
}) {
    const titleId = useId();
    const valueInput = useRef(null);
    const standingDiscount = subscription.standingDiscount;
    const form = useResourceForm(
        correcting ? `/subscriptions/${subscription.id}/transactions` : `/subscriptions/${subscription.id}/discounts`,
        correcting,
        correcting
            ? {
                  kind: 'once',
                  method: 'shekel',
                  value: formatAmount(correcting.amount),
                  segment: '',
                  notes: correcting.recorded.notes,
                  ...EMPTY_CORRECTION,
              }
            : { kind: 'once', method: 'shekel', value: '', segment: '', notes: '' },
    );
    const { data, setData, errors } = form;
    const [discarding, setDiscarding] = useState(false);
    const [confirmingSave, setConfirmingSave] = useState(false);
    const [confirmingStop, setConfirmingStop] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [receipt, setReceipt] = useState(null);

    const { isStanding, kiloPrice, owed, value, field, methods, invalid, discount, balanceAfter, example, exampleBill, exampleWithDiscount, weeklySaving, steps } = discountPreview(data, subscription, balance, discountMethods, correcting);
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

    function changeKind(kind) {
        // Switching to the standing kind starts from the subscription's current one, to change it,
        // or else from their customer segment on the tariff, if they have one.
        const current = kind === 'standing' ? standingDiscount : null;
        const segment = current ? (current.segment ?? '') : kind === 'standing' ? (subscription.tariffSegmentName ?? '') : '';

        setData((previous) => ({
            ...previous,
            kind,
            method: kind === 'once' ? 'shekel' : (current?.method ?? previous.method),
            value: current ? formatAmount(current.value) : '',
            segment,
            notes: current?.notes ?? '',
        }));
        form.clearErrors();
    }

    function changeMethod(method) {
        setData((current) => ({ ...current, method, value: '' }));
        form.clearErrors('value');
        valueInput.current?.focus();
    }

    function setValue(next) {
        setData('value', String(next));
        form.clearErrors('value');
        valueInput.current?.focus();
    }

    function stopStandingDiscount() {
        setConfirmingStop(false);
        router.delete(`/subscriptions/${subscription.id}/standing-discount`, {
            preserveScroll: true,
            onStart: () => setStopping(true),
            onFinish: () => setStopping(false),
            onSuccess: () => {
                form.resetAndClearErrors();
                onClose();
            },
        });
    }

    /** 1 · 2 · 3 pick the method — unless a field is being typed in. */
    function onKeyDown(event) {
        submitOnCtrlEnter(event);

        const typing = event.target.matches('textarea, input:not([type=radio])');
        const method = methods[Number(event.key) - 1];

        if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && method) {
            event.preventDefault();
            changeMethod(method);
        }
    }

    function submit(event) {
        event.preventDefault();

        if (!validateFormFields(event.currentTarget, form) || invalid) {
            return;
        }

        setConfirmingSave(true);
    }

    function save() {
        setConfirmingSave(false);

        const recorded = isStanding
            ? {
                  standing: true,
                  terms: standingTerms(data.method, data.value),
                  segment: data.segment.trim(),
                  weekly: `${formatMoney(exampleWithDiscount.amountDue)} ₪ بدلًا من ${formatMoney(exampleBill.amountDue)} ₪`,
              }
            : {
                  standing: false,
                  method: 'مبلغ ثابت بالشيكل',
                  discount,
                  balanceAfter,
              };
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setReceipt(recorded);
                form.resetAndClearErrors();
            },
        };

        // A standing discount is saved on its own address.
        if (isStanding) {
            form.put(`/subscriptions/${subscription.id}/standing-discount`, options);
        } else {
            form.save(options);
        }
    }

    const doneRows = !receipt
        ? []
        : receipt.standing
          ? [
                ['الخصم', receipt.terms],
                ['التصنيف', receipt.segment || '—'],
                ['قراءة الأسبوع', receipt.weekly],
            ]
          : [
                ['الطريقة', receipt.method],
                ['قيمة الخصم', `${formatMoney(receipt.discount)} ₪`],
                ['الرصيد بعد', balanceText(describeBalance(receipt.balanceAfter))],
            ];

    return (
        <>
            <Modal show={show} onClose={requestClose} maxWidth="3xl">
                {receipt ? (
                    <DoneScreen
                        tone={correcting ? 'amber' : 'green'}
                        title={receipt.standing ? 'فُعّل خصم القراءات الأسبوعية' : correcting ? 'صُحّح الخصم' : 'أُضيف الخصم'}
                        text={
                            receipt.standing
                                ? 'يُخصم تلقائيًا من كل قراءة أسبوعية تُدخل من الآن.'
                                : `نزل ${formatMoney(receipt.discount)} ₪ من حساب ${subscription.fullName}.`
                        }
                        rows={doneRows}
                        anotherLabel="خصم آخر"
                        onAnother={correcting || receipt.standing ? null : () => setReceipt(null)}
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
                        style={{ '--gl-t': MOVEMENT_TONES[tone], '--gl-t-ink': 'var(--gl-tone-ink)' }}
                    >
                        <FormHeader
                            titleId={titleId}
                            icon={correcting ? 'repeat' : 'tag'}
                            tone={correcting ? 'amber' : 'green'}
                            title={correcting ? 'تصحيح خصم' : 'إضافة خصم'}
                            subtitle={
                                correcting
                                    ? 'صحّح الخصم؛ يبقى الأصلي في الكشف ملغى مع سبب التصحيح.'
                                    : 'يُنزَّل مما على المشترك، مرة واحدة أو كل أسبوع.'
                            }
                            onClose={requestClose}
                        />

                        {isStanding ? (
                            <StandingDiscountCard
                                data={data}
                                example={example}
                                exampleBill={exampleBill}
                                exampleWithDiscount={exampleWithDiscount}
                                invalid={invalid}
                                subscription={subscription}
                                tone={tone}
                                value={value}
                                weeklySaving={weeklySaving}
                            />
                        ) : (
                            <MovementCard
                                subscription={subscription}
                                tone={tone}
                                tag="مرة واحدة"
                                ops={['−', '=']}
                                cells={balanceCells({
                                    balance,
                                    balanceLabel: correcting ? 'الرصيد بدون الأصلي' : 'الرصيد الحالي',
                                    amount: discount,
                                    sign: -1,
                                    moveLabel: 'الخصم',
                                    afterLabel: 'الرصيد بعده',
                                })}
                            />
                        )}

                        <SheetBody>
                            {correcting && <OriginalLine entry={correcting} />}

                            {!correcting && (
                                <DiscountKindStep
                                    changeKind={changeKind}
                                    data={data}
                                    isStanding={isStanding}
                                    setConfirmingStop={setConfirmingStop}
                                    standingDiscount={standingDiscount}
                                    steps={steps}
                                    stopping={stopping}
                                />
                            )}

                            {isStanding && (
                                <DiscountMethodStep
                                    changeMethod={changeMethod}
                                    data={data}
                                    errors={errors}
                                    kiloPrice={kiloPrice}
                                    methods={methods}
                                    steps={steps}
                                />
                            )}
                            {!isStanding && <InputError message={errors.method} />}

                            <DiscountValueStep
                                data={data}
                                errors={errors}
                                example={example}
                                exampleWithDiscount={exampleWithDiscount}
                                field={field}
                                invalid={invalid}
                                isStanding={isStanding}
                                owed={owed}
                                setData={setData}
                                setValue={setValue}
                                steps={steps}
                                value={value}
                                valueInput={valueInput}
                                weeklySaving={weeklySaving}
                            />

                            {isStanding && (
                                <DiscountSegmentStep
                                    data={data}
                                    discountSegments={discountSegments}
                                    errors={errors}
                                    setData={setData}
                                    steps={steps}
                                />
                            )}

                            <DiscountNotesStep data={data} errors={errors} setData={setData} steps={steps} />

                            {correcting && (
                                <FormStep number={steps.notes + 1} title="سبب التصحيح">
                                    <CorrectionReasonFields form={form} reasons={correctionReasons} />
                                </FormStep>
                            )}
                        </SheetBody>

                        <FormFooter
                            onCancel={requestClose}
                            tone={correcting ? 'amber' : 'green'}
                            disabled={value <= 0 || Boolean(invalid)}
                            processing={form.processing}
                            submitLabel={
                                correcting
                                    ? 'حفظ التصحيح'
                                    : isStanding
                                      ? standingDiscount
                                          ? 'استبدال خصم القراءات الأسبوعية'
                                          : 'تفعيل خصم القراءات الأسبوعية'
                                      : discount
                                        ? `خصم ${formatMoney(discount)} ₪`
                                        : 'إضافة الخصم'
                            }
                            shortcuts={isStanding ? '1 · 2 · 3 للطريقة' : undefined}
                        />
                    </form>
                )}
            </Modal>

            <ConfirmDialog
                show={show && discarding}
                onConfirm={close}
                onCancel={() => setDiscarding(false)}
                title="تجاهل الخصم؟"
                message="أدخلت بيانات لم تُحفظ بعد. إذا أغلقت النافذة الآن فستفقدها."
                confirmLabel="تجاهل الخصم"
                cancelLabel="البقاء ومتابعة الإدخال"
                icon="alert"
                tone="danger"
            />

            <ConfirmDialog
                show={show && confirmingStop}
                onConfirm={stopStandingDiscount}
                onCancel={() => setConfirmingStop(false)}
                title="إيقاف خصم القراءات الأسبوعية؟"
                message={
                    standingDiscount &&
                    `لن يُخصم (${withSegment(standingDiscount.terms, standingDiscount.segment)}) من قراءات ${subscription.fullName} التي تُدخل بعد الآن. القراءات السابقة تحتفظ بخصمها.`
                }
                confirmLabel="نعم، أوقف الخصم"
                cancelLabel="إبقاء الخصم"
                icon="alert"
                tone="danger"
            />

            <ConfirmDialog
                show={show && confirmingSave}
                onConfirm={save}
                onCancel={() => setConfirmingSave(false)}
                title={correcting ? 'تأكيد حفظ التصحيح؟' : 'تأكيد إضافة الخصم؟'}
                message={isStanding
                        ? `سيُفعَّل خصم القراءات الأسبوعية (${standingTerms(data.method, data.value)}) لـ ${subscription.fullName} على القراءات التي تُدخل من الآن. هل تريد المتابعة؟`
                        : `${correcting ? 'سيُصحَّح الخصم إلى' : 'سينزل'} ${formatMoney(discount ?? 0)} ₪ من حساب ${subscription.fullName}. هل تريد المتابعة؟`}
                confirmLabel={correcting ? 'نعم، احفظ التصحيح' : 'نعم، أضف الخصم'}
                cancelLabel="رجوع للمراجعة"
                icon="check"
            />
        </>
    );
}
