import { Fragment } from 'react';
import Icon from '@/Components/Icon';
import InfoTip from '@/Components/InfoTip';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { describeBalance, describedBalanceText } from '@/lib/accountStatement';
import { BALANCE_CHIP_CLASSES } from '@/lib/balance';
import { formatMoney, initials } from '@/lib/format';

/**
 * The pieces the payment, charge, discount and clearing windows share:
 * the window's frame (a pop-up the height of the screen at most), the
 * movement card under its title, numbered steps, labels, choice tiles, the
 * big amount box, and the done screen after saving.
 */

const STATUS_DOTS = { active: 'bg-emerald-500', suspended: 'bg-amber-500', disconnected: 'bg-gray-400' };

/** A balance's chip, by its tone (see lib/balance.js). */
export const BALANCE_CHIPS = BALANCE_CHIP_CLASSES;

/** Each tone's selected tile and header icon: red for a charge (عليه), green for a discount (له), graphite otherwise. */
const TONES = {
    red: {
        tile: 'border-brand-500 shadow-[0_0_0_4px_rgb(var(--brand-500)/0.12)]',
        icon: 'bg-brand-gradient text-white',
        dot: 'border-brand-500 bg-brand-500',
    },
    green: {
        tile: 'border-emerald-600 shadow-[0_0_0_4px_rgb(var(--success-600)/0.12)]',
        icon: 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white',
        dot: 'border-emerald-600 bg-emerald-600',
    },
    amber: {
        tile: 'border-amber-600 shadow-[0_0_0_4px_rgb(var(--warning-600)/0.12)]',
        icon: 'bg-gradient-to-br from-amber-500 to-amber-700 text-white',
        dot: 'border-amber-600 bg-amber-600',
    },
    graphite: {
        tile: 'border-gray-900 shadow-[0_0_0_4px_rgb(var(--gray-900)/0.07)]',
        icon: 'bg-graphite-gradient text-white',
        dot: 'border-gray-900 bg-gray-900',
    },
};

/** A described balance (describeBalance()) as text: "7,178 ₪", "-9.10 ₪" or "0 ₪" (lib/accountStatement.js). */
export function balanceText(balance) {
    return describedBalanceText(balance);
}

/** A field's label, as FormField draws it: the star when required, the guidance (`hint`) behind an "!". */
export function FieldLabel({ htmlFor, required = false, hint, children }) {
    return (
        <div className="mb-2 flex items-center gap-1">
            <InputLabel htmlFor={htmlFor}>
                {children}
                {required && <span className="text-brand-500"> *</span>}
            </InputLabel>
            {hint && <InfoTip label={`عن حقل ${typeof children === 'string' ? children : ''}`.trim()}>{hint}</InfoTip>}
        </div>
    );
}

/** The colour each kind of movement is drawn in, from components.css: the main button's blue, red for what is added on, green for what comes off, amber for a correction. */
export const MOVEMENT_TONES = {
    payment: 'rgb(var(--gl-btn))',
    charge: 'var(--gl-bad)',
    credit: 'var(--gl-ok)',
    correction: 'var(--gl-warn)',
};

/** A balance's colour on the movement card: red while owed, green in credit, plain when settled. */
const CELL_COLORS = { owes: 'var(--gl-bad)', credit: 'var(--gl-ok)', settled: 'var(--gl-ink)' };

/**
 * The three cells of a movement that changes the balance: the balance now,
 * the movement (`sign` -1 takes it off, 1 adds it on) and the balance it
 * leaves, coloured as balances are everywhere. `amount` null leaves the
 * result blank.
 *
 * @param {{ balance: number|string, balanceLabel?: string, amount: number|null, sign: -1|1, moveLabel: string, moveNote?: string, afterLabel?: string }} movement
 * @returns {Array<{ label: string, value: string, note?: string, color?: string, move?: boolean, result?: boolean }>}
 */
export function balanceCells({ balance, balanceLabel = 'الرصيد الحالي', amount, sign, moveLabel, moveNote = '', afterLabel = 'الرصيد بعدها' }) {
    const before = describeBalance(balance);
    const after = amount === null ? null : describeBalance(Number(balance) + sign * amount);

    return [
        { label: balanceLabel, value: balanceText(before), note: before.label, color: CELL_COLORS[before.tone] },
        { label: moveLabel, value: `${sign < 0 ? '−' : '+'} ${formatMoney(amount ?? 0)} ₪`, note: moveNote, move: true },
        { label: afterLabel, value: after ? balanceText(after) : '—', note: after?.label ?? '', color: after ? CELL_COLORS[after.tone] : 'var(--gl-faint)', result: true },
    ];
}

/**
 * The movement card under a form's title, in place of the old panel beside
 * the form: who the movement is for, then its cells in a row with the
 * signs between them (`ops`, e.g. ['−', '=']), updating as figures are
 * typed. `tone` is one of MOVEMENT_TONES; `children` go under the cells
 * (a coverage bar, a saving).
 */
export function MovementCard({ subscription, tone = 'payment', tag = null, cells, ops = [], children = null }) {
    return (
        <section className="gl-mv" aria-live="polite" aria-label="بطاقة الحركة" style={{ '--gl-t': MOVEMENT_TONES[tone] ?? tone }}>
            <div className="gl-mv-who">
                <span className="gl-mv-avatar" aria-hidden="true">
                    {initials(subscription.fullName)}
                    <i className={STATUS_DOTS[subscription.status] ?? 'bg-gray-400'} />
                </span>
                <div className="min-w-0">
                    <b>{subscription.fullName}</b>
                    <small>
                        حساب <bdi dir="ltr" className="gl-num">{subscription.accountNumber}</bdi>
                        {subscription.meterBoxNumber && ` · طبلون ${subscription.meterBoxNumber}`}
                        {subscription.branchName && ` · ${subscription.branchName}`}
                    </small>
                </div>
                {tag && <span className="gl-mv-tag">{tag}</span>}
            </div>
            <div className="gl-mv-cells" data-count={cells.length}>
                {cells.map((cell, index) => (
                    <Fragment key={cell.label}>
                        {index > 0 && ops[index - 1] && <span className="gl-mv-op" aria-hidden="true">{ops[index - 1]}</span>}
                        <div className={`gl-mv-cell ${cell.move ? 'is-move' : ''} ${cell.result ? 'is-result' : ''}`} style={cell.color ? { '--gl-cell': cell.color } : undefined}>
                            <small>{cell.label}</small>
                            <b className="gl-num"><bdi dir="ltr">{cell.value}</bdi></b>
                            {cell.note && <em>{cell.note}</em>}
                        </div>
                    </Fragment>
                ))}
            </div>
            {children}
        </section>
    );
}

/** How much of what is owed a movement covers, as a bar under the cells. */
export function CoverageBar({ amount, owed }) {
    if (!(owed > 0)) {
        return null;
    }

    const coverage = Math.min(100, Math.round(((amount ?? 0) / owed) * 100));

    return (
        <div className="gl-mv-cover">
            <div className="gl-kv"><span>تغطية المستحق</span><b className="gl-num">{coverage}%</b></div>
            <div className="gl-bar" aria-hidden="true"><i style={{ width: `${coverage}%`, background: 'var(--gl-t)' }} /></div>
        </div>
    );
}

/**
 * One step of a form, numbered in the order it is filled in; `done` fills
 * its number with the form's colour once it has what it needs.
 */
export function FormStep({ number, title, hint = null, done = false, children }) {
    return (
        <div className="gl-step" data-done={done || undefined}>
            <span className="gl-step-n" aria-hidden="true">{done ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} /> : number}</span>
            <h4>{title}{hint && <small>{hint}</small>}</h4>
            <div className="gl-step-body">{children}</div>
        </div>
    );
}

/** The classes of a form window: a column the height of the screen at most, its steps scrolling between the fixed top and bottom. */
export const SHEET_FORM_CLASS = 'gl-sheet flex min-h-0 flex-col';

/** The scrolling part of a form window, between the movement card and the footer. */
export function SheetBody({ children }) {
    return <div className="gl-sheet-body">{children}</div>;
}

/**
 * One choice as a big radio tile, in the form's tone. `stacked` puts the
 * icon above the words (three in a row); `shortcut` is the number key
 * that picks it.
 */
export function ChoiceTile({ name, value, checked, onChange, icon, title, hint, tone = 'graphite', stacked = false, shortcut = null }) {
    const look = TONES[tone];

    return (
        <label
            className={`relative flex cursor-pointer gap-3 rounded-[18px] border-[1.5px] bg-surface px-4 py-3.5 text-start transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gray-900 ${
                stacked ? 'items-center sm:flex-col sm:items-start sm:gap-2 sm:px-3.5' : 'items-center'
            } ${checked ? look.tile : 'border-gray-200 hover:border-gray-300'}`}
        >
            <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
            <span
                className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] transition ${checked ? look.icon : 'bg-gray-100 text-gray-700'}`}
            >
                <Icon name={icon} className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
                <b className="block text-[15.5px] text-gray-900">{title}</b>
                {hint && <small className="block text-[13px] leading-snug text-gray-500">{hint}</small>}
            </span>
            <span
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition ${
                    stacked ? 'ms-auto sm:absolute sm:end-3 sm:top-3 sm:ms-0' : 'ms-auto'
                } ${checked ? look.dot : 'border-gray-300'}`}
                aria-hidden="true"
            >
                {checked && <span className="h-2 w-2 rounded-full bg-surface" />}
            </span>
            {shortcut && (
                <span
                    className="absolute end-11 top-3 hidden rounded-md border border-gray-100 bg-surface px-1.5 font-display text-[11px] font-semibold leading-5 text-gray-500 sm:inline-block"
                    aria-hidden="true"
                >
                    {shortcut}
                </span>
            )}
        </label>
    );
}

/**
 * The big amount field: the number, its unit beside it, and a footer of
 * quick picks (`children`). Red while `error` is set.
 */
export function AmountBox({ id, inputRef, value, onChange, unit, placeholder = '0', label, error = false, autoFocus = false, readOnly = false, children }) {
    return (
        <div
            className={`rounded-[22px] border-[1.5px] bg-surface px-[18px] pb-3.5 pt-4 transition ${
                error
                    ? 'border-brand-500 shadow-[0_0_0_5px_rgb(var(--brand-500)/0.08)]'
                    : 'border-gray-200 focus-within:border-brand-500 focus-within:shadow-[0_0_0_5px_rgb(var(--brand-500)/0.12)]'
            }`}
        >
            <div className="flex items-center gap-3.5">
                <input
                    ref={inputRef}
                    autoFocus={autoFocus}
                    id={id}
                    name={id}
                    required
                    inputMode="decimal"
                    autoComplete="off"
                    dir="ltr"
                    placeholder={placeholder}
                    aria-label={label}
                    value={value}
                    readOnly={readOnly}
                    onChange={onChange}
                    className="w-full min-w-0 flex-1 border-0 bg-transparent p-0 text-end font-display text-[34px] font-extrabold leading-tight text-gray-900 placeholder:text-gray-300 focus:ring-0 sm:text-[44px]"
                />
                <span className="flex h-12 min-w-16 shrink-0 flex-col items-center justify-center rounded-[14px] border border-gray-100 bg-gray-100 px-3.5 font-display text-xl font-extrabold leading-none text-gray-700">
                    {unit}
                </span>
            </div>
            {children && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-gray-200 pt-3">{children}</div>}
        </div>
    );
}

/** A quick value under the amount; `tone="green"` marks the one that settles everything. */
export function QuickPick({ onClick, tone = null, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-3 py-1 text-[13.5px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 ${
                tone === 'green'
                    ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200 hover:bg-surface hover:text-gray-900'
            }`}
        >
            {children}
        </button>
    );
}

/** An amber note under a field, or red with `bad`. */
export function FieldWarning({ bad = false, children }) {
    return (
        <p
            className={`mt-2.5 flex items-start gap-2.5 rounded-[14px] border px-3 py-2.5 text-[13.5px] leading-relaxed ${
                bad ? 'border-brand-500/30 bg-brand-500/5 text-brand-600' : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
            }`}
        >
            <Icon name="warning" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
            <span>{children}</span>
        </p>
    );
}

/** After saving: what was recorded, as a receipt, with its voucher to print (`printUrl`), "another" and "done". */
export function DoneScreen({ tone = 'green', title, text, rows, anotherLabel, onAnother, onDone, printUrl = null }) {
    return (
        <div role="dialog" aria-modal="true" aria-label={title} className="px-6 pb-8 pt-10 text-center sm:px-8">
            <span
                className={`mx-auto mb-3.5 flex h-[76px] w-[76px] items-center justify-center rounded-3xl ${
                    tone === 'red'
                        ? 'bg-brand-500/10 text-brand-600'
                        : tone === 'amber'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}
            >
                <Icon name="check" className="h-10 w-10" strokeWidth={2.2} />
            </span>
            <h3 className="font-luxe text-[26px] font-bold text-gray-900">{title}</h3>
            <p className="mt-1.5 text-gray-600">{text}</p>
            <dl className="mx-auto mt-6 w-full max-w-[420px] rounded-[20px] border border-gray-100 bg-gray-50 px-[18px] py-1.5 text-start">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-dashed border-gray-200 py-2.5 text-[14.5px] last:border-0">
                        <dt className="text-gray-500">{label}</dt>
                        <dd className="font-semibold text-gray-900">{value}</dd>
                    </div>
                ))}
            </dl>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                {printUrl && (
                    <SecondaryButton onClick={() => window.open(printUrl, '_blank')} title="يُفتح السند في نافذة جديدة جاهزًا للطباعة" className="tone-print h-12 rounded-[14px] px-5 text-[15.5px]">
                        <Icon name="printer" className="h-[18px] w-[18px]" />
                        طباعة السند
                    </SecondaryButton>
                )}
                {onAnother && (
                    <SecondaryButton onClick={onAnother} className="h-12 rounded-[14px] px-5 text-[15.5px]">
                        <Icon name="plus" className="h-[18px] w-[18px]" strokeWidth={2} />
                        {anotherLabel}
                    </SecondaryButton>
                )}
                <PrimaryButton type="button" onClick={onDone} autoFocus className="h-12 min-w-28 rounded-[14px] px-5 text-[15.5px]">
                    تم
                </PrimaryButton>
            </div>
        </div>
    );
}

/** The soft tint behind each form tone's header icon (components.css `gl-tone`). */
const HEADER_TONES = { red: 'gl-tone-bad', green: 'gl-tone-ok', amber: 'gl-tone-warn', graphite: 'gl-tone-brand', payment: 'gl-tone-brand' };

/** The window's header: its icon in the form's tone, title and one line under it, and close. */
export function FormHeader({ titleId, icon, tone = 'graphite', title, subtitle, onClose }) {
    return (
        <div className="gl-dialog-head flex shrink-0 items-center gap-3.5 px-5 py-4 sm:px-6">
            <span className={`gl-tone flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${HEADER_TONES[tone] ?? HEADER_TONES.graphite}`}>
                <Icon name={icon} className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
                <h3 id={titleId} className="text-[20px] font-extrabold leading-tight !font-[family-name:var(--gl-head)]">
                    {title}
                </h3>
                <p className="gl-sub mt-0.5 !text-[13px]">{subtitle}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="إغلاق" className="gl-ib ms-auto">
                <Icon name="close" className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
        </div>
    );
}

/** The save button's colour for each form tone. */
const SUBMIT_TONES = { green: 'var(--success-700)', amber: 'var(--warning-700)', red: 'var(--danger-700)' };

/** The window's footer, fixed under the steps: cancel, the shortcuts, and the save button in the form's tone naming what it saves. */
export function FormFooter({ onCancel, submitLabel, disabled, processing, tone = 'red', shortcuts = null }) {
    return (
        <div className="gl-dialog-foot flex shrink-0 items-center gap-3 px-5 py-4 sm:px-6">
            <SecondaryButton onClick={onCancel} className="gl-lg">
                إلغاء
            </SecondaryButton>
            <span className="gl-sub hidden items-center gap-1.5 !text-[12.5px] xl:flex">
                <span className="kbd" dir="ltr">
                    Ctrl + Enter
                </span>
                للحفظ{shortcuts && <> · {shortcuts}</>}
            </span>
            <button
                type="submit"
                disabled={disabled || processing}
                className="gl-btn gl-lg ms-auto min-w-0 flex-1 sm:min-w-[230px] sm:flex-none"
                style={SUBMIT_TONES[tone] ? { '--gl-btn': SUBMIT_TONES[tone] } : undefined}
            >
                <Icon name="check" className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {processing ? 'جارٍ الحفظ...' : submitLabel}
            </button>
        </div>
    );
}
