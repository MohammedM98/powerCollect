import { useEffect, useState, useRef } from 'react';
import { router } from '@inertiajs/react';
import { notify } from '@/lib/notify';
import ConfirmDialog from '@/Components/ConfirmDialog';
import LastReadingConfirmDialog from '@/Components/LastReadingConfirmDialog';
import Icon from '@/Components/Icon';
import { useLastReadingEdit } from '@/hooks/useLastReadingEdit';
import { printRowProps } from '@/lib/print';
import { formatCurrency, formatShekels } from '@/lib/currency';
import { calculateCharges, steppedReading } from '@/lib/readings';

/** The details printing can show as columns of their own (see printFieldsProps). */
export const PRINT_FIELDS = [
    { key: 'meterBoxName', label: 'اسم الطبلون' },
    { key: 'meterBoxNumber', label: 'رقم الطبلون' },
    { key: 'fullName', label: 'اسم المشترك' },
    { key: 'phone', label: 'رقم الجوال' },
    { key: 'accountNumber', label: 'رقم الاشتراك' },
    { key: 'subAreaName', label: 'منطقة 2' },
];

export const shortDate = (date) => date.slice(5).split('-').reverse().join('/');

/**
 * Moves from a reading field to the one `step` rows away (1 down, -1 up),
 * skipping the ones that can't be edited. Down past the last field leaves
 * the field; up past the first stays where it is.
 */
export function focusReadingInput(currentInput, step = 1) {
    const inputs = [...document.querySelectorAll('[data-reading-input]:not([disabled])')];
    const target = inputs[inputs.indexOf(currentInput) + step];

    if (target) {
        target.focus();
    } else if (step > 0) {
        currentInput.blur();
    }
}

/**
 * The reading the week starts from. When the actor may edit it (the last
 * week's reading, while no later week is entered), its pencil opens it in
 * place with − and + like the week's own reading (useLastReadingEdit). The
 * week's own reading is entered separately after confirming the baseline.
 */
export function LastReadingCell({ row }) {
    const lastReading = row.lastReading ?? row.initialReading;
    const editor = useLastReadingEdit({
        readingId: lastReading?.id,
        savedValue: row.previousReading,
        floor: lastReading?.previousReading ?? 0,
        previewUrl: lastReading?.previewUrl,
        saveUrl: lastReading?.saveUrl,
        weekStart: lastReading?.isInitial ? lastReading.weekStart : undefined,
        isInitial: lastReading?.isInitial ?? false,
    });

    return (
        <td className="re-last re-number">
            <LastReadingConfirmDialog editor={editor} subscriptionName={row.fullName} />
                <span className="re-last-value">
                    <span className="re-last-number">{row.previousReading}</span>
                    {lastReading?.canEdit && (
                        <button
                            type="button"
                            className="re-last-pencil"
                            onClick={editor.open}
                            aria-label={`تعديل القراءة السابقة لـ ${row.fullName}`}
                            title={lastReading.isInitial ? 'تعديل قراءة بداية الاشتراك لهذا الأسبوع' : `تعديل قراءة الأسبوع ${shortDate(lastReading.weekStart)} – ${lastReading.weekEnd ? shortDate(lastReading.weekEnd) : ''}`}
                        >
                            <Icon name="pencil" />
                        </button>
                    )}
                </span>
        </td>
    );
}

/**
 * One subscription's line for the week. `approvable` (the actor may approve
 * readings) adds a tick box, enabled when this row's reading can be approved.
 */
export function SheetRow({ row, week, approvable, showRecorder, selected, onToggleSelected, onApprove, approving = false }) {
    const savedValue = row.reading && !row.reading.requiresReentry ? String(row.reading.currentReading) : '';
    const [value, setValue] = useState(savedValue);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const inputRef = useRef(null);
    // Set when the arrows or Enter move on from the field: skipping a subscription that way is on purpose.
    const skippedByKey = useRef(false);
    // Set when the field was clicked into and left empty; shown in orange until it is entered or clicked again.
    const [missed, setMissed] = useState(false);
    // Changing an approved reading sends it back for approval, so it waits on "are you sure?".
    const [confirmingApprovedEdit, setConfirmingApprovedEdit] = useState(false);

    const savedState = `${savedValue}|${row.previousReading}`;
    const [shownState, setShownState] = useState(savedState);

    // Pick up the saved value whenever the server sends a fresh row.
    if (shownState !== savedState) {
        setShownState(savedState);
        setValue(savedValue);
    }

    // A reading the server refused is entered again: the field gets the focus back, its number selected,
    // unless the user has already moved on to another field.
    useEffect(() => {
        if (error && !saving && (!document.activeElement || document.activeElement === document.body)) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [error, saving]);

    const isDraft = value !== savedValue;
    const charges = !isDraft && row.reading && !row.reading.requiresReentry ? { ...row.reading, minimumApplies: Number(row.reading.readingFee) < Number(row.minimumPayment) && !row.discount } : calculateCharges(value, row);
    const belowMinimum = charges?.minimumApplies;
    const isSaved = Boolean(row.reading) && !row.reading.requiresReentry && !isDraft && !error;
    // Approved, but its bill was cancelled from the subscription's statement: it is not charged to them.
    const billCancelled = row.reading?.status === 'approved' && row.reading.billed === false;
    // What the amount due notes, on one line under it so the row keeps its height.
    const dueNotes = [
        billCancelled && !isDraft && { text: 'لم تُحمَّل على المشترك' },
        charges?.discountAmount > 0 && charges.consumption >= 0 && { text: `بعد خصم ${formatCurrency(charges.discountAmount)}`, className: 'text-emerald-700 dark:text-emerald-400' },
        belowMinimum && charges.consumption >= 0 && { text: 'الحد الأدنى' },
    ].filter(Boolean);
    // What hovering the field says: why it was refused, that it was left empty, or what was saved.
    const hoverText = error
        ?? (missed ? 'لم تُدخل قراءة هذا المشترك' : null)
        ?? (isSaved
            ? `تم حفظ القراءة (${row.reading.status === 'pending' ? 'بانتظار الاعتماد' : (row.reading.statusLabel ?? row.reading.status)})، الاستهلاك ${charges?.consumption ?? '—'}، المستحق ${charges ? formatCurrency(charges.amountDue) : '—'}`
            : null)
        ?? (row.hasLaterWeek ? 'توجد قراءة لأسبوع لاحق، فلا تُعدَّل هذه القراءة' : null);

    // + and − (the buttons or the keys) move the reading by one kilo; from an empty field they start at the last reading.
    function step(direction) {
        setValue(steppedReading(value, row.previousReading, direction));
        setMissed(false);
        inputRef.current?.focus();
    }

    function save({ confirmed = false } = {}) {
        if (value === '' || value === savedValue || saving) {
            return;
        }

        if (row.reading?.status === 'approved' && !confirmed) {
            setConfirmingApprovedEdit(true);
            return;
        }

        const options = {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: () => setError(null),
            onError: (errors) => setError(Object.values(errors)[0] ?? 'تعذّر حفظ القراءة.'),
        };

        if (row.reading) {
            router.put(`/meter-readings/${row.reading.id}`, { current_reading: value }, options);
        } else {
            router.post('/meter-readings', { subscription_id: row.id, week_start: week, current_reading: value }, options);
        }
    }

    return (
        <tr
            className={`re-row ${selected ? 'is-selected' : ''} ${error ? 'has-error' : ''} ${isDraft ? 'is-draft' : ''} ${row.reading?.unusual ? 'is-unusual' : ''}`}
            {...printRowProps(Object.fromEntries(PRINT_FIELDS.map((field) => [field.key, row[field.key]])))}
        >
            <td className="re-sub">
                <div className="flex items-center gap-3">
                    {approvable && (
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={onToggleSelected}
                            disabled={!row.canApprove}
                            aria-label={`تحديد قراءة ${row.fullName} للاعتماد`}
                            className={row.canApprove ? '' : 'invisible'}
                        />
                    )}
                    <div className="min-w-0">
                        <div className="re-sub-name">
                            <b>{row.fullName}</b>
                            {row.discount && (
                                <span className="re-pill discount" title={`خصم القراءات الأسبوعية: ${row.discount.terms}${row.discount.segment ? `، ${row.discount.segment}` : ''}`}>
                                    خصم
                                </span>
                            )}
                        </div>
                        <p className="re-line text-xs text-gray-500">
                            {row.accountNumber ? `حساب ${row.accountNumber}` : '—'}
                        </p>
                    </div>
                </div>
            </td>
            <LastReadingCell row={row} />
            <td className="re-input-cell">
                <div className="re-input" dir="ltr"><button type="button" tabIndex={-1} className="re-step" aria-label={`إنقاص قراءة ${row.fullName}`} onMouseDown={(e) => e.preventDefault()} onClick={() => step(-1)} disabled={!row.canEdit || saving || (value !== '' && Number(value) <= Number(row.previousReading))}>−</button><input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={row.previousReading}
                    dir="ltr"
                    data-reading-input
                    ref={inputRef}
                    aria-label={`القراءة الحالية لـ ${row.fullName}`}
                    aria-invalid={Boolean(error)}
                    // The reason shows as a flash message when the save fails, and on hover here: the row never grows.
                    title={hoverText ?? undefined}
                    disabled={!row.canEdit || saving}
                    value={value}
                    placeholder={row.canEdit ? 'أدخل القراءة' : row.hasLaterWeek ? 'لها أسبوع لاحق' : '—'}
                    onInput={(e) => {
                        setValue(e.target.value);
                        setMissed(false);
                    }}
                    onFocus={(e) => {
                        skippedByKey.current = false;
                        setMissed(false);
                        e.target.select();
                    }}
                    onBlur={() => {
                        save();

                        // Clicked into and left with nothing entered: a flash message, so the table's rows stay as they are.
                        if (value === '' && savedValue === '' && !skippedByKey.current) {
                            setMissed(true);
                            notify(`لم تُدخل قراءة ${row.fullName}، عُد إلى حقلها وأدخلها.`);
                        }

                        skippedByKey.current = false;
                    }}
                    onKeyDown={(e) => {
                        // The + and − keys step the reading like the buttons, instead of typing a sign.
                        if ((e.key === '+' || e.key === '-') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                            e.preventDefault();
                            step(e.key === '+' ? 1 : -1);
                        }

                        // Enter and the down arrow go to the next subscription, the up arrow to the previous one.
                        if (e.key === 'Enter' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            skippedByKey.current = true;
                            focusReadingInput(e.currentTarget, 1);
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            skippedByKey.current = true;
                            focusReadingInput(e.currentTarget, -1);
                        }
                    }}
                    className={error ? 'has-error' : missed ? 'is-missed' : isSaved ? 'is-saved' : ''}
                /><button type="button" tabIndex={-1} className="re-step" aria-label={`زيادة قراءة ${row.fullName}`} onMouseDown={(e) => e.preventDefault()} onClick={() => step(1)} disabled={!row.canEdit || saving}>+</button></div>
            </td>
            <td className={`re-diff re-number ${charges && charges.consumption < 0 ? 'text-red-600' : 'text-brand-700'}`}>
                {charges ? charges.consumption : '—'}
            </td>
            <td className="re-rate re-number">{formatShekels(row.unitPrice)}</td>
            <td className={`re-fee re-number ${belowMinimum ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {charges ? formatShekels(charges.readingFee) : '—'}
            </td>
            <td className={`re-min re-number ${belowMinimum ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                {formatShekels(row.minimumPayment)}
            </td>
            <td className={`re-due re-number ${billCancelled && !isDraft ? 'text-gray-400' : ''}`}>
                {charges && charges.consumption >= 0 ? <span className={billCancelled && !isDraft ? 'line-through' : ''}>{formatShekels(charges.amountDue)}</span> : '—'}
                {dueNotes.length > 0 && (
                    <p className="re-line text-xs font-normal text-gray-500" title={dueNotes.map((note) => note.text).join('، ')}>
                        {dueNotes.map((note, index) => (
                            <span key={note.text} className={note.className}>
                                {index > 0 && '، '}
                                {note.text}
                            </span>
                        ))}
                    </p>
                )}
            </td>
            <td className="re-status">
                <ConfirmDialog
                    show={confirmingApprovedEdit}
                    onConfirm={() => {
                        setConfirmingApprovedEdit(false);
                        save({ confirmed: true });
                    }}
                    onCancel={() => {
                        setConfirmingApprovedEdit(false);
                        setValue(savedValue);
                    }}
                    title="تعديل قراءة معتمدة؟"
                    message={`قراءة ${row.fullName} معتمدة. تعديلها يعيدها إلى قيد المراجعة ويزيل مبلغها من المعاملات المالية للمشترك حتى يُعاد اعتمادها.`}
                    confirmLabel="نعم، عدّل"
                    cancelLabel="تراجع عن التعديل"
                    icon="alert"
                />
                {saving ? (
                    <span className="text-xs text-gray-500">جارٍ الحفظ...</span>
                ) : row.reading ? (
                    <div className="re-pills">
                        {approvable && row.canApprove && row.reading.status === 'pending' && !row.reading.requiresReentry ? <button type="button" className="re-pill pending re-pill-action" disabled={!isSaved || approving} onClick={() => onApprove(row.reading.id)} title={isSaved ? 'اضغط لمراجعة واعتماد هذه القراءة فقط' : 'احفظ تعديل القراءة أولًا'} aria-label={`اعتماد قراءة ${row.fullName}`}><i />بانتظار الاعتماد<Icon name="check" className="h-3.5 w-3.5" /></button> : <span className={`re-pill ${row.reading.status}`}><i />{row.reading.requiresReentry ? 'بانتظار إدخال الحالية' : row.reading.status === 'pending' ? 'بانتظار الاعتماد' : row.reading.statusLabel}</span>}
                        {billCancelled && !isDraft && (
                            <span className="re-pill unbilled" title="أُلغيت فاتورة هذه القراءة من كشف حساب المشترك، فلا تُحمَّل عليه.">
                                <i />الفاتورة ملغاة
                            </span>
                        )}
                        {row.reading.unusual && (
                            <span
                                className="re-pill unusual"
                                title={`استهلاك ${row.reading.consumption} كيلو، والمعتاد لهذا المشترك ${row.reading.unusual.usual} كيلو في الأسبوع. تأكد من القراءة قبل اعتمادها.`}
                            >
                                <i />غير معتادة
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="re-pill missing"><i />لم تُدخل</span>
                )}
            </td>
            {showRecorder && <td className="re-by">
                {row.reading ? <>
                    <span className="re-line">
                        <b>{row.reading.recordedByName || '—'}</b>
                        {row.reading.approvedByName && (
                            <span className="re-approved-by" title={`اعتمدها ${row.reading.approvedByName}، ${row.reading.approvedAt}`}>
                               ، اعتمدها {row.reading.approvedByName}
                            </span>
                        )}
                    </span>
                    <small><Icon name="clock" />{row.reading.recordedAt}، {row.reading.recordedSource === 'app' ? 'التطبيق' : 'الموقع'}</small>
                </> : <span>—</span>}
            </td>}
        </tr>
    );
}
