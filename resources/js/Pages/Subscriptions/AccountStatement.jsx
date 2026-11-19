import { Fragment, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Card, SearchField } from '@heroui/react';
import { FilterField } from '@/Components/DataTable/DataTableFilterMenu';
import Icon from '@/Components/Icon';
import Balance from '@/Components/Balance';
import BrandLogo from '@/Components/BrandLogo';
import TableExportActions from '@/Components/DataTable/TableExportActions';
import { statementExcelParts } from '@/lib/detailExcelParts';
import StatementViewTabs from './StatementViewTabs';
import { COLUMN_WIDTHS, compactStatementEntries, describeBalance, filtersCaption, filterStatementEntries, hasLineMenu, relatedLineChains, STATEMENT_COLUMNS, STATEMENT_SORT_OPTIONS, STATEMENT_VIEWS, withReadingDiscounts } from '@/lib/accountStatement';
import { balanceTone } from '@/lib/balance';
import { formatAmount } from '@/lib/currency';
import { notify } from '@/lib/notify';
import { statementPrintUrl } from '@/lib/statementPrint';
import './AccountStatement.css';
import DateInput from '@/Components/DateInput';
import { StatementRow } from './StatementRow';
import { PrintHeading } from './StatementParts';
import StatementLedger from './StatementLedger';

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
 * On screen it is the redesign's layout (docs/redesign): five totals on
 * HeroUI cards, `between` under them (the person's subscriptions), then
 * the lines on a card with the filters as pills and the slim ledger of
 * StatementLedger.jsx. Its Excel and print buttons go into `toolsSlot`
 * when the page gives one (beside the name), else on the ledger's card.
 * Printed (`printOptions`), it keeps every column of the full statement.
 *
 * The lines shown, in the view shown, can be saved for Excel or printed — on landscape paper,
 * with the company and `subscription` (the statement's header) above them
 * and only the statement on the page, light whatever the app's theme.
 */
export default function AccountStatement({ subscription, entries, summary, paymentMethods = [], transactionTypes = [], onAction, focusLineId = null, printOptions = null, toolsSlot = null, between = null, actions = null }) {
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
    const columns = STATEMENT_COLUMNS;
    const typeOptions = [{ value: 'debit', label: 'كل ما عليه (تحميل)' }, { value: 'credit', label: 'كل ما له (تسديد وخصم)' }, ...transactionTypes];
    const methodOptions = paymentMethods;

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
        .join('، ');

    const exportTools = (
        <TableExportActions
            title={`كشف حساب ${subscription.fullName}`}
            excelProps={{ storageKey: 'statements', templateKind: 'statements', loadParts: async () => statementExcelParts(rows.flatMap((entry) => [entry, ...(openHistories.has(entry.id) ? entry.history ?? [] : [])]), summary), meta: { lines: [`رقم الحساب: ${subscription.accountNumber}`, subscription.branchName, printCaption].filter(Boolean), criteria: [['المشترك', subscription.fullName], ['رقم الحساب', subscription.accountNumber], ['التصفية', printCaption || 'كل الحركات ضمن العرض المختار']] } }}
            showPrint={subscription.canPrint !== false}
            onPrint={() => window.open(statementPrintUrl(subscription.id, { view, filters, openHistories }), '_blank', 'noopener')}
            disabled={visibleEntries.length === 0}
        />
    );

    const emptyMessage = !entries.length ? (
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
    );

    if (printOptions) {
        return (
            <div data-excel-source="custom" className="statement-print-source">
                <p className="data-table-totals">
                    ملخص الحساب الكامل: الرصيد {formatAmount(summary.balance)} شيكل، التحميلات {formatAmount(summary.charged)} شيكل، التسديدات {formatAmount(summary.paid)} شيكل، الخصومات {formatAmount(summary.discounted)} شيكل، المقاصات {formatAmount(summary.cleared)} شيكل.
                    {printCaption && ` نطاق الطباعة: ${printCaption}.`}
                    {' مجموع عمود المبلغ هو صافي عليه ناقص له، لكل عملة على حدة. الأرصدة بعد الحركات ليست قابلة للجمع.'}
                </p>
                <PrintLedger rows={rows} columns={columns} isCompact={isCompact} openHistories={openHistories} chains={chains} focusedLineId={focusedLineId} empty={emptyMessage} printOptions={printOptions} />
            </div>
        );
    }

    return (
        <div data-excel-source="custom" className="account-statement">
            <PrintHeading subscription={subscription} caption={printCaption} />
            {toolsSlot && createPortal(exportTools, toolsSlot)}

            <div className="statement-summary gl-st-top">
                <BalanceCard subscription={subscription} summary={summary} entries={entries} />
                <div className="gl-st-kpis">
                    <SummaryKpi tone="owe" label="مجموع ما عليه" value={summary.charged} hint="القراءات المعتمدة والرسوم والغرامات" />
                    <SummaryKpi tone="pay" label="مجموع ما دفعه" value={summary.paid} hint={`عدد الدفعات: ${summary.paymentsCount}`} />
                    <SummaryKpi tone="disc" label="مجموع الخصومات" value={summary.discounted} hint={`عدد الخصومات: ${summary.discountsCount}`} />
                    <SummaryKpi tone="clr" label="مجموع المقاصات" value={summary.cleared} hint={`عدد المقاصات: ${summary.clearingsCount}`} />
                </div>
            </div>

            {between}

            <Card className="gl-st-ledger statement-ledger-panel">
                <div className="gl-st-tb" role="group" aria-label="تصفية الحركات">
                    <SearchField aria-label="بحث" value={filters.search} onChange={(value) => setFilter('search', value)} className="gl-st-search">
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="البيان، رقم السند، المرجع أو المبلغ" />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                    <FilterField group={{ label: 'نوع الحركة', options: typeOptions }} value={filters.type} onChange={(value) => setFilter('type', value ?? '')} />
                    <FilterField group={{ label: 'طريقة الدفع', options: methodOptions }} value={filters.method} onChange={(value) => setFilter('method', value ?? '')} />
                    <DateInput variant="pill" prefix="من تاريخ" aria-label="من تاريخ" placeholder="" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(value) => setFilter('dateFrom', value)} />
                    <DateInput variant="pill" prefix="إلى تاريخ" aria-label="إلى تاريخ" placeholder="" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(value) => setFilter('dateTo', value)} />
                    <span className="gl-st-sort">
                        <FilterField group={{ label: 'الترتيب', options: STATEMENT_SORT_OPTIONS }} value={filters.sort ?? ''} onChange={(value) => setFilter('sort', value ?? '')} placeholder={STATEMENT_SORT_OPTIONS[0].label} clearable={false} icon="sort" />
                    </span>
                    {isFiltered && (
                        <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="gl-filter-clear">
                            <Icon name="close" className="h-3.5 w-3.5" />
                            مسح عوامل التصفية
                        </button>
                    )}
                    <span className="gl-st-tb-grow" aria-hidden="true" />
                    <StatementViewTabs value={view} onChange={chooseView} />
                    {!toolsSlot && exportTools}
                </div>
                {filters.sort?.startsWith('bank_') && <p className="gl-st-note">الحركات دون تاريخ وصول للبنك تظهر أخيرًا. الرصيد بجانب كل حركة هو رصيدها وقت التسجيل.</p>}
                {invalidDates && (
                    <p role="alert" className="gl-st-note text-red-600">
                        تاريخ البداية يجب أن يسبق تاريخ النهاية.
                    </p>
                )}

                <StatementLedger
                    rows={rows}
                    empty={emptyMessage}
                    banded={!filters.sort?.startsWith('bank_')}
                    isCompact={isCompact}
                    openHistories={openHistories}
                    onToggleHistory={toggleHistory}
                    chains={chains}
                    hoveredChain={hoveredChain}
                    onHoverChain={setHoveredChain}
                    highlightedLineId={highlightedLineId}
                    focusedLineId={focusedLineId}
                    hasLineMenus={hasLineMenus}
                    onJump={jumpToLine}
                    onAction={actOn}
                />

                <div className="gl-st-foot statement-ledger-footer">
                    <p aria-live="polite">
                        <b>{visibleEntries.length}</b> حركة من <b>{entries.length}</b>، المعروض الآن <b>{STATEMENT_VIEWS.find((option) => option.value === view)?.label}</b>، الأقدم أولًا
                        {isCompact && compact.hiddenCount > 0 && <>، أُخفيت {compact.hiddenCount} حركة ملغاة مع قيودها العكسية (مجموعها صفر)</>}
                    </p>
                    {isCompact && compact.hiddenCount > 0 && (
                        <Button variant="ghost" size="sm" onPress={() => chooseView('full')} className="gl-st-foot-btn statement-screen-only">
                            عرض كل الحركات
                        </Button>
                    )}
                </div>
            </Card>

            {/* The movements one can add, in a glass dock that floats at the foot of the screen while the statement scrolls. */}
            {actions && <div className="gl-st-dock statement-screen-only">{actions}</div>}
        </div>
    );
}

/** A total on its own HeroUI card: the amount in shekels and what it counts. */
/** Whole days from a statement line's date to today. */
function daysSince(date) {
    const day = new Date(`${String(date).slice(0, 10)}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Math.max(0, Math.round((today - day) / 86400000));
}

function lastPaymentText(entries) {
    const last = entries
        .filter((entry) => entry.type === 'payment' && !entry.cancellation && entry.date)
        .reduce((latest, entry) => (!latest || entry.date > latest.date ? entry : latest), null);

    if (!last) {
        return null;
    }

    const days = daysSince(last.date);

    return days === 0 ? 'اليوم' : days === 1 ? 'أمس' : days === 2 ? 'قبل يومين' : days <= 10 ? `قبل ${days} أيام` : `قبل ${days} يومًا`;
}

/**
 * The balance as the redesign's account card: dark, with the company's
 * mark, the balance large (signed, its colour on the dot by its name), the
 * week's minimum and how long since the last payment.
 */
function BalanceCard({ subscription, summary, entries }) {
    const settled = describeBalance(summary.balance).label === 'مسدّد';
    const lastPayment = lastPaymentText(entries);

    return (
        <Card className="gl-kpi gl-kpi-balance gl-st-acard" data-tone={balanceTone(summary.balance)}>
            <small><i aria-hidden="true" />الرصيد الحالي</small>
            <b><Balance value={summary.balance} colored={false} unit="₪" paperWord={false} /></b>
            <span>{settled ? 'الحساب مسدّد بالكامل' : 'بعد آخر حركة على الحساب'}</span>
            <dl className="gl-st-acard-facts">
                {Number(subscription.minimumPayment) > 0 && (
                    <div><dt>الحد الأدنى</dt><dd><bdi dir="ltr">{formatAmount(subscription.minimumPayment)}</bdi> ₪</dd></div>
                )}
                <div><dt>آخر دفعة</dt><dd>{lastPayment ?? 'لا دفعات بعد'}</dd></div>
                {Number(subscription.kiloPrice) > 0 && (
                    <div><dt>الكيلو</dt><dd><bdi dir="ltr">{formatAmount(subscription.kiloPrice)}</bdi> ₪</dd></div>
                )}
            </dl>
            <BrandLogo alt="" onDark markSize={36} className="gl-st-acard-mark" />
        </Card>
    );
}

function SummaryKpi({ label, value, hint, tone }) {
    return (
        <Card className="gl-kpi gl-st-fig" data-tone={tone}>
            <small><i aria-hidden="true" />{label}</small>
            <b><bdi dir="ltr">{formatAmount(value)}</bdi> <span className="gl-kpi-unit">₪</span></b>
            <span>{hint}</span>
        </Card>
    );
}

/** Every column of the statement, for the printed page (Print Designer) and its preview. */
function PrintLedger({ rows, columns, isCompact, openHistories, chains, focusedLineId, empty, printOptions }) {
    const noop = () => {};

    return (
        <div className="data-table-container">
            <table className="data-table data-table-ledger w-full text-start text-sm" style={{ '--statement-table-width': `${COLUMN_WIDTHS.reduce((total, width) => total + width, 0)}px` }}>
                <colgroup>
                    {COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width: `${width}px` }} />)}
                </colgroup>
                <thead>
                    <tr>
                        {columns.map((column) => <th key={column}>{column}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length}>{empty}</td>
                        </tr>
                    ) : (
                        rows.map((entry) => {
                            const historyOpen = isCompact && openHistories.has(entry.id);
                            const rowProps = { isCompact, hasLineMenus: false, hoveredChain: null, onHoverChain: noop, onJump: noop, onAction: noop, fullPaymentDetails: printOptions !== null };

                            return (
                                <Fragment key={entry.id}>
                                    <StatementRow {...rowProps} entry={entry} chain={chains.get(entry.id) ?? null} highlighted={false} focused={focusedLineId === entry.id || entry.discountLine?.id === focusedLineId} historyOpen={historyOpen} onToggleHistory={noop} />
                                    {historyOpen && entry.history.map((folded) => <StatementRow key={folded.id} {...rowProps} entry={folded} chain={chains.get(folded.id) ?? null} isHistory highlighted={false} focused={focusedLineId === folded.id} />)}
                                </Fragment>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
