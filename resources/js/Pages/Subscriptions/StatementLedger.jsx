import { Fragment } from 'react';
import { Chip } from '@heroui/react';
import BankReceivedDate from '@/Components/BankReceivedDate';
import Balance from '@/Components/Balance';
import Icon from '@/Components/Icon';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import SplitPaymentBadge from '@/Pages/Payments/SplitPaymentBadge';
import { useRowActionsMenu } from '@/hooks/useRowActionsMenu';
import { chainColor, followsLineAbove, hasLineMenu, lineTone, monthBands, netOfReadingDiscount, rowClass } from '@/lib/accountStatement';
import { formatAmount } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import { AmendmentBadge, CancellationNote, CorrectsNote, HistoryToggle, LinkedReversalNote, ReadingDiscountNote, ReversalNote, withLtrDates } from './StatementNotes';
import { lineActionsMenu } from './statementLineActions';

/** Each kind of line's mark beside its name. */
const TONE_ICONS = { pay: 'banknotes', split: 'layers', charge: 'receipt', discount: 'percent', clearing: 'scale', reading: 'gauge' };

/** Every column of the statement, as the redesign's option «أ» shows them (STATEMENT_COLUMNS). */
const HEADINGS = ['#', 'رقم الصندوق', 'رقم السند', 'الرقم المرجعي', 'البنك', 'تاريخ الحركة', 'البيان', 'المبلغ', 'العملة', 'نوع الحركة', 'طريقة الدفع', 'سعر الصرف', 'الرصيد (شيكل)', 'اسم المستخدم'];

/** An empty cell, as a quiet dash. */
const none = <span className="gl-st-none">—</span>;

/** A line's amount in its own column (عليه or له): after a reading's discount, with what it was before; another currency is named under it. */
function LineAmount({ entry }) {
    return (
        <span className="gl-st-amount" data-side={entry.isCredit ? 'credit' : 'debit'}>
            <bdi dir="ltr" className="gl-st-money ledger-struck">{entry.isCredit ? '−' : '+'}{formatAmount(entry.discountLine ? netOfReadingDiscount(entry) : entry.amount)}</bdi>
            {entry.discountLine && (
                <small title="القراءة − خصم القراءة الأسبوعية">
                    <bdi dir="ltr">{formatAmount(entry.amount)} − {formatAmount(entry.discountLine.amount)}</bdi>
                </small>
            )}
        </span>
    );
}

/** The line's kind as a HeroUI chip in its colour, with what has happened to it since. */
export function LineKind({ entry }) {
    const tone = lineTone(entry);

    return (
        <span className="gl-st-kind">
            <Chip size="sm" className="gl-st-chip" data-tone={tone ?? undefined}>
                {tone && <Icon name={TONE_ICONS[tone]} className="h-3.5 w-3.5" />}
                <Chip.Label>{entry.typeLabel}</Chip.Label>
            </Chip>
            {entry.cancellation && (
                <Chip size="sm" className="gl-st-chip" data-state={entry.cancellation.wasCorrected ? 'corrected' : 'cancelled'}>
                    {entry.cancellation.wasCorrected ? 'مُصحّحة' : 'ملغاة'}
                </Chip>
            )}
            {entry.isCorrection && <Chip size="sm" className="gl-st-chip" data-state="corrected">تصحيح</Chip>}
            {entry.isAmended && <AmendmentBadge amendments={entry.amendments} />}
        </span>
    );
}

/** One line of the ledger, every column of it. */
function LedgerLine({ entry, chain, hoveredChain, onHoverChain, isCompact, isHistory = false, highlighted, focused, hasLineMenus, historyOpen = false, onToggleHistory, onJump, onAction }) {
    const actionsMenu = useRowActionsMenu();
    const menu = hasLineMenus && hasLineMenu(entry) ? lineActionsMenu(entry, onAction) : null;
    const showsHistory = isCompact && !isHistory && entry.history?.length > 0;
    const color = chainColor(chain);
    const [day, ...time] = String(entry.date ?? '').split(' ');

    return (
        <tr
            {...actionsMenu.rowProps(Boolean(menu))}
            id={`statement-line-${entry.id}`}
            className={rowClass(entry, highlighted && !focused, isHistory, chain !== null && chain === hoveredChain, focused) || undefined}
            style={color ? { '--ledger-chain': color } : undefined}
            data-chain={chain ?? undefined}
            onMouseEnter={chain ? () => onHoverChain(chain) : undefined}
            onMouseLeave={chain ? () => onHoverChain(null) : undefined}
        >
            <td data-label="#" className="gl-st-n gl-st-pin">
                <span title={chain ? 'الحركات المرتبطة بنفس اللون' : undefined}>
                    {color && <i aria-hidden="true" className="gl-st-chain" style={{ background: `rgb(${color})` }} />}
                    {entry.lineNumber}
                </span>
                {entry.discountLine && <small>+ {entry.discountLine.lineNumber}</small>}
            </td>
            <td data-label="رقم الصندوق" className="gl-num">{entry.cashBox || none}</td>
            <td data-label="رقم السند" className="gl-num">{entry.voucherNumber || none}</td>
            <td data-label="الرقم المرجعي">{entry.referenceNumber ? <bdi dir="ltr" className="gl-st-ref">{entry.referenceNumber}</bdi> : none}</td>
            <td data-label="البنك">
                {entry.bankName || none}
                {entry.senderBankName && <small>من {entry.senderBankName}</small>}
            </td>
            <td data-label="تاريخ الحركة" className="gl-st-d">
                <bdi dir="ltr">{formatDate(day)}</bdi>
                {time.length > 0 && <small><bdi dir="ltr">{time.join(' ')}</bdi></small>}
                {entry.paidOn && <small className="gl-st-late">متأخرة، دُفعت <bdi dir="ltr">{formatDate(entry.paidOn)}</bdi></small>}
            </td>
            <td data-label="البيان" className="gl-st-desc">
                <div data-line-description="">
                    <div className="ledger-description statement-description-title">
                        {(isHistory || followsLineAbove(entry)) && <span className="me-1 text-gray-400">↲</span>}
                        <span className="ledger-struck">{withLtrDates(entry.description)}</span>
                    </div>
                    {entry.details && <p className="ledger-description statement-description-details">{withLtrDates(entry.details)}</p>}
                </div>
                {entry.senderName && <small className="gl-st-meta">المحوِّل: {entry.senderName}</small>}
                {entry.splitPayment && <SplitPaymentBadge split={entry.splitPayment} compact />}
                <BankReceivedDate value={entry.bankReceivedOn} />
                {entry.discountLine && <ReadingDiscountNote discountLine={entry.discountLine} />}
                {entry.cancellation && <CancellationNote cancellation={entry.cancellation} onJump={onJump} />}
                {entry.reverses && <ReversalNote entry={entry} reverses={entry.reverses} onJump={onJump} />}
                {entry.auditOriginal && (
                    <p className="ledger-description mt-1.5 text-xs text-gray-600">
                        <button type="button" onClick={() => onJump(entry.auditOriginal.id)} className="font-semibold hover:underline">
                            تصحيح حوالة للدفعة #{entry.auditOriginal.lineNumber} ↑
                        </button>
                    </p>
                )}
                {entry.linkedReversal && <LinkedReversalNote reversal={entry.linkedReversal} onJump={onJump} />}
                {showsHistory ? <HistoryToggle entry={entry} isOpen={historyOpen} onToggle={onToggleHistory} /> : entry.corrects && <CorrectsNote corrects={entry.corrects} onJump={onJump} />}
            </td>
            <td data-label="المبلغ" className="gl-st-cash">
                <LineAmount entry={entry} />
            </td>
            <td data-label="العملة">{entry.currencyLabel || none}</td>
            <td data-label="نوع الحركة" className="gl-st-type">
                <LineKind entry={entry} />
            </td>
            <td data-label="طريقة الدفع">{entry.paymentMethodLabel || none}</td>
            <td data-label="سعر الصرف" className="gl-num">{entry.exchangeRate || none}</td>
            <td data-label="الرصيد (شيكل)" className="gl-st-cash gl-st-bal" data-tone={Number(entry.balance) > 0 ? 'owes' : Number(entry.balance) < 0 ? 'credit' : undefined}>
                {isHistory ? (
                    <span title="أُلغيت مع قيدها العكسي، فلم تغيّر الرصيد" className="text-gray-300">—</span>
                ) : (
                    <Balance value={entry.balance} colored={false} unit="" paperWord={false} className="gl-st-money" />
                )}
            </td>
            <td data-label="اسم المستخدم">{entry.recordedByName || none}</td>
            {hasLineMenus && <td className="gl-st-act">{menu && <RowActionsMenu menu={menu} menuController={actionsMenu} />}</td>}
        </tr>
    );
}

/**
 * The statement's lines as the redesign's option «أ»: every column of the
 * statement in one table (the line number pinned at its start while it
 * scrolls sideways), the head a soft band, and the lines in bands of one
 * month with what was charged and credited in it and the balance it left.
 * The line's menu, its right-click and Shift + F10, the links between
 * related lines and the folded history of the compact view work as before.
 */
export default function StatementLedger({ rows, empty, banded, isCompact, openHistories, onToggleHistory, chains, hoveredChain, onHoverChain, highlightedLineId, focusedLineId, hasLineMenus, onJump, onAction }) {
    const bands = monthBands(rows, banded);
    const columnCount = HEADINGS.length + (hasLineMenus ? 1 : 0);

    return (
        <div className="gl-st-scroll">
            <table className="gl-st-table">
                <thead>
                    <tr>
                        {HEADINGS.map((heading, index) => (
                            <th key={heading} scope="col" className={index === 0 ? 'gl-st-pin' : [7, 12].includes(index) ? 'gl-st-cash' : undefined}>{heading}</th>
                        ))}
                        {hasLineMenus && <th className="gl-st-act"><span className="sr-only">إجراءات</span></th>}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={columnCount} className="gl-st-empty">{empty}</td>
                        </tr>
                    ) : (
                        bands.map((band, bandIndex) => (
                            <Fragment key={`${band.month}-${bandIndex}`}>
                                {band.month && (
                                    <tr className="gl-st-month">
                                        <td colSpan={2} className="gl-st-pin">
                                            <b className="gl-st-month-name">{band.month}</b>
                                        </td>
                                        <td colSpan={columnCount - 2}>
                                            <span className="gl-st-month-sum">
                                                {band.entries.length} حركة، عليه <bdi dir="ltr">{formatAmount(band.charged)}</bdi>، له <bdi dir="ltr">{formatAmount(band.credited)}</bdi>
                                                {band.entries.at(-1)?.balance !== undefined && <>، الرصيد آخر الشهر <bdi dir="ltr">{formatAmount(band.entries.at(-1).balance)}</bdi> ₪</>}
                                            </span>
                                        </td>
                                    </tr>
                                )}
                                {band.entries.map((entry) => {
                                    const historyOpen = isCompact && openHistories.has(entry.id);
                                    const lineProps = { isCompact, hasLineMenus, hoveredChain, onHoverChain, onJump, onAction };

                                    return (
                                        <Fragment key={entry.id}>
                                            <LedgerLine
                                                {...lineProps}
                                                entry={entry}
                                                chain={chains.get(entry.id) ?? null}
                                                highlighted={highlightedLineId === entry.id}
                                                focused={focusedLineId === entry.id || entry.discountLine?.id === focusedLineId}
                                                historyOpen={historyOpen}
                                                onToggleHistory={() => onToggleHistory(entry.id)}
                                            />
                                            {historyOpen &&
                                                entry.history.map((folded) => (
                                                    <LedgerLine
                                                        key={folded.id}
                                                        {...lineProps}
                                                        entry={folded}
                                                        chain={chains.get(folded.id) ?? null}
                                                        isHistory
                                                        highlighted={highlightedLineId === folded.id}
                                                        focused={focusedLineId === folded.id}
                                                    />
                                                ))}
                                        </Fragment>
                                    );
                                })}
                            </Fragment>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
