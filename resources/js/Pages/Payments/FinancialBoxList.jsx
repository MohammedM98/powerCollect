import { Fragment, useState } from 'react';
import Icon from '@/Components/Icon';
import { useRowClick } from '@/hooks/useRowClick';
import { formatMoney } from '@/lib/format';
import { activeBoxEntries, financialBoxTotals, isFlaggedEntry } from '@/lib/financialBoxes';
import { BoxStage, boxTypeStyles, currencies } from './CollectorCashBox';
import { BoxPerson, FinancialBoxButton, FinancialBoxDates, FinancialBoxEntries, FinancialBoxMark, FinancialBoxStatus, FinancialBoxTimes, financialAmountsLine } from './FinancialBoxComponents';
import './financial-boxes.css';

/** A box's entries in a word: how many, and how many were cancelled or found wrong. */
function EntriesCount({ box }) {
    const entries = activeBoxEntries(box);
    const count = box.paymentCount ?? entries.length;
    const cancelled = box.payments ? box.payments.length - entries.length : 0;
    const flagged = box.type !== 'cash' && box.payments ? entries.filter(isFlaggedEntry).length : 0;
    const notes = [cancelled > 0 && `${cancelled} ملغاة`, flagged > 0 && `${flagged} ${box.type === 'clearing' ? 'مرفوضة' : 'غير موجودة'}`, box.rejectedCount > 0 && `${box.rejectedCount} مرفوضة`].filter(Boolean);

    return (
        <>
            <b className="gl-num">{count}</b> حركة
            {notes.length > 0 && <small>{notes.join('، ')}</small>}
        </>
    );
}

/** A box's total in shekels, and what it holds in other currencies under it. */
function BoxTotal({ box }) {
    const totals = financialBoxTotals(box);
    const others = Object.keys(currencies).filter((currency) => currency !== 'ILS' && Number(totals[currency] ?? 0) !== 0).map((currency) => `${formatMoney(totals[currency])} ${currencies[currency]}`);

    return (
        <>
            <bdi dir="ltr" className="gl-cb-money">{formatMoney(totals.ILS)}</bdi> <span className="gl-cb-muted">شيكل</span>
            {others.length > 0 && <small>و{others.join('، ')}</small>}
        </>
    );
}

/**
 * The boxes as the redesign's calm table, for the branch and the
 * collector's history alike: the box (its type's icon with a dot for its
 * state, its number and week), whose it is, its entries, its total, its
 * state and one action. The chevron opens the rest: when it was opened,
 * closed and audited, and by whom. The whole row opens the box.
 */
export default function FinancialBoxList({ boxes, onOpen, periodFor, sortState, onSort, collector = false, renderActions }) {
    const rowClick = useRowClick();
    const [opened, setOpened] = useState(() => new Set());

    function toggle(boxId) {
        setOpened((current) => {
            const next = new Set(current);
            next.has(boxId) ? next.delete(boxId) : next.add(boxId);

            return next;
        });
    }

    function heading(column, label) {
        if (!onSort) {
            return label;
        }

        const active = sortState?.sort === column;

        return (
            <button type="button" onClick={() => onSort(column)} className="gl-cb-sort" aria-label={`${label}${active ? (sortState.direction === 'asc' ? '، ترتيب تصاعدي' : '، ترتيب تنازلي') : '، ترتيب'}`}>
                {label}
                <Icon name="chevron-down" className={`h-3.5 w-3.5 ${active ? 'is-active' : ''} ${active && sortState.direction === 'asc' ? 'rotate-180' : ''}`} />
            </button>
        );
    }

    if (!boxes.length) {
        return null;
    }

    return (
        <div className="gl-cb-scroll">
            <table className="gl-cb-table">
                <caption className="sr-only">الصناديق المالية</caption>
                <thead>
                    <tr>
                        <th className="gl-cb-x"><span className="sr-only">تفاصيل</span></th>
                        <th>{heading('number', 'الصندوق')}</th>
                        <th>{collector ? 'أغلقه / المستلم' : 'الموظف'}</th>
                        <th>الحركات</th>
                        <th className="gl-cb-cash">{heading('total', 'الإجمالي')}</th>
                        <th>{heading('status', 'الحالة')}</th>
                        <th className="gl-cb-act"><span className="sr-only">الإجراءات</span></th>
                    </tr>
                </thead>
                <tbody>
                    {boxes.map((box) => {
                        const open = opened.has(box.id);
                        const period = periodFor ? periodFor(box) : null;

                        return (
                            <Fragment key={box.id}>
                                <tr className={open ? 'is-open' : undefined} {...rowClick(() => onOpen(box))}>
                                    <td className="gl-cb-x">
                                        <button type="button" className="gl-st-exp" aria-expanded={open} aria-label={`تفاصيل صندوق ${box.number}`} onClick={() => toggle(box.id)}>
                                            <Icon name="chevron-down" className="h-4 w-4" />
                                        </button>
                                    </td>
                                    <td>
                                        <span className="gl-cb-box">
                                            <FinancialBoxMark box={box} />
                                            <span className="min-w-0">
                                                <button type="button" className="gl-cb-no" onClick={() => onOpen(box)} aria-label={`عرض صندوق ${box.number}`}>
                                                    <bdi dir="ltr">{box.number}</bdi>
                                                </button>
                                                <small>{boxTypeStyles[box.type].label}{period && period !== '—' ? `، ${period}` : ''}</small>
                                            </span>
                                        </span>
                                    </td>
                                    <td>
                                        {collector ? (
                                            <BoxPerson name={box.closedBy} note={box.receivedAt ? `المستلم: ${financialAmountsLine(box.receivedAmounts ?? {})}` : null} />
                                        ) : (
                                            <BoxPerson name={box.user?.name} suffix={box.isOwn ? '(أنت)' : null} note={box.branchName} />
                                        )}
                                    </td>
                                    <td className="gl-cb-n"><EntriesCount box={box} /></td>
                                    <td className="gl-cb-cash"><BoxTotal box={box} /></td>
                                    <td>{collector ? <BoxStage box={box} /> : <FinancialBoxStatus box={box} />}</td>
                                    <td className="gl-cb-act">{renderActions ? renderActions(box) : <FinancialBoxButton box={box} onOpen={onOpen} />}</td>
                                </tr>
                                {open && (
                                    <tr className="gl-st-detail gl-cb-detail">
                                        <td />
                                        <td colSpan={6}>
                                            <dl>
                                                <div>
                                                    <dt>{collector ? 'فُتح ← أُغلق' : 'الأوقات'}</dt>
                                                    <dd>{collector ? <FinancialBoxDates box={box} /> : <FinancialBoxTimes box={box} />}</dd>
                                                </div>
                                                <div>
                                                    <dt>الحركات</dt>
                                                    <dd><FinancialBoxEntries box={box} /></dd>
                                                </div>
                                                <div>
                                                    <dt>الإجمالي بكل العملات</dt>
                                                    <dd>{financialAmountsLine(financialBoxTotals(box))}</dd>
                                                </div>
                                            </dl>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
