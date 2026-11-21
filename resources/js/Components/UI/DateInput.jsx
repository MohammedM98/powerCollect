import { Button, Calendar, I18nProvider, Input } from '@heroui/react';
import { parseDate } from '@internationalized/date';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/Components/UI/Icon';
import { formatMonthName, localDay } from '@/lib/format';
import { addMonths, clampDay, isIsoDay, isOutOfRange } from '@/lib/datePicker';
import { formatWeekDay } from '@/lib/weekDays';

/**
 * A date field in the site's own look, in place of the browser's: the
 * field shows the day as the app writes it ("الخميس 22-10-2026") and opens
 * a calendar, Saturday first, in the theme. `value` and `onChange` use
 * Y-m-d, like a native date field's value; `min` and `max` grey out the
 * days outside them. `required` (with `name`) lets the form's own check
 * report a missing date. The calendar is drawn over everything, so a
 * dialog never cuts it off, and works from the keyboard: arrows move a
 * day or a week, Page Up/Down a month, Enter picks, Escape closes (HeroUI's
 * Calendar grid, Saturday first).
 * `variant="pill"` draws it as a table's filter pill, `prefix` naming it.
 * `endContent` sits inside the field at its end, beside the calendar icon
 * (a quick pick such as BankReceivedDateField's «اليوم» switch); it is not
 * part of the field's button, so it can be a control of its own.
 */
export default function DateInput({
    id,
    name,
    value,
    onChange,
    min,
    max,
    required = false,
    disabled = false,
    placeholder = 'اختر تاريخًا',
    className = '',
    onDark = false,
    buttonRef: outerButtonRef = null,
    variant = 'field',
    prefix = null,
    endContent = null,
    'aria-label': ariaLabel,
}) {
    const today = localDay();
    const hasValue = isIsoDay(value);
    const [open, setOpen] = useState(false);
    const [view, setView] = useState('days');
    const [focusedDay, setFocusedDay] = useState(() => clampDay(hasValue ? value : today, min, max));
    const ownButtonRef = useRef(null);
    const buttonRef = outerButtonRef ?? ownButtonRef;
    const popoverRef = useRef(null);

    function openCalendar() {
        setFocusedDay(clampDay(hasValue ? value : today, min, max));
        setView('days');
        setOpen(true);
    }

    function close(returnFocus = true) {
        setOpen(false);

        if (returnFocus) {
            buttonRef.current?.focus();
        }
    }

    function pick(day) {
        if (isOutOfRange(day, min, max)) {
            return;
        }

        onChange(day);
        close();
    }

    // Placed under the field, or above it when there's no room, kept on screen.
    useLayoutEffect(() => {
        const button = buttonRef.current;
        const popover = popoverRef.current;

        if (!open || !button || !popover) {
            return;
        }

        const box = button.getBoundingClientRect();
        const viewport = document.documentElement.clientWidth;
        const below = box.bottom + 8 + popover.offsetHeight <= window.innerHeight || box.top < popover.offsetHeight + 8;
        popover.style.top = `${below ? box.bottom + 8 : box.top - popover.offsetHeight - 8}px`;
        popover.style.left = `${Math.max(12, Math.min(viewport - popover.offsetWidth - 12, box.right - popover.offsetWidth))}px`;
    }, [open, view, buttonRef]);

    const closeFromOutside = useEffectEvent(close);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        function onPointerDown(event) {
            if (!popoverRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) {
                closeFromOutside(false);
            }
        }

        function onKeyDown(event) {
            if (event.key === 'Escape') {
                // Only the calendar closes, not the dialog under it.
                event.stopPropagation();
                closeFromOutside();
            }
        }

        function onScroll(event) {
            if (!(event.target instanceof Node) || !popoverRef.current?.contains(event.target)) {
                closeFromOutside(false);
            }
        }

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [open, buttonRef]);

    const shownMonth = focusedDay;
    const year = Number(shownMonth.slice(0, 4));
    const previousMonth = addMonths(shownMonth, -1);
    const nextMonth = addMonths(shownMonth, 1);
    const canGoBack = !min || previousMonth.slice(0, 7) >= min.slice(0, 7);
    const canGoForward = !max || nextMonth.slice(0, 7) <= max.slice(0, 7);

    const headerButton =
        'flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-gray-900 disabled:pointer-events-none disabled:opacity-30';

    const fieldColors = onDark
        ? `bg-white/10 text-white disabled:opacity-40 focus-visible:ring-4 focus-visible:ring-white/15 ${open ? 'border-white/50 ring-4 ring-white/15' : 'border-white/20 hover:border-white/40'}`
        : `bg-surface focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 disabled:border-dashed disabled:bg-gray-50 disabled:text-gray-500 ${open ? 'border-brand-500 ring-4 ring-brand-500/15' : 'border-gray-200 hover:border-brand-500/45'}`;

    return (
        <div className={`relative ${className}`}>
            <Button data-raw="" variant="ghost"
                ref={buttonRef}
                id={id}
                isDisabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={ariaLabel ? `${ariaLabel}${hasValue ? `: ${formatWeekDay(value)}` : ''}` : undefined}
                onClick={() => (open ? close() : openCalendar())}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' && !open) {
                        event.preventDefault();
                        openCalendar();
                    }
                }}
                data-active={variant === 'pill' && hasValue ? '' : undefined}
                className={variant === 'pill' ? 'gl-filter-trigger' : `flex h-(--control-h) w-full items-center justify-between gap-2 rounded-control border px-3 text-start text-base leading-6 transition focus:outline-hidden disabled:cursor-not-allowed ${endContent ? 'gl-date-has-end' : ''} ${fieldColors}`}
            >
                {variant === 'pill' ? (
                    <>
                        <span className="gl-filter-name">
                            <Icon name="calendar" className="h-[15px] w-[15px]" />
                            {prefix}
                            {hasValue ? ':' : ''}
                        </span>
                        {(hasValue || placeholder) && <span className="truncate">{hasValue ? formatWeekDay(value) : placeholder}</span>}
                    </>
                ) : (
                    <>
                        <span className={`truncate ${onDark ? (hasValue ? 'text-white' : 'text-white/60') : (hasValue ? 'text-gray-900' : 'text-gray-500')}`}>{hasValue ? formatWeekDay(value) : placeholder}</span>
                        <Icon name="calendar" className={`h-[18px] w-[18px] shrink-0 ${onDark ? 'text-white/60' : 'text-gray-400'}`} />
                    </>
                )}
            </Button>

            {endContent && variant !== 'pill' && <div className="absolute inset-y-0 end-3 flex items-center">{endContent}</div>}

            {name && (
                <Input
                    type="text"
                    name={name}
                    required={required}
                    value={hasValue ? value : ''}
                    onChange={() => {}}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                    // The form focuses the first missing field; send it on to the date field.
                    onFocus={() => buttonRef.current?.focus()}
                />
            )}

            {open &&
                createPortal(
                    <div
                        ref={popoverRef}
                        role="dialog"
                        aria-label="اختيار التاريخ"
                        // Lets a popover holding this field (the ledger's custom range) treat the calendar as its own.
                        data-date-picker=""
                        // Drawn in <body>: a window around the field keeps it reachable (React Aria's top layer).
                        data-react-aria-top-layer=""
                        dir="rtl"
                        className="animate-menu fixed z-70 w-78 rounded-2xl p-3 text-gray-900 gl-pop"
                    >
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <Button data-raw="" variant="ghost"
                                className={headerButton}
                                aria-label={view === 'days' ? 'الشهر السابق' : 'السنة السابقة'}
                                isDisabled={view === 'days' ? !canGoBack : Boolean(min) && year - 1 < Number(min.slice(0, 4))}
                                onClick={() => setFocusedDay(clampDay(addMonths(focusedDay, view === 'days' ? -1 : -12), min, max))}
                            >
                                <Icon name="chevron-right" className="h-5 w-5" />
                            </Button>
                            <Button data-raw="" variant="ghost"
                                aria-label={view === 'days' ? 'اختيار الشهر والسنة' : 'العودة إلى الأيام'}
                                onClick={() => setView(view === 'days' ? 'months' : 'days')}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-bold transition hover:bg-gray-100 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-gray-900"
                            >
                                {view === 'days' && formatMonthName(shownMonth)}
                                <span className="font-display">{year}</span>
                                <Icon name="chevron-down" className={`h-4 w-4 text-gray-400 transition ${view === 'months' ? 'rotate-180' : ''}`} />
                            </Button>
                            <Button data-raw="" variant="ghost"
                                className={headerButton}
                                aria-label={view === 'days' ? 'الشهر التالي' : 'السنة التالية'}
                                isDisabled={view === 'days' ? !canGoForward : Boolean(max) && year + 1 > Number(max.slice(0, 4))}
                                onClick={() => setFocusedDay(clampDay(addMonths(focusedDay, view === 'days' ? 1 : 12), min, max))}
                            >
                                <Icon name="chevron-left" className="h-5 w-5" />
                            </Button>
                        </div>

                        {view === 'days' ? (
                            <I18nProvider locale="ar-u-nu-latn-ca-gregory">
                                <Calendar
                                    aria-label={`${formatMonthName(shownMonth)} ${year}`}
                                    autoFocus
                                    firstDayOfWeek="sat"
                                    value={hasValue ? parseDate(value) : null}
                                    focusedValue={parseDate(focusedDay)}
                                    onFocusChange={(date) => setFocusedDay(clampDay(date.toString(), min, max))}
                                    minValue={min ? parseDate(min) : undefined}
                                    maxValue={max ? parseDate(max) : undefined}
                                    onChange={(date) => pick(date.toString())}
                                    className="gl-calendar"
                                >
                                    <Calendar.Grid weekdayStyle="narrow" className="w-full border-collapse">
                                        <Calendar.GridHeader>
                                            {(day) => <Calendar.HeaderCell className="py-1 text-center text-[13.5px] font-semibold text-gray-700">{day}</Calendar.HeaderCell>}
                                        </Calendar.GridHeader>
                                        <Calendar.GridBody>
                                            {(date) => (
                                                <Calendar.Cell
                                                    date={date}
                                                    data-day={date.toString()}
                                                    className={({ isSelected, isOutsideMonth }) => `relative flex h-10 cursor-pointer items-center justify-center rounded-lg font-display text-sm outline-hidden transition data-[focus-visible=true]:outline-solid data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-offset-1 data-[focus-visible=true]:outline-gray-900 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-25 ${
                                                        isSelected
                                                            ? 'bg-gray-900 font-bold text-surface shadow-xs'
                                                            : `${isOutsideMonth ? 'text-gray-400' : 'text-gray-800'} hover:bg-gray-100 ${date.toString() === today ? 'font-bold text-brand-600' : ''}`
                                                    }`}
                                                >
                                                    {({ isSelected }) => (
                                                        <>
                                                            {date.day}
                                                            {date.toString() === today && !isSelected && <span aria-hidden="true" className="absolute bottom-1.5 h-1 w-1 rounded-full bg-brand-500" />}
                                                        </>
                                                    )}
                                                </Calendar.Cell>
                                            )}
                                        </Calendar.GridBody>
                                    </Calendar.Grid>
                                </Calendar>
                            </I18nProvider>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 py-1">
                                {Array.from({ length: 12 }, (_, index) => {
                                    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
                                    const blocked = Boolean((min && month < min.slice(0, 7)) || (max && month > max.slice(0, 7)));
                                    const current = shownMonth.slice(0, 7) === month;

                                    return (
                                        <Button data-raw="" variant="ghost"
                                            key={month}
                                            isDisabled={blocked}
                                            onClick={() => {
                                                // The same day in the month picked (held to its last day).
                                                setFocusedDay(clampDay(addMonths(shownMonth, index + 1 - Number(shownMonth.slice(5, 7))), min, max));
                                                setView('days');
                                            }}
                                            className={`h-11 rounded-lg text-sm font-semibold transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:opacity-25 ${
                                                current ? 'bg-gray-900 text-surface' : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                        >
                                            {formatMonthName(`${month}-01`)}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
                            <Button data-raw="" variant="ghost"
                                isDisabled={isOutOfRange(today, min, max)}
                                onClick={() => pick(today)}
                                className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-gray-900 disabled:opacity-30"
                            >
                                اليوم
                            </Button>
                            {!required && hasValue && (
                                <Button data-raw="" variant="ghost"
                                    onClick={() => {
                                        onChange('');
                                        close();
                                    }}
                                    className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-gray-900"
                                >
                                    مسح
                                </Button>
                            )}
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
}
