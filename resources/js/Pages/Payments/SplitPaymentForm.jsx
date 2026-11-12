import { useEffect, useRef, useState } from 'react';
import { useForm, useHttp } from '@inertiajs/react';
import ConfirmDialog from '@/Components/ConfirmDialog';
import Icon from '@/Components/Icon';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import { describeBalance } from '@/lib/accountStatement';
import { formatMoney, normalizeDecimalInput } from '@/lib/format';
import { balanceText, FieldLabel } from '@/Pages/Subscriptions/AccountFormParts';
import { inputClass } from '@/Pages/Subscriptions/PaymentModal';
import { toCents, fromCents } from '@/lib/currency';
import SplitAllocationMeter from './SplitAllocationMeter';
import SplitRecipientsSection, { MAX_PARTS } from './SplitRecipientsSection';
import SplitTransferDetails from './SplitTransferDetails';

const SEARCH_DELAY = 300;

/** The panel shown once the split is recorded: what was saved, and each part's receipt. */
function RecordedSplit({ recorded, onAnother }) {
    return (
        <div className="space-y-5 rounded-panel border border-emerald-500/30 bg-emerald-500/[0.06] p-6">
            <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Icon name="check" className="h-6 w-6" />
                </span>
                <div>
                    <h3 className="text-xl font-bold text-gray-900">سُجّلت الدفعة المقسّمة</h3>
                    <p className="text-sm text-gray-600">
                        {formatMoney(recorded.total)} ₪ · {recorded.bankName} · مرجع{' '}
                        <span dir="ltr" className="font-display font-semibold">
                            {recorded.reference}
                        </span>
                    </p>
                </div>
            </div>

            <ul className="divide-y divide-gray-100 overflow-hidden rounded-[18px] border border-gray-100 bg-surface">
                {recorded.parts.map((part) => (
                    <li key={part.accountNumber} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                        <b className="min-w-0 flex-1 basis-44 text-gray-900">{part.subscriptionName}</b>
                        <span className="text-gray-500">الرصيد بعدها {balanceText(describeBalance(part.balance))}</span>
                        <b className="font-display text-base text-emerald-700 dark:text-emerald-400">{formatMoney(part.amount)} ₪</b>
                        <a
                            href={part.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="tone-print inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-xs font-semibold transition"
                        >
                            <Icon name="printer" className="h-3.5 w-3.5" />
                            السند
                        </a>
                    </li>
                ))}
            </ul>

            <PrimaryButton type="button" onClick={onAnother}>
                <Icon name="plus" className="h-4 w-4" />
                دفعة مقسّمة جديدة
            </PrimaryButton>
        </div>
    );
}

/**
 * One bank transfer divided between any subscriptions the user chooses: the
 * transfer's details are entered once, then each subscription is given its
 * share. It can be saved only when the shares add up to exactly what was
 * transferred; the server records a payment on each subscription together,
 * or none.
 */
export default function SplitPaymentForm({ transferBanks, senderBanks, bare = false, onDirtyChange, initialSubscription = null }) {
    const form = useForm({
        total_amount: '',
        bank_name: '',
        sender_bank_name: '',
        bank_received_on: '',
        sender_name: '',
        reference_number: '',
        notes: '',
        parts: [],
        confirm_duplicate_reference: false,
        confirm_overpayment: false,
    });
    const { data, setData, errors, processing } = form;
    const [parts, setParts] = useState(() => (initialSubscription ? [{ subscription: initialSubscription, amount: '' }] : []));
    const [recorded, setRecorded] = useState(null);
    const [confirmingSave, setConfirmingSave] = useState(false);
    const [term, setTerm] = useState('');
    const [found, setFound] = useState({ subscriptions: [], hasMore: false, searched: false });
    const [identityNote, setIdentityNote] = useState(null);
    const http = useHttp();
    const httpRef = useRef(http);
    httpRef.current = http;
    const referenceCheck = useHttp();
    const referenceCheckRef = useRef(referenceCheck);
    referenceCheckRef.current = referenceCheck;
    const [referenceStatus, setReferenceStatus] = useState(null);

    // Whether the reference is free or already on a payment, said as it is typed; a repeated one is allowed once confirmed.
    useEffect(() => {
        const reference = data.reference_number.trim();

        if (reference === '') {
            setReferenceStatus(null);

            return undefined;
        }

        const timer = setTimeout(() => {
            referenceCheckRef.current
                .get(`/payments/split/reference-status?${new URLSearchParams({ reference_number: reference })}`)
                .then((status) => setReferenceStatus(status ? { ...status, reference } : null))
                .catch(() => setReferenceStatus(null));
        }, SEARCH_DELAY);

        return () => {
            clearTimeout(timer);
            referenceCheckRef.current.cancel();
        };
    }, [data.reference_number]);

    // The subscriptions matching what was typed, offered to add to the split.
    useEffect(() => {
        if (term.trim() === '') {
            setFound({ subscriptions: [], hasMore: false, searched: false });

            return undefined;
        }

        const timer = setTimeout(() => {
            httpRef.current
                .get(`/payments/search?${new URLSearchParams({ search: term.trim() })}`)
                .then((result) => setFound({ subscriptions: result.subscriptions, hasMore: result.hasMore, searched: true }))
                .catch(() => setFound({ subscriptions: [], hasMore: false, searched: true }));
        }, SEARCH_DELAY);

        return () => clearTimeout(timer);
    }, [term]);

    const totalCents = toCents(data.total_amount);
    const allocatedCents = parts.reduce((sum, part) => sum + toCents(part.amount), 0);
    const remainingCents = totalCents - allocatedCents;
    const everyPartHasAmount = parts.every((part) => toCents(part.amount) > 0);
    const detailsFilled = [data.bank_name, data.sender_name.trim(), data.reference_number.trim()].every(Boolean);
    const distributed = totalCents > 0 && remainingCents === 0 && parts.length >= 2 && everyPartHasAmount;
    const currentStatus = referenceStatus?.reference === data.reference_number.trim() ? referenceStatus : null;
    const duplicateReference = Boolean(currentStatus?.conflict) || (Boolean(errors.reference_number) && errors.reference_number.includes('مسجَّل مسبقًا'));
    const canSave = distributed && detailsFilled && !processing && (!duplicateReference || data.confirm_duplicate_reference);

    function addSubscription(subscription) {
        setParts((current) =>
            current.length >= MAX_PARTS || current.some((part) => part.subscription.id === subscription.id) ? current : [...current, { subscription, amount: '' }],
        );
        setTerm('');
        setIdentityNote(null);
        form.clearErrors();
    }

    function setAmount(index, amount) {
        setParts((current) => current.map((part, position) => (position === index ? { ...part, amount } : part)));
        form.clearErrors('parts', 'confirm_overpayment');
        setData('confirm_overpayment', false);
    }

    function removePart(index) {
        setParts((current) => current.filter((_, position) => position !== index));
    }

    /** Adds the other subscriptions under the first one's identity number, which a payer often settles together. */
    function addIdentitySiblings() {
        const first = parts[0]?.subscription;

        if (!first) {
            return;
        }

        httpRef.current
            .get(`/payments/search?${new URLSearchParams({ siblings_of: first.id })}`)
            .then((result) => {
                const present = new Set(parts.map((part) => part.subscription.id));
                const added = result.subscriptions.filter((subscription) => !present.has(subscription.id));

                setParts((current) => [...current, ...added.map((subscription) => ({ subscription, amount: '' }))].slice(0, MAX_PARTS));
                setIdentityNote(added.length > 0 ? `أُضيف ${added.length} من الاشتراكات الأخرى بنفس رقم الهوية.` : 'لا توجد اشتراكات أخرى بنفس رقم الهوية.');
            })
            .catch(() => setIdentityNote('تعذّر جلب الاشتراكات الأخرى.'));
    }

    /** Puts what is still left on the last subscription of the list. */
    function putRemainderOnLast() {
        if (parts.length === 0 || remainingCents === 0) {
            return;
        }

        const last = parts.length - 1;
        const amount = toCents(parts[last].amount) + remainingCents;

        if (amount > 0) {
            setAmount(last, String(fromCents(amount)));
        }
    }

    function save() {
        setConfirmingSave(false);
        form.transform((current) => ({
            ...current,
            parts: parts.map((part) => ({ subscription_id: part.subscription.id, amount: part.amount })),
        }));
        form.post('/payments/split', {
            preserveScroll: true,
            onSuccess: (page) => {
                setRecorded(page.flash?.recordedSplitPayment ?? null);
                setParts([]);
                form.reset();
                form.clearErrors();
            },
        });
    }

    // Whether something is entered that closing the form would lose; the modal asks before throwing it away.
    const dirty = !recorded && (parts.length !== (initialSubscription ? 1 : 0) || parts.some((part) => part.amount !== '') || data.total_amount !== '' || data.sender_name !== '' || data.reference_number !== '' || data.bank_name !== '' || data.bank_received_on !== '');
    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    if (recorded) {
        return <RecordedSplit recorded={recorded} onAnother={() => setRecorded(null)} />;
    }

    const meterTone = distributed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-amber-500/40 bg-amber-500/[0.08] text-gray-800';

    return (
        <div className={`grid gap-[22px] ${bare ? '' : 'rounded-panel border border-gray-100 bg-surface p-5 shadow-card sm:p-6'}`}>
            <div>
                <FieldLabel htmlFor="split_total" required>
                    المبلغ المحوَّل (الإجمالي)
                </FieldLabel>
                <div
                    className={`rounded-[22px] border-[1.5px] bg-surface px-[18px] py-4 transition ${
                        errors.total_amount
                            ? 'border-brand-500 shadow-[0_0_0_5px_rgb(var(--brand-500)/0.08)]'
                            : 'border-gray-200 focus-within:border-brand-500 focus-within:shadow-[0_0_0_5px_rgb(var(--brand-500)/0.12)]'
                    }`}
                >
                    <div className="flex items-center gap-3.5">
                        <input
                            id="split_total"
                            autoFocus
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            dir="ltr"
                            value={data.total_amount}
                            onChange={(event) => {
                                setData('total_amount', normalizeDecimalInput(event.target.value));
                                form.clearErrors('total_amount', 'parts');
                            }}
                            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-end font-display text-[38px] font-extrabold leading-tight text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-0 sm:text-[44px]"
                        />
                        <span className="shrink-0 font-display text-[28px] font-bold text-gray-400" aria-hidden="true">
                            ₪
                        </span>
                    </div>
                </div>
                {errors.total_amount && (
                    <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13.5px] text-brand-600">
                        <Icon name="info" className="h-[18px] w-[18px]" />
                        {errors.total_amount}
                    </p>
                )}
            </div>

            <SplitTransferDetails
                currentStatus={currentStatus}
                data={data}
                duplicateReference={duplicateReference}
                errors={errors}
                form={form}
                referenceCheck={referenceCheck}
                senderBanks={senderBanks}
                setData={setData}
                transferBanks={transferBanks}
            />

            <SplitRecipientsSection
                addIdentitySiblings={addIdentitySiblings}
                addSubscription={addSubscription}
                errors={errors}
                found={found}
                identityNote={identityNote}
                parts={parts}
                removePart={removePart}
                setAmount={setAmount}
                setTerm={setTerm}
                term={term}
            />

            <SplitAllocationMeter
                allocatedCents={allocatedCents}
                distributed={distributed}
                meterTone={meterTone}
                parts={parts}
                putRemainderOnLast={putRemainderOnLast}
                remainingCents={remainingCents}
                totalCents={totalCents}
            />

            {errors.confirm_overpayment && (
                <div role="alert" className="rounded-xl border border-brand-500/40 bg-brand-500/[0.07] px-4 py-3 text-sm text-gray-900">
                    <p className="flex items-start gap-2 font-medium">
                        <Icon name="alert" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                        <span>{errors.confirm_overpayment}</span>
                    </p>
                    <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
                        <input
                            type="checkbox"
                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            checked={data.confirm_overpayment}
                            onChange={(event) => setData('confirm_overpayment', event.target.checked)}
                        />
                        أؤكد أن المبالغ صحيحة
                    </label>
                </div>
            )}

            <div>
                <FieldLabel htmlFor="split_notes" hint="تظهر في كشف كل مشترك">
                    ملاحظة
                </FieldLabel>
                <input id="split_notes" maxLength={1000} autoComplete="off" placeholder="أي تفصيل يُحفظ مع الدفعة" value={data.notes} onChange={(event) => setData('notes', event.target.value)} className={inputClass} />
                <InputError message={errors.notes} className="mt-2" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <p className="max-w-xl text-[13.5px] text-gray-500">
                    تُسجَّل <b className="text-gray-800">دفعة منفصلة لكل مشترك</b> في كشفه، وتُحفظ كلها معًا أو لا تُحفظ أيٌّ منها.
                </p>
                <PrimaryButton type="button" disabled={!canSave} onClick={() => setConfirmingSave(true)} className="h-12 px-6 text-[15px]">
                    {parts.length >= 2 ? `تسجيل الدفعة على ${parts.length} مشتركين` : 'تسجيل الدفعة'}
                    <Icon name="check" className="h-[18px] w-[18px]" />
                </PrimaryButton>
            </div>

            <ConfirmDialog
                show={confirmingSave}
                onConfirm={save}
                onCancel={() => setConfirmingSave(false)}
                title="تسجيل الدفعة المقسّمة؟"
                message={`ستُسجَّل ${parts.length} دفعات بمجموع ${formatMoney(fromCents(totalCents))} ₪ محوَّلة من ${data.sender_name.trim()} إلى ${data.bank_name} (مرجع ${data.reference_number.trim()}). هل تريد المتابعة؟`}
                confirmLabel="نعم، سجّل"
                icon="check"
            />
        </div>
    );
}
