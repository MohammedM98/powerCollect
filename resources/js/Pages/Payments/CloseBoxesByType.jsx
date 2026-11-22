import { Button } from '@heroui/react';
import { useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import Icon from '@/Components/UI/Icon';
import DialogFrame from '@/Components/UI/DialogFrame';
import { formatMoney } from '@/lib/format';
import { boxTypes, boxTypeStyles, BoxTypeIcon } from './CollectorCashBox';
import { BoxPersonAvatar, financialAmountsLine } from './FinancialBoxComponents';
import { financialBoxesTotals } from '@/lib/financialBoxes';
import BoxBreakdown from './BoxBreakdown';
import { CheckBox, ConfirmDialog, Notice, PrimaryKey, SecondaryKey } from '@/Components/UI';

/**
 * Closes the open boxes of one type the closer ticks, together, for those
 * who may confirm the branch's boxes closed: the type, then its open boxes
 * (one person's when the entries are narrowed to them) to tick, then the
 * ticked boxes' entries summed up by bank, service or currency paid, and,
 * for cash, the confirmation that the cash was counted. A row of steps
 * under the title shows where the closer is and what is left to do.
 */
export default function CloseBoxesByType({ boxes, branchId, userId, initialType, actionsUrl, onClose }) {
    const { errors } = usePage().props;
    const types = Object.keys(boxTypes);
    const [type, setType] = useState(initialType && types.includes(initialType) ? initialType : (types.find((value) => boxes.some((box) => box.type === value)) ?? types[0]));
    const [cashCounted, setCashCounted] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const shown = boxes.filter((box) => box.type === type);
    const selected = shown.filter((box) => selectedIds.includes(box.id));
    const allSelected = shown.length > 0 && selected.length === shown.length;
    const cash = type === 'cash';
    const totals = financialBoxesTotals(selected);
    const ready = selected.length > 0 && (!cash || cashCounted);
    const sections = { type: useRef(null), boxes: useRef(null), review: useRef(null) };
    const steps = [
        { key: 'type', label: 'نوع الصندوق', detail: boxTypeStyles[type].label, done: true },
        { key: 'boxes', label: 'اختيار الصناديق', detail: selected.length ? (selected.length === 1 ? 'صندوق واحد مختار' : `${selected.length} صناديق مختارة`) : 'لم تختر بعد', done: selected.length > 0 },
        { key: 'review', label: 'المراجعة والتأكيد', detail: !selected.length ? 'بعد اختيار الصناديق' : ready ? 'جاهز للإغلاق' : 'أكّد عدّ النقد', done: ready },
    ];
    const current = selected.length ? 'review' : 'boxes';

    function pickType(value) {
        setType(value);
        setSelectedIds([]);
        setCashCounted(false);
    }

    function toggle(id) {
        setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
        setCashCounted(false);
    }

    function toggleAll() {
        setSelectedIds(allSelected ? [] : shown.map((box) => box.id));
        setCashCounted(false);
    }

    function submit() {
        router.post(`${actionsUrl}/receive-type`, { branch_id: branchId, type, box_ids: selected.map((box) => box.id), cash_counted: cash && cashCounted }, {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => onClose(),
        });
    }

    const footer = (
        <div className="w-full space-y-3">
            {cash && selected.length > 0 && (
                <Notice tone="success">
                    <label className="flex cursor-pointer items-start gap-3">
                        <CheckBox checked={cashCounted} onChange={(event) => setCashCounted(event.target.checked)} />
                        <span>عددتُ نقد كل صندوق من الصناديق المختارة ووجدته مطابقًا لإجماليه: <strong>{financialAmountsLine(totals)}</strong></span>
                    </label>
                </Notice>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-(--ma-muted)">{selected.length ? <>{selected.length === 1 ? 'صندوق واحد مختار' : <><b className="font-display text-(--ma-ink)">{selected.length}</b> صناديق مختارة</>}، <b className="text-(--ma-ink)">{financialAmountsLine(totals)}</b></> : 'لم تختر أي صندوق بعد'}</p>
                <div className="flex flex-wrap items-center gap-2">
                    <SecondaryKey onClick={onClose}>إلغاء</SecondaryKey>
                    <PrimaryKey type="button" disabled={processing || !selected.length || (cash && !cashCounted)} onClick={() => setConfirming(true)}><Icon name="check" className="h-4 w-4" />{selected.length === 1 ? 'تأكيد إغلاق الصندوق' : selected.length ? `تأكيد إغلاق ${selected.length} صناديق` : 'تأكيد الإغلاق'}</PrimaryKey>
                </div>
            </div>
        </div>
    );

    return <>
        <DialogFrame
            show
            onClose={onClose}
            title="إغلاق الصناديق حسب النوع"
            description={`اختر النوع ثم الصناديق المفتوحة${userId ? ' للموظف المختار' : ''} التي تريد إغلاقها، وراجع ملخصها قبل التأكيد. بعد التأكيد تُقفل حركاتها وتذهب إلى التدقيق.`}
            icon="lock"
            maxWidth="3xl"
            busy={processing}
            footer={footer}
        >
            <CloseSteps steps={steps} current={current} onGo={(key) => sections[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />

            <section ref={sections.type} aria-label="نوع الصندوق" className="scroll-mt-4 space-y-3">
                <StepHeading number={1} title="اختر نوع الصندوق" done />
                <div role="group" aria-label="نوع الصندوق" className="grid gap-2 sm:grid-cols-3">
                    {types.map((value) => {
                        const ofType = boxes.filter((box) => box.type === value);
                        const chosen = value === type;
                        return <Button data-raw="" variant="ghost" key={value} aria-pressed={chosen} onClick={() => pickType(value)} className={`flex items-center gap-3 rounded-[16px] p-3 text-start transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--ma-ink) ${chosen ? 'bg-(--ma-solid) shadow-(--ma-depth) ring-2 ring-(--ma-ink)' : 'bg-(--ma-tile) shadow-(--ma-hl)'}`}>
                            <span className="relative shrink-0"><BoxTypeIcon type={value} className="h-10 w-10" />{chosen && <span className="absolute -inset-e-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--ma-ink) text-(--ma-solid) ring-2 ring-(--ma-solid)"><Icon name="check" className="h-2.5 w-2.5" strokeWidth={3} /></span>}</span>
                            <span className="min-w-0">
                                <span className="block font-semibold text-(--ma-ink)">{boxTypeStyles[value].label}</span>
                                <span className="block truncate text-xs text-(--ma-muted)"><b className="font-display text-(--ma-ink)">{ofType.length}</b> صناديق، <bdi dir="ltr" className="font-display">{formatMoney(financialBoxesTotals(ofType).ILS)}</bdi> شيكل</span>
                            </span>
                        </Button>;
                    })}
                </div>
            </section>

            {errors?.action && <Notice tone="danger" role="alert">{errors.action}</Notice>}

            <section ref={sections.boxes} aria-label="الصناديق المفتوحة" className="scroll-mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <StepHeading number={2} title="اختر الصناديق" done={selected.length > 0} active={current === 'boxes'} hint={`${selected.length} من ${shown.length}`} />
                    {shown.length > 1 && <SecondaryKey onClick={toggleAll}>{allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</SecondaryKey>}
                </div>
                {!shown.length ? <p className="rounded-[16px] border border-dashed border-(--ma-line) p-6 text-center text-sm text-(--ma-muted)">لا توجد صناديق مفتوحة من هذا النوع يمكنك إغلاقها.</p> : <ul className="grid gap-2 sm:grid-cols-2">
                    {shown.map((box) => {
                        const picked = selectedIds.includes(box.id);
                        return <li key={box.id}>
                            <CheckBox checked={picked} onChange={() => toggle(box.id)} aria-label={`اختيار صندوق ${box.number}`} showControl={false} className={`block w-full cursor-pointer rounded-[16px] p-3 text-start transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--ma-ink) ${picked ? 'bg-(--ma-solid) shadow-(--ma-depth) ring-2 ring-(--ma-ink)' : 'bg-(--ma-tile) shadow-(--ma-hl)'}`}>
                                <span className="flex w-full items-center gap-3">
                                    <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition ${picked ? 'border-(--ma-ink) bg-(--ma-ink) text-(--ma-solid)' : 'border-(--ma-faint)'}`}>{picked && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                                    <BoxPersonAvatar name={box.person} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold text-(--ma-ink)">{box.person ?? '—'}</span>
                                        <span className="block text-xs text-(--ma-muted)">صندوق <bdi dir="ltr" className="font-display">{box.number}</bdi>، <b className="font-display text-(--ma-ink)">{box.count}</b> حركة</span>
                                    </span>
                                    <span className="shrink-0 text-end"><bdi dir="ltr" className="block font-display font-bold text-(--ma-ink)">{formatMoney(financialBoxesTotals([box]).ILS)}</bdi><span className="text-xs text-(--ma-muted)">₪</span></span>
                                </span>
                            </CheckBox>
                        </li>;
                    })}
                </ul>}
            </section>

            {shown.length > 0 && <section ref={sections.review} aria-label="المراجعة والتأكيد" className="scroll-mt-4 space-y-3">
                <StepHeading number={3} title="راجع الملخص ثم أكّد الإغلاق" done={ready} active={current === 'review'} hint={selected.length && cash && !cashCounted ? 'أكّد عدّ النقد في الأسفل' : undefined} />
                {selected.length ? <BoxBreakdown type={type} entries={selected.flatMap((box) => box.entries ?? [])} /> : <p className="flex items-center gap-3 rounded-[16px] border border-dashed border-(--ma-line) p-4 text-sm text-(--ma-muted)"><Icon name="list" className="h-5 w-5 shrink-0 text-(--ma-faint)" />اختر صندوقًا أو أكثر ليظهر ملخصه {type === 'bank_transfer' ? 'حسب البنك' : type === 'clearing' ? 'حسب الخدمة' : 'حسب عملة الدفع'} قبل الإغلاق.</p>}
            </section>}
        </DialogFrame>
        <ConfirmDialog
            show={confirming}
            onCancel={() => setConfirming(false)}
            onConfirm={() => { setConfirming(false); submit(); }}
            title={selected.length === 1 ? 'إغلاق الصندوق؟' : `إغلاق ${selected.length} صناديق؟`}
            message={<>{selected.length === 1 ? 'سيُغلق صندوق' : `ستُغلق ${selected.length} صناديق`} {boxTypeStyles[type].label} ({[...new Set(selected.map((box) => box.person ?? '—'))].join('، ')}) بإجمالي <b className="text-(--ma-ink)">{financialAmountsLine(totals)}</b>.{cash ? ' وأنت تؤكد أنك عددت نقد كل صندوق ووجدته مطابقًا لإجماليه.' : ''} بعد الإغلاق تُقفل حركاتها فلا يستطيع المحصّل تعديلها، وتنتقل إلى قسم التدقيق.</>}
            confirmLabel={selected.length === 1 ? 'نعم، أغلق الصندوق' : `نعم، أغلق ${selected.length} صناديق`}
            icon="lock"
        />
    </>;
}

/**
 * Where the closer is: the three steps of closing boxes by type, each done
 * (a check), the current one (dark) or still ahead (quiet), with what was
 * chosen in it; a step takes the closer to its part of the window.
 */
function CloseSteps({ steps, current, onGo }) {
    return <ol aria-label="خطوات الإغلاق" className="grid w-full grid-cols-3 gap-2">
        {steps.map((step, index) => {
            const active = step.key === current;
            const state = active ? 'current' : step.done ? 'done' : 'ahead';
            return <li key={step.key} className="min-w-0">
                <Button data-raw="" variant="ghost" onClick={() => onGo(step.key)} aria-current={active ? 'step' : undefined} className={`flex w-full min-w-0 items-center justify-center gap-3 rounded-[14px] px-3 py-2 text-start sm:justify-start transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--ma-ink) ${state === 'current' ? 'bg-(--ma-act) text-white shadow-(--ma-depth)' : state === 'done' ? 'bg-(--ma-pay-s)' : 'bg-(--ma-tile) shadow-(--ma-hl)'}`}>
                    <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${state === 'current' ? 'bg-(--ma-solid) text-(--ma-ink)' : state === 'done' ? 'bg-(--ma-pay-btn) text-white' : 'bg-(--ma-solid) text-(--ma-muted)'}`}>{step.done ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : index + 1}</span>
                    <span className="sr-only min-w-0 sm:not-sr-only">
                        <span className={`block truncate text-sm font-bold ${state === 'current' ? 'text-white' : state === 'done' ? 'text-(--ma-ink)' : 'text-(--ma-muted)'}`}>{step.label}</span>
                        <span className={`hidden truncate text-xs sm:block ${state === 'current' ? 'text-white/75' : 'text-(--ma-muted)'}`}>{step.detail}</span>
                    </span>
                    <span className="sr-only">{active ? '(الخطوة الحالية)' : step.done ? '(مكتملة)' : '(لاحقًا)'}</span>
                </Button>
            </li>;
        })}
    </ol>;
}

/** A step's title in the window, numbered as in the steps row, checked once it is done. */
function StepHeading({ number, title, done = false, active = false, hint }) {
    return <h3 className="flex items-center gap-2 font-bold text-(--ma-ink)">
        <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${done ? 'bg-(--ma-pay-btn) text-white' : active ? 'bg-(--ma-act) text-white' : 'bg-(--ma-tile) text-(--ma-muted)'}`}>{done ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> : number}</span>
        {title}
        {hint && <span className="text-sm font-normal text-(--ma-muted)">({hint})</span>}
    </h3>;
}
