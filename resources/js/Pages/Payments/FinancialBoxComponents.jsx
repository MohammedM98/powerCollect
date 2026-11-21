import { Avatar, Button, Chip } from '@heroui/react';
import Icon from '@/Components/UI/Icon';
import { formatMoney } from '@/lib/format';
import { activeBoxEntries, boxPersonName, boxStatus, financialBoxTotals, financialBoxesTotals, isFlaggedEntry } from '@/lib/financialBoxes';
import { boxTypes, boxTypeStyles, currencies } from './CollectorCashBox';
import './financial-boxes.css';

const date = (value) => value ? new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', timeZone: 'Asia/Gaza' }).format(new Date(value)) : '—';
const dateTimeShort = (value) => value ? new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Gaza' }).format(new Date(value)) : '—';

export function financialAmountsLine(amounts) {
    return Object.keys(currencies).filter((currency) => currency === 'ILS' || Number(amounts?.[currency] ?? 0) !== 0).map((currency) => `${formatMoney(amounts?.[currency] ?? 0)} ${currencies[currency]}`).join('، ');
}

function foreignAmounts(amounts) {
    return Object.keys(currencies).filter((currency) => currency !== 'ILS' && amounts[currency]).map((currency) => `${formatMoney(amounts[currency])} ${currencies[currency]}`).join('، ');
}

export function BoxPersonAvatar({ name, small = false }) {
    return <span aria-hidden="true" className={`flex shrink-0 items-center justify-center bg-gray-900 font-semibold text-surface ${small ? 'h-7 w-7 rounded-[9px] text-[11px]' : 'h-8 w-8 rounded-[10px] text-xs'}`}>{name ? name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('') : <Icon name="bank" className="h-4 w-4" />}</span>;
}

/** Each type of box in its movement's colour (theme.css section 4): cash green, transfers blue, clearings teal. */
export const BOX_TONES = { cash: 'pay', bank_transfer: 'split', clearing: 'clearing' };

/** A box's type as its tinted icon, with a dot for its state: blue while open, green once closed. */
export function FinancialBoxMark({ box, large = false }) {
    return (
        <span className={`gl-cb-mark ${large ? 'is-large' : ''}`} data-tone={BOX_TONES[box.type]} aria-hidden="true">
            <Icon name={boxTypeStyles[box.type].icon} className={large ? 'h-5 w-5' : 'h-[18px] w-[18px]'} />
            <i data-state={box.status === 'received' ? 'closed' : 'open'} />
        </span>
    );
}

/** Whose box it is, by their initials on a HeroUI avatar, or a bank for a box with no person. */
export function BoxPerson({ name, suffix = null, note = null }) {
    const initials = name ? name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('') : null;

    return (
        <span className="gl-cb-person">
            <Avatar size="sm" className="gl-cb-avatar">
                <Avatar.Fallback>{initials ?? <Icon name="bank" className="h-4 w-4" />}</Avatar.Fallback>
            </Avatar>
            <span className="min-w-0">
                <b>{name ?? '—'}{suffix && <span className="gl-cb-muted"> {suffix}</span>}</b>
                {note && <small>{note}</small>}
            </span>
        </span>
    );
}

/** A box's state as HeroUI chips: open or closed, and for a closed box whether its audit is approved. */
export function FinancialBoxStatus({ box }) {
    const [label] = boxStatus(box);
    const closed = box.status === 'received';

    return (
        <span className="gl-cb-status">
            <Chip size="sm" className="gl-cb-chip" data-state={closed ? 'closed' : 'open'}>
                <i aria-hidden="true" />
                {label}
            </Chip>
            {closed && 'audit' in box && (
                <Chip size="sm" className="gl-cb-chip" data-state={box.audit ? 'audited' : 'waiting'}>
                    <i aria-hidden="true" />
                    {box.audit ? 'معتمد تدقيقيًا' : 'قيد التدقيق'}
                </Chip>
            )}
        </span>
    );
}

export function FinancialBoxAmount({ box, large = false }) {
    const totals = financialBoxTotals(box);
    const others = foreignAmounts(totals);
    return <><p className="flex flex-wrap items-baseline gap-x-2"><b dir="ltr" className={`font-display text-gray-900 ${large ? 'text-[1.75rem] leading-tight' : 'text-[1.0625rem]'}`}>{formatMoney(totals.ILS)}</b><span className={`${large ? 'text-sm' : 'text-[13px]'} text-gray-600`}>شيكل</span></p><p className={`${large ? 'min-h-[1.4rem]' : ''} font-display text-[13px] text-gray-600`}>{others ? `و${others}` : ''}</p></>;
}

export function FinancialBoxEntries({ box, card = false }) {
    const entries = activeBoxEntries(box);
    const count = box.paymentCount ?? entries.length;
    const cancelled = box.payments ? box.payments.length - entries.length : 0;
    if (box.type === 'cash') {
        const foreign = entries.filter((entry) => entry.currency !== 'ILS').length;
        return <>{!card && <p><b className="font-display text-gray-900">{count}</b> <span className="text-[13px] text-gray-600">حركة{cancelled > 0 ? `، ${cancelled} ملغاة` : ''}</span></p>}<p className="mt-1 flex items-center gap-2 text-[13px] text-gray-600"><Icon name="banknotes" className="h-4 w-4" />{card ? (box.status === 'received' ? 'أُغلق بإجمالي حركاته السارية' : 'يجمع المحصّل النقد') : foreign ? `${foreign} بعملة أجنبية` : 'نقد بالشيكل'}</p></>;
    }
    if (!box.payments) {
        return <p className="text-[13px] text-gray-600"><b className="font-display text-gray-900">{count}</b> حركة{box.rejectedCount ? `، ${box.rejectedCount} مرفوضة` : ''}</p>;
    }
    const flagged = entries.filter(isFlaggedEntry).length;
    const note = <p className="mt-1 flex items-center gap-2 text-[13px] text-gray-600"><Icon name={box.type === 'clearing' ? 'scale' : 'bank'} className="h-4 w-4" />{flagged ? <b className="font-semibold text-brand-600">{flagged} {box.type === 'clearing' ? 'مرفوضة' : 'غير موجودة'}</b> : 'يدقّقها قسم التدقيق بعد الإغلاق'}</p>;
    return card ? note : <><p><b className="font-display text-gray-900">{count}</b> <span className="text-[13px] text-gray-600">حركة{cancelled ? `، ${cancelled} ملغاة` : ''}</span></p>{note}</>;
}

export function FinancialBoxDates({ box }) {
    return <span className="text-sm text-gray-800">{date(box.opened_at)} ← {box.closed_at ? date(box.closed_at) : <span className="text-gray-600">مفتوح</span>}</span>;
}

/** One moment in a box's life, with who did it: opened or closed. */
function TimesLine({ icon, tone, label, at, by }) {
    return <li className="flex items-start gap-2 leading-5"><Icon name={icon} className={`mt-1 h-3.5 w-3.5 shrink-0 ${tone}`} /><span className="min-w-0"><span className="text-gray-500">{label}</span> <b className="whitespace-nowrap font-semibold text-gray-800">{dateTimeShort(at)}</b>{by && <span className="block text-xs text-gray-500">{by}</span>}</span></li>;
}

/** When the box was opened and closed, and who closed it. */
export function FinancialBoxTimes({ box }) {
    const closed = box.status === 'received';

    return <ul className="space-y-1 text-[13px]">
        <TimesLine icon="clock" tone="text-emerald-600 dark:text-emerald-400" label="فُتح" at={box.opened_at} />
        {closed ? <TimesLine icon="lock" tone="text-amber-600 dark:text-amber-400" label="أُغلق" at={box.closedAt ?? box.closed_at} by={box.closedBy} /> : <li className="flex items-center gap-2 text-gray-500"><Icon name="lock" className="h-3.5 w-3.5" />لم يُغلق بعد</li>}
        {box.audit?.audited_at && <TimesLine icon="check" tone="text-emerald-600 dark:text-emerald-400" label="اعتُمد التدقيق" at={box.audit.audited_at} by={box.audit.auditor?.name} />}
    </ul>;
}

/**
 * Whether the actor may review and close the box now: theirs to close,
 * still open, and holding entries (an empty box cannot be
 * closed).
 */
export function canCloseBox(box) {
    return !box.frozen && box.canCount && ['open', 'pending'].includes(box.status) && (box.payments?.length ?? box.paymentCount ?? 0) > 0;
}

/** The box's main action: review and close an open box, or inspect a closed box. */
export function FinancialBoxButton({ box, onOpen, className = '' }) {
    if (canCloseBox(box)) {
        return (
            <Button variant="outline" size="sm" onPress={() => onOpen(box)} className={`gl-cb-btn is-close ${className}`}>
                <Icon name="lock" className="h-4 w-4" />
                مراجعة وإغلاق
            </Button>
        );
    }

    return (
        <Button variant="secondary" size="sm" onPress={() => onOpen(box)} className={`gl-cb-btn ${className}`}>
            <Icon name="eye" className="h-4 w-4" />
            عرض الصندوق
        </Button>
    );
}

/** A box as a tile, for the cards view: its type and number, whose it is, its total, its state and its button. */
export function FinancialBoxCard({ box, period, onOpen }) {
    const count = box.paymentCount ?? activeBoxEntries(box).length;
    const totals = financialBoxTotals(box);
    const others = foreignAmounts(totals);

    return (
        <article className="gl-cb-card" data-status={box.status}>
            <header>
                <FinancialBoxMark box={box} large />
                <span className="min-w-0">
                    <b>صندوق <bdi dir="ltr">{box.number}</bdi></b>
                    <small>{boxTypeStyles[box.type].label}{period && period !== '—' ? `، ${period}` : ''}{box.branchName ? `، ${box.branchName}` : ''}</small>
                </span>
            </header>
            <BoxPerson name={boxPersonName(box)} note={`${count} حركة`} />
            <div className="gl-cb-card-amount">
                <small>إجمالي الحركات السارية</small>
                <b><bdi dir="ltr">{formatMoney(totals.ILS)}</bdi> <span>شيكل</span></b>
                {others && <small>و{others}</small>}
            </div>
            <FinancialBoxEntries box={box} card />
            <footer>
                <FinancialBoxStatus box={box} />
                {!('closedAt' in box) ? <FinancialBoxDates box={box} /> : <FinancialBoxTimes box={box} />}
            </footer>
            <FinancialBoxButton box={box} onOpen={onOpen} className="gl-cb-full" />
        </article>
    );
}

/** The collector's open boxes above their history: all of them, then each type, as tiles in its colour. */
export function FinancialBoxSummary({ boxes, pageOnly = false }) {
    const open = boxes.filter((box) => box.status !== 'received');
    const cells = [{ key: 'open', icon: 'unlock', tone: null, label: 'الصناديق المفتوحة', boxes: open }, ...Object.keys(boxTypes).map((type) => ({ key: type, icon: boxTypeStyles[type].icon, tone: BOX_TONES[type], label: boxTypes[type], boxes: open.filter((box) => box.type === type), unconfirmed: true }))];

    return (
        <section aria-label="ملخص الصناديق" className="gl-cb-tiles is-four">
            {cells.map((cell) => (
                <article key={cell.key} className="gl-cb-tile" data-tone={cell.tone ?? undefined}>
                    <span className="gl-cb-tile-icon" aria-hidden="true"><Icon name={cell.icon} className="h-5 w-5" /></span>
                    <small>{cell.label}</small>
                    <b><bdi dir="ltr">{formatMoney(financialBoxesTotals(cell.boxes).ILS)}</bdi> <span>₪</span></b>
                    <span>{cell.boxes.length} صناديق{cell.unconfirmed ? ' لم تُغلق بعد' : ''}{pageOnly ? ' في هذه الصفحة' : ''}</span>
                </article>
            ))}
        </section>
    );
}
