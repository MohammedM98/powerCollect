import { Button } from '@heroui/react';
import BankReceivedDate from '@/Components/BankReceivedDate';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import StatusPill from '@/Components/DataTable/StatusPill';
import Balance from '@/Components/Balance';
import LatePaymentDetails from '@/Components/LatePaymentDetails';
import { chainColor, followsLineAbove, hasLineMenu, netOfReadingDiscount, rowClass } from '@/lib/accountStatement';

import SplitPaymentBadge from '@/Pages/Payments/SplitPaymentBadge';
import { statementRowTotals } from '@/lib/statementPrint';
import { useRowActionsMenu } from '@/hooks/useRowActionsMenu';
import { withLtrDates, Dash, StatementDate, CancellationNote, CorrectsNote, ReversalNote, LinkedReversalNote, HistoryToggle, ReadingDiscountNote, AmendmentBadge } from './StatementNotes';
import { lineActionsMenu } from './statementLineActions';
import { formatMoney } from '@/lib/format';

/**
 * One statement line. In the compact view a line may carry its reading's
 * standing discount (`discountLine`, shown as one bill: the amount after
 * the discount) and the cancelled lines folded under it (`history`).
 * A folded line (`isHistory`) shows no balance: with its reversal it
 * changed nothing.
 */
export function StatementRow({
    entry,
    chain = null,
    hoveredChain = null,
    onHoverChain,
    isCompact,
    isHistory = false,
    highlighted,
    focused = false,
    hasLineMenus,
    historyOpen = false,
    onToggleHistory,
    onJump,
    onAction,
    fullPaymentDetails = false,
}) {
    const actionsMenu = useRowActionsMenu();
    const menu = hasLineMenus && hasLineMenu(entry) ? lineActionsMenu(entry, onAction) : null;
    const showsHistory = isCompact && !isHistory && entry.history?.length > 0;
    const color = chainColor(chain);

    return (
        <tr
            {...actionsMenu.rowProps(Boolean(menu))}
            id={`statement-line-${entry.id}`}
            data-print-totals={JSON.stringify(statementRowTotals(entry, isHistory))}
            data-print-currency={entry.currencyLabel}
            className={rowClass(entry, highlighted && !focused, isHistory, chain !== null && chain === hoveredChain, focused)}
            style={color ? { '--ledger-chain': color } : undefined}
            data-chain={chain ?? undefined}
            onMouseEnter={chain ? () => onHoverChain(chain) : undefined}
            onMouseLeave={chain ? () => onHoverChain(null) : undefined}
        >
            <td data-label="#" className="whitespace-nowrap tabular-nums">
                <span className="inline-flex items-center gap-1.5 font-semibold text-gray-700" title={chain ? 'الحركات المرتبطة بنفس اللون' : undefined}>
                    {color && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: `rgb(${color})` }} />}
                    #{entry.lineNumber}
                    {entry.discountLine && <span className="font-normal text-gray-400">+ #{entry.discountLine.lineNumber}</span>}
                </span>
            </td>
            <td data-label="رقم الصندوق" className="tabular-nums text-gray-700">
                {entry.cashBox ?? <Dash />}
            </td>
            <td data-label="رقم السند" className="font-semibold tabular-nums text-gray-900">
                {entry.voucherNumber ?? <Dash />}
            </td>
            <td data-label="الرقم المرجعي" className="tabular-nums text-gray-700">
                <div className="flex min-w-0 flex-col items-start gap-1">
                    {/* A cut-short reference shows in full when focused. */}
                    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
                    {entry.referenceNumber ? <bdi dir="ltr" className="statement-reference" title={entry.referenceNumber} tabIndex={0}>{entry.referenceNumber}</bdi> : <Dash />}
                    {entry.splitPayment && <SplitPaymentBadge split={entry.splitPayment} compact />}
                </div>
            </td>
            <td data-label="البنك" className="text-gray-700">
                {entry.bankName ? (
                    <div className="grid gap-1">
                        {entry.senderBankName && <span>من: {entry.senderBankName}</span>}
                        <span>إلى: {entry.bankName}</span>
                    </div>
                ) : <Dash />}
            </td>
            <td data-label="تاريخ الحركة" className="whitespace-nowrap tabular-nums text-gray-600">
                {entry.paidOn ? (
                    fullPaymentDetails ? <LatePaymentDetails paidOn={entry.paidOn} recordedAt={entry.date} reason={entry.lateReason} /> : (
                        <>
                            <span className="statement-screen-only statement-late-dates">
                                <StatusPill tone="amber" label="متأخرة" />
                                <span className="statement-date-label">الدفع الفعلي</span>
                                <StatementDate value={entry.paidOn} />
                                <span className="statement-date-label">التسجيل بالنظام</span>
                                <StatementDate value={entry.date} />
                            </span>
                            <span className="statement-print-only"><LatePaymentDetails paidOn={entry.paidOn} recordedAt={entry.date} reason={entry.lateReason} /></span>
                        </>
                    )
                ) : <StatementDate value={entry.date} />}
            </td>
            <td data-label="البيان" className="font-medium text-gray-900">
                <div className="ledger-description statement-description-title">
                    {(isHistory || followsLineAbove(entry)) && <span className="me-1 text-blue-600">↲</span>}
                    <span className="ledger-struck">{withLtrDates(entry.description)}</span>
                </div>
                <BankReceivedDate value={entry.bankReceivedOn} />
                {entry.details && <p className="ledger-description statement-description-details">{withLtrDates(entry.details)}</p>}
                {!fullPaymentDetails && entry.lateReason && !entry.details?.includes(entry.lateReason) && (
                    <p className="ledger-description statement-description-details statement-screen-only">سبب التأخير: {entry.lateReason}</p>
                )}
                {entry.discountLine && <ReadingDiscountNote discountLine={entry.discountLine} />}
                {entry.cancellation && <CancellationNote cancellation={entry.cancellation} onJump={onJump} />}
                {entry.reverses && <ReversalNote entry={entry} reverses={entry.reverses} onJump={onJump} />}
                {entry.auditOriginal && <p className="ledger-description mt-1.5 text-xs text-gray-600"><Button onClick={() => onJump(entry.auditOriginal.id)} className="font-semibold hover:underline">تصحيح حوالة للدفعة #{entry.auditOriginal.lineNumber} ↑</Button></p>}
                {entry.linkedReversal && <LinkedReversalNote reversal={entry.linkedReversal} onJump={onJump} />}
                {showsHistory ? (
                    <HistoryToggle entry={entry} isOpen={historyOpen} onToggle={onToggleHistory} />
                ) : (
                    entry.corrects && <CorrectsNote corrects={entry.corrects} onJump={onJump} />
                )}
            </td>
            <td
                data-label="المبلغ"
                className="font-display font-semibold tabular-nums text-gray-900"
            >
                {entry.discountLine ? (
                    <span className="grid gap-0.5">
                        <span>{formatMoney(netOfReadingDiscount(entry))}</span>
                        <span className="font-sans text-xs font-normal text-gray-500" title="القراءة − خصم القراءة الأسبوعية">
                            <bdi dir="ltr">
                                {formatMoney(entry.amount)} − {formatMoney(entry.discountLine.amount)}
                            </bdi>
                        </span>
                    </span>
                ) : (
                    <span className="ledger-struck">{formatMoney(entry.amount)}</span>
                )}
            </td>
            <td data-label="العملة" className="text-gray-700">
                {entry.currencyLabel}
            </td>
            <td data-label="نوع الحركة">
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <StatusPill tone={entry.isCredit ? 'green' : 'red'} label={entry.isCredit ? 'له' : 'عليه'} />
                    <span className="font-medium text-gray-900">{entry.typeLabel}</span>
                    {entry.discountLine && <span className="text-xs text-emerald-700 dark:text-emerald-400">بعد خصم القراءة الأسبوعية</span>}
                    {entry.cancellation && (
                        <StatusPill tone={entry.cancellation.wasCorrected ? 'amber' : 'gray'} label={entry.cancellation.wasCorrected ? 'مُصحّحة' : 'ملغاة'} />
                    )}
                    {entry.isCorrection && (
                        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            تصحيح
                        </span>
                    )}
                    {entry.isAmended && <AmendmentBadge amendments={entry.amendments} />}
                </span>
            </td>
            <td data-label="طريقة الدفع" className="text-gray-700">
                {entry.paymentMethodLabel ?? <Dash />}
            </td>
            <td data-label="سعر الصرف" className="tabular-nums text-gray-600">
                {entry.exchangeRate}
            </td>
            <td data-label="الرصيد (شيكل)">
                {isHistory ? (
                    <span title="أُلغيت مع قيدها العكسي، فلم تغيّر الرصيد">
                        <Dash />
                    </span>
                ) : (
                    <Balance value={entry.balance} colored={false} unit="" paperWord={false} className="font-bold text-gray-900" />
                )}
            </td>
            <td data-label="اسم المستخدم" className="text-gray-700">
                {entry.recordedByName ?? <Dash />}
            </td>
            {hasLineMenus && (
                <td className="statement-screen-only text-center align-middle!">
                    {menu && <RowActionsMenu menu={menu} menuController={actionsMenu} />}
                </td>
            )}
        </tr>
    );
}
