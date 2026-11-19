import { Fragment } from 'react';
import { Button, Input, Radio, RadioGroup } from '@heroui/react';
import Icon from '@/Components/Icon';
import InfoTip from '@/Components/InfoTip';
import InputLabel from '@/Components/InputLabel';
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

/**
 * The colour each kind of movement is drawn in (theme.css section 4): a
 * payment green, a charge red, a discount violet, a clearing teal, a
 * correction amber. `credit` is a discount's old name.
 */
export const MOVEMENT_TONES = {
    payment: 'rgb(var(--tone-pay-ink))',
    charge: 'rgb(var(--tone-charge-ink))',
    discount: 'rgb(var(--tone-discount-ink))',
    credit: 'rgb(var(--tone-discount-ink))',
    clearing: 'rgb(var(--tone-clearing-ink))',
    correction: 'var(--gl-warn)',
};

/** Each kind of movement's solid colour, for its save button. */
const MOVEMENT_SOLIDS = {
    payment: 'rgb(var(--tone-pay-solid))',
    charge: 'rgb(var(--tone-charge-solid))',
    discount: 'rgb(var(--tone-discount-solid))',
    credit: 'rgb(var(--tone-discount-solid))',
    clearing: 'rgb(var(--tone-clearing-solid))',
    correction: 'rgb(var(--warning-600))',
};

/** The colours a money form's parts read (`--gl-t` for text and rings, `--gl-t-solid` for its save button), for its `style`. */
export function movementStyle(tone) {
    return { '--gl-t': MOVEMENT_TONES[tone] ?? tone, '--gl-t-solid': MOVEMENT_SOLIDS[tone] ?? 'rgb(var(--action))', '--gl-t-ink': '#fff' };
}

/** A balance's colour on the movement card: red while owed, green in credit, plain when settled. */
const CELL_COLORS = { owes: 'var(--gl-bad)', credit: 'var(--gl-ok)', settled: 'var(--gl-ink)' };

/**
 * The three cells of a movement that changes the balance: the balance now,
 * the movement (`sign` -1 takes it off, 1 adds it on) and the balance it
 * leaves, coloured as balances are everywhere. `amount` null counts as
 * nothing yet, so the result starts at the balance now.
 *
 * @param {{ balance: number|string, balanceLabel?: string, amount: number|null, sign: -1|1, moveLabel: string, moveNote?: string, afterLabel?: string }} movement
 * @returns {Array<{ label: string, value: string, note?: string, color?: string, move?: boolean, result?: boolean }>}
 */
export function balanceCells({ balance, balanceLabel = 'الرصيد الحالي', amount, sign, moveLabel, moveNote = '', afterLabel = 'الرصيد بعدها' }) {
    const before = describeBalance(balance);
    // Before an amount is typed the balance after is the balance now; it follows the amount as it is typed.
    const after = describeBalance(Number(balance) + sign * (amount ?? 0));

    return [
        { label: balanceLabel, value: balanceText(before), note: before.label, color: CELL_COLORS[before.tone] },
        { label: moveLabel, value: `${sign < 0 ? '−' : '+'} ${formatMoney(amount ?? 0)} ₪`, note: moveNote, move: true },
        { label: afterLabel, value: balanceText(after), note: after.label, color: CELL_COLORS[after.tone], result: true },
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
 * A choice of one among a few, as big cards on HeroUI's radio group (the
 * redesign's look): each with its icon, name and a line on what it does;
 * the chosen one ringed in the company's colour, its icon filled. `name`
 * is the field's name in the form; `columns` how many to a row on a wide
 * window; `options` are `{ value, icon, title, hint }`. Number keys pick
 * them where the form listens for them.
 */
export function ChoiceCards({ name, label, value, onChange, options, columns = 2, isRequired = false }) {
    return (
        <RadioGroup name={name} aria-label={label} isRequired={isRequired} value={value || null} onChange={onChange} className="gl-choices" style={{ '--gl-choice-cols': columns }}>
            {options.map((option) => (
                <Radio key={option.value} value={option.value} className="gl-choice">
                    <Radio.Content className="gl-choice-content">
                        <span className="gl-choice-icon" aria-hidden="true"><Icon name={option.icon} className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                        <span className="min-w-0">
                            <b>{option.title}</b>
                            {option.hint && <small>{option.hint}</small>}
                        </span>
                        <Radio.Control className="sr-only"><Radio.Indicator /></Radio.Control>
                    </Radio.Content>
                </Radio>
            ))}
        </RadioGroup>
    );
}

/**
 * The big amount field (HeroUI's input), its unit inside it, and the quick
 * picks (`children`) under it. Red while `error` is set.
 */
export function AmountBox({ id, inputRef, value, onChange, unit, placeholder = '0', label, error = false, autoFocus = false, readOnly = false, children }) {
    return (
        <div className="gl-amt">
            <div className="gl-amt-field" data-invalid={error || undefined} data-readonly={readOnly || undefined}>
                <Input
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
                    className="gl-amt-input"
                />
                <span className="gl-amt-unit" aria-hidden="true">{unit}</span>
            </div>
            {children && <div className="gl-amt-quick">{children}</div>}
        </div>
    );
}

/** A quick value under the amount, as a HeroUI pill; `tone="green"` marks the one that settles everything. */
export function QuickPick({ onClick, tone = null, children }) {
    return (
        <Button size="sm" onPress={onClick} className={`gl-quick ${tone === 'green' ? 'is-settle' : ''}`}>
            {children}
        </Button>
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
                    <Button onPress={() => window.open(printUrl, '_blank')} aria-description="يُفتح السند في نافذة جديدة جاهزًا للطباعة" className="gl-sheet-btn">
                        <Icon name="printer" className="h-[18px] w-[18px]" />
                        طباعة السند
                    </Button>
                )}
                {onAnother && (
                    <Button onPress={onAnother} className="gl-sheet-btn">
                        <Icon name="plus" className="h-[18px] w-[18px]" strokeWidth={2} />
                        {anotherLabel}
                    </Button>
                )}
                <Button onPress={onDone} autoFocus className="gl-sheet-btn is-primary">
                    تم
                </Button>
            </div>
        </div>
    );
}

/** The soft tint behind each form tone's header icon (components.css `gl-tone`). */
const HEADER_TONES = { red: 'gl-tone-charge', charge: 'gl-tone-charge', green: 'gl-tone-ok', discount: 'gl-tone-discount', clearing: 'gl-tone-clearing', amber: 'gl-tone-warn', graphite: 'gl-tone-brand', payment: 'gl-tone-brand' };

/** The window's header: its icon in the form's tone, title and one line under it, and close. */
export function FormHeader({ titleId, icon, tone = 'graphite', title, subtitle, onClose }) {
    return (
        <div className="gl-dialog-head flex shrink-0 items-center gap-3.5 px-5 py-4 sm:px-6">
            <span className={`gl-tone flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${HEADER_TONES[tone] ?? HEADER_TONES.graphite}`}>
                <Icon name={icon} className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
                <h3 id={titleId} className="text-[20px] font-extrabold leading-tight font-(family-name:--gl-head)!">
                    {title}
                </h3>
                <p className="gl-sub mt-0.5 text-[13px]!">{subtitle}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="إغلاق" className="gl-ib ms-auto">
                <Icon name="close" className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
        </div>
    );
}

/**
 * The window's footer, fixed under its fields: Esc and the shortcuts on
 * one side; cancel and the save button (HeroUI's), in the movement's
 * colour (`--gl-t-solid`, movementStyle()), naming what it saves.
 */
export function FormFooter({ onCancel, submitLabel, disabled, processing, shortcuts = null }) {
    return (
        <div className="gl-dialog-foot gl-sheet-foot">
            <span className="gl-sheet-keys">
                <span className="kbd" dir="ltr">Esc</span> إغلاق
                <span className="kbd" dir="ltr">Ctrl + Enter</span> للحفظ{shortcuts && <>، {shortcuts}</>}
            </span>
            <Button onPress={onCancel} className="gl-sheet-btn">
                إلغاء
            </Button>
            <Button type="submit" isDisabled={disabled || processing} className="gl-sheet-btn is-submit">
                <Icon name="check" className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {processing ? 'جارٍ الحفظ...' : submitLabel}
            </Button>
        </div>
    );
}
