import { FilterBar, FilterField } from '@/Components/Form/FilterBar';
import { Fragment, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import Balance from '@/Components/Balance';
import TableExportActions from '@/Components/DataTable/TableExportActions';
import { statementExcelParts } from '@/lib/detailExcelParts';
import StatementViewTabs from './StatementViewTabs';
import { COLUMN_WIDTHS, compactStatementEntries, filtersCaption, filterStatementEntries, hasLineMenu, relatedLineChains, STATEMENT_COLUMNS, STATEMENT_SORT_OPTIONS, withReadingDiscounts } from '@/lib/accountStatement';
import { balanceTone } from '@/lib/balance';
import { formatAmount } from '@/lib/currency';
import { notify } from '@/lib/notify';
import { statementPrintUrl } from '@/lib/statementPrint';
import './AccountStatement.css';
import DateInput from '@/Components/DateInput';
import { StatementRow } from './StatementRow';
import { PrintHeading, SummaryCard } from './StatementParts';

const EMPTY_FILTERS = { search: '', type: '', method: '', dateFrom: '', dateTo: '', sort: '' };

/**
 * The body of a subscription's account statement: the balance and totals,
 * the search and filters, and every line (charges عليه, payments and
 * discounts له) oldest first with the balance after each.
 *
 * It opens compact: a cancelled line and the reversal that takes it back
 * add up to nothing, so both are left out and the balances read as if they
 * were never recorded (ending where the full statement ends); the line
 * that corrected them can open them under it, and a weekly reading shows
 * its standing discount inside its line. "كل الحركات" shows every line as
 * recorded, in chronological order, with links between related lines.
 * The browser remembers the view chosen.
 * `onAction` receives one of the server-provided canonical actions and the
 * line to change. Used by the statement page and the subscriptions-list window.
 *
 * The lines shown, in the view shown, can be saved for Excel or printed — on landscape paper,
 * with the company and `subscription` (the statement's header) above them
 * and only the statement on the page, light whatever the app's theme.
 */
export default function AccountStatement({ subscription, entries, summary, paymentMethods, transactionTypes, onAction, focusLineId = null, printOptions = null }) {
    const [filters, setFilters] = useState(() => printOptions?.filters ?? EMPTY_FILTERS);
    const [view, setView] = useState(() => printOptions?.view ?? 'compact');
    const [openHistories, setOpenHistories] = useState(() => new Set(printOptions?.openHistories ?? []));
    const [highlightedLineId, setHighlightedLineId] = useState(null);
    const [pendingJump, setPendingJump] = useState(null);
    const [hoveredChain, setHoveredChain] = useState(null);
    const highlightTimer = useRef(null);
    // The line the statement was opened at (a cash box's entry): marked for as long as the statement is open.
    const [focusedLineId] = useState(() => (entries.some((entry) => entry.id === focusLineId) ? focusLineId : null));
    const isCompact = view === 'compact';
    const compact = useMemo(() => compactStatementEntries(entries), [entries]);
    const shownEntries = isCompact ? compact.entries : entries;
    const visibleEntries = filterStatementEntries(shownEntries, filters);
    const rows = isCompact ? withReadingDiscounts(visibleEntries) : visibleEntries;
    const chains = useMemo(() => relatedLineChains(entries), [entries]);
    const entriesById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
    const isFiltered = Object.values(filters).some(Boolean);
    const invalidDates = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
    const hasLineMenus = !printOptions && entries.some(hasLineMenu);
    const columns = hasLineMenus ? [...STATEMENT_COLUMNS, ''] : STATEMENT_COLUMNS;

    function setFilter(key, value) {
        setFilters((current) => ({ ...current, [key]: value }));
    }

    function chooseView(nextView) {
        setView(nextView);
    }

    function toggleHistory(lineId) {
        setOpenHistories((current) => {
            const next = new Set(current);
            next.has(lineId) ? next.delete(lineId) : next.add(lineId);

            return next;
        });
    }

    /** Scrolls to a line and marks it; a line folded away in the compact view is opened first. */
    function jumpToLine(lineId) {
        const line = document.getElementById(`statement-line-${lineId}`);

        if (line) {
            line.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedLineId(lineId);
            clearTimeout(highlightTimer.current);
            highlightTimer.current = setTimeout(() => setHighlightedLineId(null), 1800);

            return;
        }

        const holder = rows.find((row) => row.history?.some((folded) => folded.id === lineId));

        if (holder) {
            setOpenHistories((current) => new Set(current).add(holder.id));
        } else if (isCompact) {
            // Only for this visit: following a link shouldn't make the full view the remembered one.
            setView('full');
        } else {
            return;
        }

        setPendingJump(lineId);
    }

    const jumpOnceShown = useEffectEvent((lineId) => jumpToLine(lineId));

    // The line is reached after the render that unfolds or switches the view to show it.
    useEffect(() => {
        if (pendingJump !== null) {
            setPendingJump(null);
            jumpOnceShown(pendingJump);
        }
    }, [pendingJump]);

    useEffect(() => () => clearTimeout(highlightTimer.current), []);

    // Opened at a line: go to it and say which it is, or that it is no longer on the statement.
    const showOpenedLine = useEffectEvent(() => {
        if (!focusLineId) {
            return undefined;
        }

        const entry = entriesById.get(focusLineId);

        // After the page has drawn: the line is laid out, and the notifications are listening.
        const timer = setTimeout(() => {
            if (!entry) {
                notify('هذه الحركة لم تعد في كشف الحساب.', 'warning');

                return;
            }

            jumpToLine(focusLineId);
            notify(`الحركة هي السطر رقم ${entry.lineNumber} في كشف الحساب، ومُعلَّمة فيه.`, 'success');
        }, 250);

        return () => clearTimeout(timer);
    });
    useEffect(() => showOpenedLine(), []);

    // The printout is light whatever the app's theme, from the print button or the browser's own print.
    useEffect(() => {
        const root = document.documentElement;
        let wasDark = false;

        function beforePrint() {
            wasDark = root.classList.contains('dark');
            root.classList.remove('dark');
        }

        function afterPrint() {
            if (wasDark) {
                root.classList.add('dark');
            }
        }

        window.addEventListener('beforeprint', beforePrint);
        window.addEventListener('afterprint', afterPrint);

        return () => {
            window.removeEventListener('beforeprint', beforePrint);
            window.removeEventListener('afterprint', afterPrint);
        };
    }, []);

    /** The modals work on the line as the server sent it, not as the compact view shows it. */
    function actOn(action, entry) {
        onAction(action, entriesById.get(entry.id) ?? entry);
    }

    const printCaption = [
        isCompact && compact.hiddenCount > 0 && 'عرض مختصر دون الحركات الملغاة وقيودها العكسية',
        filtersCaption(filters, transactionTypes, paymentMethods),
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <div data-excel-source="custom" className={printOptions ? 'statement-print-source' : 'account-statement'}>
            {!printOptions && <PrintHeading subscription={subscription} caption={printCaption} />}
            {printOptions && <p className="data-table-totals">
                ملخص الحساب الكامل: الرصيد {formatAmount(summary.balance)} شيكل · التحميلات {formatAmount(summary.charged)} شيكل · التسديدات {formatAmount(summary.paid)} شيكل · الخصومات {formatAmount(summary.discounted)} شيكل · المقاصات {formatAmount(summary.cleared)} شيكل.
                {printCaption && ` نطاق الطباعة: ${printCaption}.`}
                {' مجموع عمود المبلغ هو صافي عليه ناقص له، لكل عملة على حدة. الأرصدة بعد الحركات ليست قابلة للجمع.'}
            </p>}

            <div className="statement-summary mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <SummaryCard
                    label="الرصيد الحالي"
                    value={<Balance value={summary.balance} colored={false} unit="₪" paperWord={false} />}
                    tone={balanceTone(summary.balance)}
                    className="sm:col-span-2 lg:col-span-1"
                />
                <SummaryCard
                    label="مجموع ما عليه (تحميل)"
                    value={`${formatAmount(summary.charged)} ₪`}
                    hint="القراءات المعتمدة والرسوم والغرامات"
                />
                <SummaryCard
                    label="مجموع ما دفعه (تسديد)"
                    value={`${formatAmount(summary.paid)} ₪`}
                    hint={`عدد الدفعات: ${summary.paymentsCount}`}
                />
                <SummaryCard
                    label="مجموع الخصومات"
                    value={`${formatAmount(summary.discounted)} ₪`}
                    hint={`عدد الخصومات: ${summary.discountsCount}`}
                />
                <SummaryCard
                    label="مجموع المقاصات"
                    value={`${formatAmount(summary.cleared)} ₪`}
                    hint={`عدد المقاصات: ${summary.clearingsCount}`}
                />
            </div>

            <section className="statement-ledger-panel">
                <div className="data-table-toolbar">
                    <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                        <div className="me-auto">
                            <StatementViewTabs value={view} onChange={chooseView} />
                        </div>
                        <TableExportActions
                            title={`كشف حساب ${subscription.fullName}`}
                            excelProps={{ storageKey: 'statements', templateKind: 'statements', loadParts: async () => statementExcelParts(rows.flatMap((entry) => [entry, ...(openHistories.has(entry.id) ? entry.history ?? [] : [])]), summary), meta: { lines: [`رقم الحساب: ${subscription.accountNumber}`, subscription.branchName, printCaption].filter(Boolean), criteria: [['المشترك', subscription.fullName], ['رقم الحساب', subscription.accountNumber], ['التصفية', printCaption || 'كل الحركات ضمن العرض المختار']] } }}
                            showPrint={subscription.canPrint !== false}
                            onPrint={() => window.open(statementPrintUrl(subscription.id, { view, filters, openHistories }), '_blank', 'noopener')}
                            disabled={visibleEntries.length === 0}
                        />
                    </div>
                    <FilterBar label="تصفية الحركات">
                        <FilterField label="بحث">
                            <input
                                type="search"
                                value={filters.search}
                                onChange={(e) => setFilter('search', e.target.value)}
                                placeholder="البيان، رقم السند، المبلغ أو البنك"
                                className="block w-full text-sm"
                            />
                        </FilterField>
                        <FilterField label="نوع الحركة">
                            <select value={filters.type} onChange={(e) => setFilter('type', e.target.value)} className="block w-full text-sm">
                                <option value="">الكل</option>
                                <option value="debit">كل ما عليه (تحميل)</option>
                                <option value="credit">كل ما له (تسديد وخصم)</option>
                                {transactionTypes.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </FilterField>
                        <FilterField label="طريقة الدفع">
                            <select value={filters.method} onChange={(e) => setFilter('method', e.target.value)} className="block w-full text-sm">
                                <option value="">الكل</option>
                                {paymentMethods.map((method) => (
                                    <option key={method.value} value={method.value}>
                                        {method.label}
                                    </option>
                                ))}
                            </select>
                        </FilterField>
                        <FilterField label="من تاريخ">
                            <DateInput aria-label="من تاريخ" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(value) => setFilter('dateFrom', value)} />
                        </FilterField>
                        <FilterField label="إلى تاريخ">
                            <DateInput aria-label="إلى تاريخ" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(value) => setFilter('dateTo', value)} />
                        </FilterField>
                        <FilterField label="ترتيب الحركات">
                            <select value={filters.sort ?? ''} onChange={(event) => setFilter('sort', event.target.value)} className="block w-full text-sm">
                                {STATEMENT_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </FilterField>
                    </FilterBar>
                    {filters.sort?.startsWith('bank_') && <p className="mt-2 text-sm text-gray-500">الحركات دون تاريخ وصول للبنك تظهر أخيرًا. الرصيد بجانب كل حركة هو رصيدها وقت التسجيل.</p>}
                    {invalidDates && (
                        <p role="alert" className="mt-2 text-sm text-red-600">
                            تاريخ البداية يجب أن يسبق تاريخ النهاية.
                        </p>
                    )}
                </div>

                <div className="data-table-container">
                    <table className="data-table data-table-ledger w-full text-start text-sm" style={{ '--statement-table-width': `${COLUMN_WIDTHS.reduce((total, width) => total + width, hasLineMenus ? 64 : 0)}px` }}>
                        <colgroup>
                            {COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width: `${width}px` }} />)}
                            {hasLineMenus && <col className="statement-screen-only !w-[64px]" />}
                        </colgroup>
                        <thead>
                            <tr>
                                {columns.map((column) => (
                                    <th key={column} className={column === '' ? 'statement-screen-only' : undefined}>
                                        {column}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length}>
                                        {!entries.length ? (
                                            'لا توجد حركات على هذا الحساب بعد.'
                                        ) : isCompact && !compact.entries.length ? (
                                            <>
                                                كل حركات هذا الحساب ملغاة مع قيودها العكسية (مجموعها صفر) فلا شيء يُعرض في العرض المختصر.{' '}
                                                <button type="button" onClick={() => chooseView('full')} className="font-medium text-brand-600 hover:underline">
                                                    عرض كل الحركات
                                                </button>
                                            </>
                                        ) : (
                                            'لا توجد حركات تطابق البحث والتصفية.'
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                rows.map((entry) => {
                                    const historyOpen = isCompact && openHistories.has(entry.id);
                                    const rowProps = { isCompact, hasLineMenus, hoveredChain, onHoverChain: setHoveredChain, onJump: jumpToLine, onAction: actOn, fullPaymentDetails: printOptions !== null };

                                    return (
                                        <Fragment key={entry.id}>
                                            <StatementRow
                                                {...rowProps}
                                                entry={entry}
                                                chain={chains.get(entry.id) ?? null}
                                                highlighted={highlightedLineId === entry.id}
                                                focused={focusedLineId === entry.id || entry.discountLine?.id === focusedLineId}
                                                historyOpen={historyOpen}
                                                onToggleHistory={() => toggleHistory(entry.id)}
                                            />
                                            {historyOpen &&
                                                entry.history.map((folded) => (
                                                    <StatementRow
                                                        key={folded.id}
                                                        {...rowProps}
                                                        entry={folded}
                                                        chain={chains.get(folded.id) ?? null}
                                                        isHistory
                                                        highlighted={highlightedLineId === folded.id}
                                                        focused={focusedLineId === folded.id}
                                                    />
                                                ))}
                                        </Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="statement-ledger-footer flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
                    <p aria-live="polite">
                        الحركات المعروضة: {visibleEntries.length} من {entries.length} · الأقدم أولًا، والرصيد بعد كل حركة
                        {isCompact && compact.hiddenCount > 0 && (
                            <>
                                {' '}
                                · أُخفيت {compact.hiddenCount} حركة ملغاة مع قيودها العكسية (مجموعها صفر){' '}
                                <button type="button" onClick={() => chooseView('full')} className="statement-screen-only font-medium text-brand-600 hover:underline">
                                    عرض كل الحركات
                                </button>
                            </>
                        )}
                    </p>
                    {isFiltered && (
                        <button
                            type="button"
                            onClick={() => setFilters(EMPTY_FILTERS)}
                            className="statement-screen-only font-medium text-brand-600 hover:underline"
                        >
                            مسح عوامل التصفية
                        </button>
                    )}
                </div>
            </section>
        </div>
    );
}
