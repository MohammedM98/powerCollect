import { useEffect, useRef, useState } from 'react';
import { useForm, useHttp } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import InputError from '@/Components/InputError';
import { Button, Input } from '@heroui/react';
import { describeBalance } from '@/lib/accountStatement';
import { formatMoney, normalizeDecimalInput } from '@/lib/format';
import { AmountBox, balanceText, FieldLabel } from '@/Pages/Subscriptions/AccountFormParts';
import { inputClass } from '@/Pages/Subscriptions/PaymentModal';
import { toCents, fromCents } from '@/lib/currency';
import SplitAllocationMeter from './SplitAllocationMeter';
import SplitRecipientsSection, { MAX_PARTS } from './SplitRecipientsSection';
import SplitTransferDetails from './SplitTransferDetails';
import { CheckBox, ConfirmDialog } from '@/Components/UI';

const SEARCH_DELAY = 300;

/** The panel shown once the split is recorded: what was saved, and each part's receipt. */
function RecordedSplit({ recorded, onAnother }) {
    return (
        <div className="space-y-6 rounded-panel border border-emerald-500/30 bg-emerald-500/6 p-6">
            <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Icon name="check" className="h-6 w-6" />
                </span>
                <div>
                    <h3 className="text-xl font-bold text-gray-900">سُجّلت الدفعة المقسّمة</h3>
                    <p className="text-sm text-gray-600">
                        {formatMoney(recorded.total)} ₪، {recorded.bankName}، مرجع{' '}
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
                            className="tone-print inline-flex items-center gap-2 rounded-control border px-3 py-1 text-xs font-semibold transition"
                        >
                            <Icon name="printer" className="h-3.5 w-3.5" />
                            السند
                        </a>
                    </li>
                ))}
            </ul>

            <Button onPress={onAnother} className="gl-sheet-btn is-primary">
                <Icon name="plus" className="h-4 w-4" />
                دفعة مقسّمة جديدة
            </Button>
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
export default function SplitPaymentForm({ transferBanks, senderBanks, onCancel = null, onDirtyChange, initialSubscription = null }) {
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
        return (
            <div className="gl-sheet-body">
                <RecordedSplit recorded={recorded} onAnother={() => setRecorded(null)} />
            </div>
        );
    }

    const meterTone = distributed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-amber-500/40 bg-amber-500/8 text-gray-800';

    return (
        <>
        <div className="gl-sheet-body">
            <div>
                <FieldLabel htmlFor="split_total" required>
                    المبلغ المحوَّل (الإجمالي)
                </FieldLabel>
                <AmountBox
                    id="split_total"
                    autoFocus
                    label="المبلغ المحوَّل (الإجمالي)"
                    placeholder="0.00"
                    unit="₪"
                    value={data.total_amount}
                    error={Boolean(errors.total_amount)}
                    onChange={(event) => {
                        setData('total_amount', normalizeDecimalInput(event.target.value));
                        form.clearErrors('total_amount', 'parts');
                    }}
                />
                {errors.total_amount && (
                    <p role="alert" className="mt-2 flex items-center gap-2 text-[13.5px] text-red-600">
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
                        <Icon name="alert" className="mt-1 h-[18px] w-[18px] shrink-0" />
                        <span>{errors.confirm_overpayment}</span>
                    </p>
                    <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
                        <CheckBox
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
                <Input id="split_notes" maxLength={1000} autoComplete="off" placeholder="أي تفصيل يُحفظ مع الدفعة" value={data.notes} onChange={(event) => setData('notes', event.target.value)} className={inputClass} />
                <InputError message={errors.notes} className="mt-2" />
            </div>

            <p className="flex items-start gap-2 text-[13px] text-gray-500">
                <Icon name="info" className="mt-1 h-4 w-4 shrink-0" />
                <span>تُسجَّل <b className="text-gray-800">دفعة منفصلة لكل مشترك</b> في كشفه، وتُحفظ كلها معًا أو لا تُحفظ أيٌّ منها.</span>
            </p>
        </div>

        <aside className="gl-split-aside" aria-hidden="true">
            <p className="gl-mv-title">التوزيع</p>
            <div className="gl-split-bar" data-done={distributed || undefined}>
                <i style={{ width: `${totalCents > 0 ? Math.min(100, (allocatedCents / totalCents) * 100) : 0}%` }} />
            </div>
            <dl className="gl-split-rows">
                <div><dt>المحوَّل</dt><dd className="gl-num"><bdi dir="ltr">{formatMoney(fromCents(totalCents))}</bdi> ₪</dd></div>
                <div><dt>وُزِّع</dt><dd className="gl-num"><bdi dir="ltr">{formatMoney(fromCents(allocatedCents))}</bdi> ₪</dd></div>
                <div data-tone={remainingCents < 0 ? 'over' : remainingCents > 0 ? 'left' : 'done'}>
                    <dt>{remainingCents < 0 ? 'زيادة' : 'بقي'}</dt>
                    <dd className="gl-num"><bdi dir="ltr">{formatMoney(fromCents(Math.abs(remainingCents)))}</bdi> ₪</dd>
                </div>
                <div className="is-count"><dt>المشتركون</dt><dd className="gl-num">{parts.length}</dd></div>
            </dl>
            <p className="gl-split-note">يُفعَّل التسجيل حين يساوي الموزَّع مبلغ الحوالة، على مشتركَين أو أكثر.</p>
        </aside>

        <div className="gl-dialog-foot gl-sheet-foot">
            <span className="gl-sheet-keys">
                <b className="gl-num">{parts.length}</b> {parts.length === 1 ? 'مشترك' : 'مشتركين'}، موزّع <b className="gl-num">{formatMoney(fromCents(allocatedCents))}</b> من <b className="gl-num">{formatMoney(fromCents(totalCents))}</b> ₪
            </span>
            {onCancel && (
                <Button onPress={onCancel} className="gl-sheet-btn">
                    إلغاء
                </Button>
            )}
            <Button isDisabled={!canSave} onPress={() => setConfirmingSave(true)} className="gl-sheet-btn is-submit">
                <Icon name="check" className="h-[18px] w-[18px]" />
                {parts.length >= 2 ? `تسجيل الدفعة على ${parts.length} مشتركين` : 'تسجيل الدفعة'}
            </Button>
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
        </>
    );
}
