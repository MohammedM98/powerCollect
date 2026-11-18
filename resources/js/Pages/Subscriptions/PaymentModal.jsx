import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { useHttp, usePage } from '@inertiajs/react';
import ConfirmDialog from '@/Components/ConfirmDialog';
import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import { useResourceForm } from '@/hooks/useResourceForm';
import { paymentInShekels } from '@/lib/accountStatement';
import { overpaymentLevel } from '@/lib/overpayment';
import { formatMoney } from '@/lib/format';
import { clearErrorOnInput, submitOnCtrlEnter, validateFormFields } from '@/lib/formValidation';
import { balanceCells, CoverageBar, FormHeader, FormStep, MovementCard, MOVEMENT_TONES, SheetBody, SHEET_FORM_CLASS } from './AccountFormParts';
import { CorrectionReasonFields, EMPTY_CORRECTION, OriginalLine } from './CorrectionFields';
import { inputClass, PaymentReceipt } from './PaymentModalParts';
import PaymentMethodStep from './PaymentMethodStep';
import PaymentAmountStep from './PaymentAmountStep';
import PaymentFooter from './PaymentFooter';

export { inputClass };

/**
 * Record a payment on a subscription's account: how much, in shekels, and
 * how it was paid — in cash, or
 * by a transfer to one of the company's banks or e-wallets, with who sent
 * it and its reference. The movement card under the title shows what it
 * does to the balance before saving; once saved, the window shows the receipt with
 * the voucher number. Keys: Ctrl + Enter saves, 1 and 2 pick the method.
 *
 * With `correcting` (a statement line), it corrects that payment instead:
 * the form starts from it, `balance` leaves it out, and saving cancels it
 * and records this one in its place, under a new voucher number, with one
 * of `correctionReasons`.
 */
export default function PaymentModal({
    show,
    onClose,
    subscription,
    balance,
    paymentMethods,
    transferBanks,
    senderBanks,
    correcting = null,
    correctionReasons = [],
}) {
    const titleId = useId();
    const amountInput = useRef(null);
    const currencies = usePage().props.paymentOptions?.currencies ?? [{ code: 'ILS', label: 'شيكل', rate: '1' }];
    const recorded = correcting?.recorded;
    const form = useResourceForm(
        correcting ? `/subscriptions/${subscription.id}/transactions` : `/subscriptions/${subscription.id}/payments`,
        correcting,
        recorded
            ? {
                  amount: String(recorded.amount),
                  currency: recorded.currency,
                  payment_method: paymentMethods.some((method) => method.value === recorded.payment_method)
                      ? recorded.payment_method
                      : 'bank_transfer',
                  bank_name: recorded.bank_name === 'بال باي' ? 'محفظة بالباي' : recorded.bank_name,
                  sender_bank_name: recorded.sender_bank_name ?? '',
                  bank_received_on: recorded.bank_received_on ?? '',
                  sender_name: recorded.sender_name || subscription.fullName,
                  reference_number: recorded.reference_number,
                  confirm_duplicate_reference: false,
                  confirm_overpayment: false,
                  cash_box: recorded.cash_box,
                  manual_voucher_number: recorded.manual_voucher_number,
                  notes: recorded.notes,
                  ...EMPTY_CORRECTION,
              }
            : {
                  payment_token: crypto.randomUUID(),
                  amount: '',
                  currency: 'ILS',
                  // A bank transfer when the user may take one, else the way they may.
                  payment_method: paymentMethods.some((method) => method.value === 'bank_transfer') ? 'bank_transfer' : (paymentMethods[0]?.value ?? 'bank_transfer'),
                  bank_name: '',
                  sender_bank_name: '',
                  bank_received_on: '',
                  // Who the transfer came from: the subscription unless someone else paid.
                  sender_name: subscription.fullName,
                  reference_number: '',
                  confirm_duplicate_reference: false,
                  confirm_overpayment: false,
                  cash_box: '',
                  manual_voucher_number: '',
                  notes: '',
              },
    );
    const { data, setData, errors } = form;
    const [senderIsSubscriber, setSenderIsSubscriber] = useState(!recorded?.sender_name || recorded.sender_name === subscription.fullName);
    const [discarding, setDiscarding] = useState(false);
    const [confirmingSave, setConfirmingSave] = useState(false);
    const [receipt, setReceipt] = useState(null);
    const [referenceStatus, setReferenceStatus] = useState(null);
    const referenceCheck = useHttp();

    const throughBank = data.payment_method === 'bank_transfer';
    const selectedCurrency = currencies.find((currency) => currency.code === data.currency);
    const exchangeRate = selectedCurrency?.rate;
    const inShekels = paymentInShekels(data.amount, data.currency, exchangeRate);
    const currencyLabel = selectedCurrency?.label ?? data.currency;
    const currencyMark = data.currency === 'ILS' ? '₪' : data.currency;
    const owed = Number(balance) > 0 ? Number(balance) : 0;
    // More than is owed leaves the subscription in credit; far more is probably a slip and must be confirmed.
    const overpayment = overpaymentLevel(inShekels, owed);
    const methodText = throughBank
        ? data.bank_name
            ? `تحويل ${data.sender_bank_name ? `من ${data.sender_bank_name} ` : ''}إلى ${data.bank_name}`
            : 'تحويل بنكي'
        : 'نقد';
    const methods = ['bank_transfer', 'cash'].filter((method) => paymentMethods.some((option) => option.value === method));
    const tone = correcting ? 'correction' : 'payment';

    const askReferenceStatus = useEffectEvent((query) => referenceCheck
        .get(`/subscriptions/${subscription.id}/payments/reference-status?${query}`)
        .then((status) => setReferenceStatus(status ?? null))
        .catch(() => setReferenceStatus(null)));
    const cancelReferenceCheck = useEffectEvent(() => referenceCheck.cancel());

    useEffect(() => {
        const reference = data.reference_number.trim();

        if (!show || !throughBank || reference === '') {
            cancelReferenceCheck();
            setReferenceStatus(null);

            return undefined;
        }

        const timer = setTimeout(() => {
            const query = new URLSearchParams({
                reference_number: reference,
                amount: data.amount,
                currency: data.currency,
                sender_name: data.sender_name,
            });

            if (correcting?.id) {
                query.set('ignore_transaction_id', correcting.id);
            }

            askReferenceStatus(query);
        }, 400);

        return () => {
            clearTimeout(timer);
            cancelReferenceCheck();
        };
    }, [show, throughBank, data.reference_number, data.amount, data.currency, data.sender_name, correcting?.id, subscription.id]);

    function close() {
        setDiscarding(false);
        setReceipt(null);
        setSenderIsSubscriber(true);
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
        setData((current) => ({ ...current, amount: value, confirm_overpayment: false }));
        form.clearErrors('amount');
        amountInput.current?.focus();
    }

    function setCurrency(code) {
        setData((current) => ({ ...current, currency: code, confirm_overpayment: false }));
        form.clearErrors('currency', 'exchange_rate');
    }

    function toggleSender(isSubscription) {
        setSenderIsSubscriber(isSubscription);
        setData('sender_name', isSubscription ? subscription.fullName : '');
        form.clearErrors('sender_name');

        if (!isSubscription) {
            requestAnimationFrame(() => document.getElementById('sender_name')?.focus());
        }
    }

    /** 1 picks the transfer, 2 cash — unless a field is being typed in. */
    function onKeyDown(event) {
        submitOnCtrlEnter(event);

        const typing = event.target.matches('textarea, select, input:not([type=radio]):not([type=checkbox])');

        if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && ['1', '2'].includes(event.key)) {
            const method = methods[Number(event.key) - 1];

            if (method) {
                event.preventDefault();
                setData('payment_method', method);
            }
        }
    }

    function submit(event) {
        event.preventDefault();

        if (!validateFormFields(event.currentTarget, form)) {
            return;
        }

        if (!(Number(data.amount) > 0)) {
            form.setError('amount', 'أدخل مبلغًا أكبر من صفر.');
            amountInput.current?.focus();

            return;
        }

        setConfirmingSave(true);
    }

    function save() {
        setConfirmingSave(false);

        const recorded = { amount: data.amount, currency: data.currency, inShekels, methodText };

        form.save({
            preserveScroll: true,
            onSuccess: (page) => {
                const flashed = page.flash?.recordedPayment ?? {};

                setReceipt({
                    ...recorded,
                    amount: flashed.amount ?? recorded.amount,
                    currency: flashed.currency ?? recorded.currency,
                    inShekels: flashed.inShekels ?? recorded.inShekels,
                    voucherNumber: flashed.voucherNumber ?? null,
                    receiptUrl: flashed.receiptUrl ?? null,
                    balanceAfter: flashed.balance ?? Number(balance) - (inShekels ?? 0),
                });
                form.resetAndClearErrors();
                if (!correcting) {
                    const paymentToken = crypto.randomUUID();
                    form.setDefaults('payment_token', paymentToken);
                    form.setData('payment_token', paymentToken);
                }
                setSenderIsSubscriber(true);
                    },
        });
    }

    return (
        <>
            <Modal show={show} onClose={requestClose} maxWidth="5xl" panelClassName="overflow-clip!">
                {receipt ? (
                    <div role="dialog" aria-modal="true" aria-label={correcting ? 'صُحّحت الدفعة' : 'سُجّلت الدفعة'}>
                        <PaymentReceipt
                            receipt={receipt}
                            subscriptionName={subscription.fullName}
                            title={correcting ? 'صُحّحت الدفعة' : 'سُجّلت الدفعة'}
                            onAnother={correcting ? null : () => setReceipt(null)}
                            onDone={close}
                        />
                    </div>
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
                            icon={correcting ? 'repeat' : 'card'}
                            tone={correcting ? 'amber' : 'payment'}
                            title={correcting ? 'تصحيح دفعة' : 'تسجيل دفعة'}
                            subtitle={correcting ? 'صحّح الدفعة؛ تبقى الأصلية في الكشف ملغاة مع سبب التصحيح.' : 'سجّل المبلغ المستلم، ويُحدَّث الرصيد تلقائيًا.'}
                            onClose={requestClose}
                        />

                        <MovementCard
                            subscription={subscription}
                            tone={tone}
                            tag={correcting ? 'تصحيح' : 'دفعة'}
                            ops={['−', '=']}
                            cells={balanceCells({
                                balance,
                                balanceLabel: correcting ? 'الرصيد بدون الأصلية' : 'الرصيد الحالي',
                                amount: Number(data.amount) > 0 ? inShekels : null,
                                sign: -1,
                                moveLabel: 'هذه الدفعة',
                                moveNote: methodText,
                            })}
                        >
                            <CoverageBar amount={inShekels} owed={owed} />
                        </MovementCard>

                        <SheetBody>
                            {correcting && <OriginalLine entry={correcting} />}

                            <PaymentAmountStep
                                amountInput={amountInput}
                                currencies={currencies}
                                currencyLabel={currencyLabel}
                                currencyMark={currencyMark}
                                data={data}
                                errors={errors}
                                exchangeRate={exchangeRate}
                                inShekels={inShekels}
                                overpayment={overpayment}
                                owed={owed}
                                setAmount={setAmount}
                                setCurrency={setCurrency}
                                setData={setData}
                                titleId={titleId}
                            />

                            <PaymentMethodStep
                                data={data}
                                errors={errors}
                                methods={methods}
                                referenceCheck={referenceCheck}
                                referenceStatus={referenceStatus}
                                senderBanks={senderBanks}
                                senderIsSubscriber={senderIsSubscriber}
                                setData={setData}
                                throughBank={throughBank}
                                toggleSender={toggleSender}
                                transferBanks={transferBanks}
                            />

                            <FormStep number={3} title="ملاحظة" hint="اختياري: تظهر في كشف الحساب" done={Boolean(data.notes)}>
                                <div>
                                    <label htmlFor="payment_notes" className="sr-only">ملاحظة</label>
                                                <input
                                                    id="payment_notes"
                                                    name="notes"
                                                    autoComplete="off"
                                                    placeholder="أي تفصيل يُحفظ مع الدفعة"
                                                    value={data.notes}
                                                    onChange={(e) => setData('notes', e.target.value)}
                                                    className={inputClass}
                                                />
                                    <InputError message={errors.notes} className="mt-2" />
                                </div>
                            </FormStep>

                            {correcting && (
                                <FormStep number={4} title="سبب التصحيح">
                                    <CorrectionReasonFields form={form} reasons={correctionReasons} />
                                </FormStep>
                            )}
                        </SheetBody>

                        <PaymentFooter
                            correcting={correcting}
                            currencyMark={currencyMark}
                            data={data}
                            form={form}
                            inShekels={inShekels}
                            overpayment={overpayment}
                            referenceStatus={referenceStatus}
                            requestClose={requestClose}
                        />
                    </form>
                )}
            </Modal>

            <ConfirmDialog
                show={show && discarding}
                onConfirm={close}
                onCancel={() => setDiscarding(false)}
                title="تجاهل الدفعة؟"
                message="أدخلت بيانات لم تُحفظ بعد. إذا أغلقت النافذة الآن فستفقدها."
                confirmLabel="تجاهل الدفعة"
                cancelLabel="البقاء ومتابعة الإدخال"
                icon="alert"
                tone="danger"
            />

            <ConfirmDialog
                show={show && confirmingSave}
                onConfirm={save}
                onCancel={() => setConfirmingSave(false)}
                title={correcting ? 'تأكيد حفظ التصحيح؟' : 'تأكيد تسجيل الدفعة؟'}
                message={`${correcting ? 'ستُصحَّح الدفعة إلى' : 'ستُسجَّل دفعة'} ${formatMoney(data.amount)} ${currencyMark} ${methodText} على حساب ${subscription.fullName}${data.currency !== 'ILS' ? `، بقيمة ${formatMoney(inShekels)} شيكل` : ''}.${throughBank && data.bank_received_on ? ` تاريخ وصول الحوالة إلى البنك: ${data.bank_received_on}.` : ''} هل تريد المتابعة؟`}
                confirmLabel={correcting ? 'نعم، احفظ التصحيح' : 'نعم، سجّل الدفعة'}
                cancelLabel="رجوع للمراجعة"
                icon="check"
            />
        </>
    );
}
