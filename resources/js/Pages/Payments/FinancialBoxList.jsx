import { useState } from 'react';
import Icon from '@/Components/Icon';
import { formatMoney } from '@/lib/format';
import { activeBoxEntries, boxReconciliation, financialBoxTotals, isFlaggedEntry } from '@/lib/financialBoxes';
import { Button, Chip } from '@heroui/react';
import { BoxStage, boxTypeStyles, currencies } from './CollectorCashBox';
import { BoxPerson, FinancialBoxButton, FinancialBoxDates, FinancialBoxEntries, FinancialBoxMark, FinancialBoxTimes, financialAmountsLine } from './FinancialBoxComponents';
import { ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable } from '@/Components/UI';
import './financial-boxes.css';


const STEP_LABELS = ['مفتوح، لم يُسلَّم', 'مُسلَّم، بانتظار العدّ أو المطابقة', 'مطابَق، بانتظار الاعتماد', 'معتمد من التدقيق'];

/** The box's way from open to approved as four steps, the current one coloured, with its words under it. */
function BoxSteps({ reconciliation }) {
    const { step, problem } = reconciliation;
    const label = problem && step < 3 ? 'فيه فرق، بانتظار التدقيق' : STEP_LABELS[step];
    const tone = problem && step < 3 ? 'owe' : step === 3 ? 'pay' : step === 0 ? 'warn' : 'muted';

    return (
        <span className="gl-rc-steps" data-tone={tone}>
            <span className="gl-rc-track" role="img" aria-label={`المرحلة ${step + 1} من 4: ${label}`}>
                {[0, 1, 2, 3].map((index) => <i key={index} data-state={index < step ? 'done' : index === step ? (problem && step < 3 ? 'bad' : step === 3 ? 'done' : 'now') : undefined} />)}
            </span>
            <small>{label}</small>
        </span>
    );
}

/** A shekel figure for the reconciliation columns, a dash while there is none. */
function Shekels({ value, tone = null }) {
    if (value === null) {
        return <span className="gl-rc-none">—</span>;
    }

    return <bdi dir="ltr" className="gl-cb-money" data-tone={tone ?? undefined}>{value > 0 && tone ? '+' : ''}{formatMoney(value)}</bdi>;
}

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
            <Button data-raw="" variant="ghost" onClick={() => onSort(column)} className="gl-cb-sort" aria-label={`${label}${active ? (sortState.direction === 'asc' ? '، ترتيب تصاعدي' : '، ترتيب تنازلي') : '، ترتيب'}`}>
                {label}
                <Icon name="chevron-down" className={`h-3.5 w-3.5 ${active ? 'is-active' : ''} ${active && sortState.direction === 'asc' ? 'rotate-180' : ''}`} />
            </Button>
        );
    }

    if (!boxes.length) {
        return null;
    }

    return (
        <div className="gl-cb-scroll">
            <ListTable className="gl-cb-table" aria-label="الصناديق المالية">
                <ListHeader>
                    <ListColumn id="details" className="gl-cb-x"><span className="sr-only">تفاصيل</span></ListColumn>
                    <ListColumn id="number" isRowHeader>{heading('number', 'الصندوق')}</ListColumn>
                    <ListColumn id="person">{collector ? 'أغلقه / المستلم' : 'الموظف'}</ListColumn>
                    {collector ? <>
                        <ListColumn id="entries">الحركات</ListColumn>
                        <ListColumn id="total" className="gl-cb-cash">{heading('total', 'الإجمالي')}</ListColumn>
                        <ListColumn id="status">{heading('status', 'الحالة')}</ListColumn>
                    </> : <>
                        <ListColumn id="status">{heading('status', 'المرحلة')}</ListColumn>
                        <ListColumn id="total" className="gl-cb-cash">{heading('total', 'المتوقع')}</ListColumn>
                        <ListColumn id="confirmed" className="gl-cb-cash">المؤكَّد</ListColumn>
                        <ListColumn id="difference" className="gl-cb-cash">الفرق</ListColumn>
                    </>}
                    <ListColumn id="actions" className="gl-cb-act"><span className="sr-only">الإجراءات</span></ListColumn>
                </ListHeader>
                <ListBody>
                    {boxes.map((box) => {
                        const open = opened.has(box.id);
                        const period = periodFor ? periodFor(box) : null;
                        const reconciliation = collector ? null : boxReconciliation(box);

                        return [
                            <ListRow key={box.id} id={box.id} className={open ? 'is-open' : undefined} onOpen={() => onOpen(box)}>
                                <ListCell className="gl-cb-x">
                                    <Button data-raw="" variant="ghost" className="gl-st-exp" aria-expanded={open} aria-label={`تفاصيل صندوق ${box.number}`} onClick={() => toggle(box.id)}>
                                        <Icon name="chevron-down" className="h-4 w-4" />
                                    </Button>
                                </ListCell>
                                <ListCell>
                                    <span className="gl-cb-box">
                                        <FinancialBoxMark box={box} />
                                        <span className="min-w-0">
                                            <Button data-raw="" variant="ghost" className="gl-cb-no" onClick={() => onOpen(box)} aria-label={`عرض صندوق ${box.number}`}>
                                                <bdi dir="ltr">{box.number}</bdi>
                                            </Button>
                                            <small>{boxTypeStyles[box.type].label}{period && period !== '—' ? `، ${period}` : ''}</small>
                                        </span>
                                    </span>
                                </ListCell>
                                <ListCell>
                                    {collector ? (
                                        <BoxPerson name={box.closedBy} note={box.receivedAt ? `المستلم: ${financialAmountsLine(box.receivedAmounts ?? {})}` : null} />
                                    ) : (
                                        <BoxPerson name={box.user?.name} suffix={box.isOwn ? '(أنت)' : null} note={box.branchName} />
                                    )}
                                </ListCell>
                                {collector ? <>
                                    <ListCell className="gl-cb-n"><EntriesCount box={box} /></ListCell>
                                    <ListCell className="gl-cb-cash"><BoxTotal box={box} /></ListCell>
                                    <ListCell><BoxStage box={box} /></ListCell>
                                </> : <>
                                    <ListCell><BoxSteps reconciliation={reconciliation} /></ListCell>
                                    <ListCell className="gl-cb-cash"><BoxTotal box={box} /><small className="gl-rc-count"><EntriesCount box={box} /></small></ListCell>
                                    <ListCell className="gl-cb-cash">
                                        <Shekels value={reconciliation.confirmed} />
                                        {reconciliation.toReview > 0 && box.type !== 'cash' && (
                                            <Chip size="sm" variant="soft" className="gl-rc-chip" data-tone={reconciliation.reviewed === reconciliation.toReview ? 'pay' : 'warn'}>
                                                طوبق {reconciliation.reviewed} من {reconciliation.toReview}
                                            </Chip>
                                        )}
                                    </ListCell>
                                    <ListCell className="gl-cb-cash"><Shekels value={reconciliation.difference} tone={reconciliation.problem ? (reconciliation.difference < 0 ? 'owe' : 'warn') : 'pay'} /></ListCell>
                                </>}
                                <ListCell className="gl-cb-act">{renderActions ? renderActions(box) : <FinancialBoxButton box={box} onOpen={onOpen} />}</ListCell>
                            </ListRow>,
                            open && (
                                <ListRow key={`${box.id}:detail`} id={`${box.id}:detail`} className="gl-st-detail gl-cb-detail">
                                    <ListCell />
                                    <ListCell colSpan={collector ? 6 : 7}>
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
                                    </ListCell>
                                </ListRow>
                            ),
                        ];
                    })}
                </ListBody>
            </ListTable>
        </div>
    );
}
