import { Fragment, useState } from 'react';
import { Chip } from '@heroui/react';
import BankReceivedDate from '@/Components/BankReceivedDate';
import Balance from '@/Components/Balance';
import Icon from '@/Components/Icon';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import LatePaymentDetails from '@/Components/LatePaymentDetails';
import SplitPaymentBadge from '@/Pages/Payments/SplitPaymentBadge';
import { useRowActionsMenu } from '@/hooks/useRowActionsMenu';
import { chainColor, followsLineAbove, hasLineMenu, lineTone, monthBands, netOfReadingDiscount, rowClass } from '@/lib/accountStatement';
import { formatAmount } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import { AmendmentBadge, CancellationNote, CorrectsNote, HistoryToggle, LinkedReversalNote, ReadingDiscountNote, ReversalNote, withLtrDates } from './StatementNotes';
import { lineActionsMenu } from './statementLineActions';

/** Each kind of line's mark beside its name. */
const TONE_ICONS = { pay: 'banknotes', split: 'layers', charge: 'receipt', discount: 'percent', clearing: 'scale', reading: 'gauge' };

/** The ledger's columns after the opener: eight calm columns, as in the redesign (docs/redesign). */
const HEADINGS = ['#', 'التاريخ', 'البيان', 'النوع', 'عليه (تحميل)', 'له (تسديد)', 'الرصيد'];

/** What a line holds beyond the eight columns, for its details row: every column of the full statement. */
function lineDetails(entry) {
    const [, ...time] = String(entry.date ?? '').split(' ');

    return [
        ['رقم الصندوق', entry.cashBox],
        ['رقم السند', entry.voucherNumber],
        ['الرقم المرجعي', entry.referenceNumber, true],
        ['البنك', entry.bankName && [entry.senderBankName && `من: ${entry.senderBankName}`, `إلى: ${entry.bankName}`].filter(Boolean).join('، ')],
        ['المرسل', entry.senderName],
        ['العملة', entry.currencyLabel],
        ['طريقة الدفع', entry.paymentMethodLabel],
        ['سعر الصرف', entry.exchangeRate, true],
        ['اسم المستخدم', entry.recordedByName],
        ['وقت التسجيل', time.join(' '), true],
    ].filter(([, value]) => value !== null && value !== undefined && value !== '');
}

/** A line's amount in its own column (عليه or له): after a reading's discount, with what it was before; another currency is named under it. */
function LineAmount({ entry }) {
    return (
        <span className="gl-st-amount">
            <bdi dir="ltr" className="gl-st-money ledger-struck">{formatAmount(entry.discountLine ? netOfReadingDiscount(entry) : entry.amount)}</bdi>
            {entry.discountLine && (
                <small title="القراءة − خصم القراءة الأسبوعية">
                    <bdi dir="ltr">{formatAmount(entry.amount)} − {formatAmount(entry.discountLine.amount)}</bdi>
                </small>
            )}
            {entry.currencyLabel && entry.currencyLabel !== 'شيكل' && <small>{entry.currencyLabel}</small>}
        </span>
    );
}

/** The line's kind as a HeroUI chip in its colour, with what has happened to it since. */
function LineKind({ entry }) {
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

/** One line of the ledger and, once opened, the row under it with the rest of its details. */
function LedgerLine({ entry, chain, hoveredChain, onHoverChain, isCompact, isHistory = false, highlighted, focused, hasLineMenus, historyOpen = false, onToggleHistory, onJump, onAction }) {
    const [open, setOpen] = useState(false);
    const actionsMenu = useRowActionsMenu();
    const menu = hasLineMenus && hasLineMenu(entry) ? lineActionsMenu(entry, onAction) : null;
    const showsHistory = isCompact && !isHistory && entry.history?.length > 0;
    const color = chainColor(chain);
    const details = lineDetails(entry);
    const meta = [entry.voucherNumber && `سند ${entry.voucherNumber}`, entry.paymentMethodLabel, entry.bankName && `إلى ${entry.bankName}`].filter(Boolean).join('، ');
    const detailsId = `statement-line-${entry.id}-details`;

    return (
        <>
            <tr
                {...actionsMenu.rowProps(Boolean(menu))}
                id={`statement-line-${entry.id}`}
                className={[rowClass(entry, highlighted && !focused, isHistory, chain !== null && chain === hoveredChain, focused), open && 'is-open'].filter(Boolean).join(' ') || undefined}
                style={color ? { '--ledger-chain': color } : undefined}
                data-chain={chain ?? undefined}
                onMouseEnter={chain ? () => onHoverChain(chain) : undefined}
                onMouseLeave={chain ? () => onHoverChain(null) : undefined}
            >
                <td className="gl-st-x">
                    <button type="button" className="gl-st-exp" aria-expanded={open} aria-controls={open ? detailsId : undefined} aria-label={`تفاصيل الحركة #${entry.lineNumber}`} onClick={() => setOpen((current) => !current)}>
                        <Icon name="chevron-down" className="h-4 w-4" />
                    </button>
                </td>
                <td data-label="#" className="gl-st-n">
                    <span title={chain ? 'الحركات المرتبطة بنفس اللون' : undefined}>
                        {color && <i aria-hidden="true" className="gl-st-chain" style={{ background: `rgb(${color})` }} />}
                        #{entry.lineNumber}
                    </span>
                    {entry.discountLine && <small>+ #{entry.discountLine.lineNumber}</small>}
                </td>
                <td data-label="تاريخ الحركة" className="gl-st-d">
                    <bdi dir="ltr">{formatDate(String(entry.date ?? '').split(' ')[0])}</bdi>
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
                    {meta && <small className="gl-st-meta">{meta}</small>}
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
                <td data-label="نوع الحركة" className="gl-st-type">
                    <LineKind entry={entry} />
                </td>
                <td data-label="عليه" className="gl-st-cash gl-st-owe">
                    {!entry.isCredit && <LineAmount entry={entry} />}
                </td>
                <td data-label="له" className="gl-st-cash gl-st-paid">
                    {entry.isCredit && <LineAmount entry={entry} />}
                </td>
                <td data-label="الرصيد (شيكل)" className="gl-st-cash gl-st-bal">
                    {isHistory ? (
                        <span title="أُلغيت مع قيدها العكسي، فلم تغيّر الرصيد" className="text-gray-300">—</span>
                    ) : (
                        <Balance value={entry.balance} colored={false} unit="" paperWord={false} className="gl-st-money" />
                    )}
                </td>
                {hasLineMenus && <td className="gl-st-act">{menu && <RowActionsMenu menu={menu} menuController={actionsMenu} />}</td>}
            </tr>
            {open && (
                <tr id={detailsId} className="gl-st-detail">
                    <td />
                    <td colSpan={hasLineMenus ? 8 : 7}>
                        <dl>
                            {details.map(([label, value, ltr]) => (
                                <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>{ltr ? <bdi dir="ltr">{value}</bdi> : value}</dd>
                                </div>
                            ))}
                            {entry.paidOn && (
                                <div className="gl-st-detail-wide">
                                    <dt>الدفع والتسجيل</dt>
                                    <dd><LatePaymentDetails paidOn={entry.paidOn} recordedAt={entry.date} reason={entry.lateReason} /></dd>
                                </div>
                            )}
                        </dl>
                    </td>
                </tr>
            )}
        </>
    );
}

/**
 * The statement's lines as the redesign's ledger: a slim row each (#,
 * date, what it is, its kind, عليه or له, and the balance after it), in
 * bands of one month with what was charged and credited in it; the
 * chevron opens the rest of the line's columns under it, so nothing of
 * the full statement is lost. The line's menu, its right-click and
 * Shift + F10, the links between related lines and the folded history of
 * the compact view all work as before.
 */
export default function StatementLedger({ rows, empty, banded, isCompact, openHistories, onToggleHistory, chains, hoveredChain, onHoverChain, highlightedLineId, focusedLineId, hasLineMenus, onJump, onAction }) {
    const bands = monthBands(rows, banded);
    const columnCount = HEADINGS.length + 1 + (hasLineMenus ? 1 : 0);

    return (
        <div className="gl-st-scroll">
            <table className="gl-st-table">
                <thead>
                    <tr>
                        <th className="gl-st-x"><span className="sr-only">تفاصيل</span></th>
                        {HEADINGS.map((heading, index) => (
                            <th key={heading} className={index >= 4 ? 'gl-st-cash' : undefined}>{heading}</th>
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
                                        <td colSpan={5}>
                                            <span className="gl-st-month-name">
                                                <b>{band.month}</b>
                                                <span>{band.entries.length} حركة</span>
                                            </span>
                                        </td>
                                        <td className="gl-st-cash"><small>عليه</small> <bdi dir="ltr">{formatAmount(band.charged)}</bdi></td>
                                        <td className="gl-st-cash"><small>له</small> <bdi dir="ltr">{formatAmount(band.credited)}</bdi></td>
                                        <td colSpan={hasLineMenus ? 2 : 1} />
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
