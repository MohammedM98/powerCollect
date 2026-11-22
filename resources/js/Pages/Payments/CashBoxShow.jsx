import { useState } from 'react';
import TableExportActions from '@/Components/DataTable/TableExportActions';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import KpiTile from '@/Components/Charts/KpiTile';
import Icon from '@/Components/UI/Icon';
import { formatMoney } from '@/lib/format';
import { isPrintMode } from '@/lib/print';
import { boxTypes, currencies, dateTime, BoxEntriesTable, BoxStage, BoxTypeChip, BoxTypeIcon, CountSummary, CashBoxAction, boxAction, actionLabel } from './CollectorCashBox';
import PageHeader, { BackLink } from '@/Components/PageHeader';
import { Notice, PrimaryKey } from '@/Components/UI';

/** A link that looks like the quiet outlined button. */
/** Where each type of box goes when it closes. */
const destinations = { cash: 'خزنة الفرع', bank_transfer: 'حساب البنك', clearing: 'المقاصات' };

/** Foreign currencies a set of amounts holds, as one quiet line. */
function otherCurrencies(amounts) {
    const lines = Object.keys(currencies).filter((currency) => currency !== 'ILS' && Number(amounts?.[currency] ?? 0) !== 0).map((currency) => `${formatMoney(amounts[currency])} ${currencies[currency]}`);

    return lines.length ? lines.join('، ') : undefined;
}

/**
 * One of the collector's boxes: its type, stage and report on top, its
 * figures (total, what the branch received, entries, who closed it), its
 * timeline, the branch's count for a cash box, and every entry in it with
 * each payment's receipt.
 */
export default function CashBoxShow({ box, entries, collectionUrls, pendingCount }) {
    const [showAction, setShowAction] = useState(false);
    const [saved, setSaved] = useState(null);
    const cash = box.type === 'cash';
    const action = boxAction(box);
    const printing = isPrintMode();
    // A cash box the branch counted under the old two-step receipt still waits on the collector's confirmation.
    const timeline = [['فُتح', box.openedAt, 'unlock'], ['أُغلق', box.closedAt, 'lock'], ['أكّد الفرع الإغلاق', box.receivedAt, 'office'], ...(box.stage === 'awaiting_confirmation' ? [['تأكيد التسليم', box.confirmedAt, 'check']] : [])];

    return <AuthenticatedLayout badges={{ '/payments/summary': pendingCount }} header={<PageHeader
        eyebrow={<BackLink href={collectionUrls.cashBoxes}>الصناديق المالية</BackLink>}
        title={<span className="inline-flex items-center gap-3"><BoxTypeIcon type={box.type} className="h-11 w-11" />{boxTypes[box.type]}</span>}
        meta={<>صندوق رقم <bdi dir="ltr" className="font-display">{box.number}</bdi></>}
    />}>
        <Head title={`${boxTypes[box.type]} ${box.number}`} />
        <div className="financial-surface space-y-6">
            {saved && <Notice tone="success" role="status">{saved}</Notice>}
            <section className="space-y-6 rounded-panel border border-(--ma-line) bg-(--ma-solid) p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2"><BoxTypeChip type={box.type} /><BoxStage box={box} /></div>
                    <div className="flex flex-wrap items-center gap-2">
                        <TableExportActions title="تقرير تفاصيل الصندوق" base={`/payments/cash-boxes/report?box=${box.id}`} />
                        {action && <PrimaryKey onClick={() => setShowAction(true)}>{actionLabel(box)}</PrimaryKey>}
                    </div>
                </div>
                <ol className={`grid gap-3 sm:grid-cols-2 ${timeline.length > 3 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`} aria-label="مراحل الصندوق">
                    {timeline.map(([label, time, icon]) => (
                        <li key={label} className={`flex items-center gap-3 rounded-control border p-3 ${time ? 'border-(--ma-pay) bg-(--ma-pay-s)' : 'border-(--ma-line) bg-(--ma-tile)'}`}>
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${time ? 'bg-(--ma-pay-s) text-(--ma-pay)' : 'bg-(--ma-tile) text-(--ma-faint)'}`}><Icon name={icon} className="h-4 w-4" /></span>
                            <div><b className="text-sm text-(--ma-ink)">{label}</b><p className="mt-1 text-xs text-(--ma-muted)">{time ? dateTime(time) : 'لم يحدث بعد'}</p></div>
                        </li>
                    ))}
                </ol>
                {box.reason && <p className="text-sm text-(--ma-muted)">سبب فرق العدّ: {box.reason}</p>}
                {box.rejectedCount > 0 && <Notice tone="danger">{box.type === 'clearing' ? 'رفض الفرع بعض المقاصات في هذا الصندوق.' : 'لم يجد الفرع بعض هذه الحوالات في البنك.'} يراجعها مسؤول الفرع وقد يتواصل معك بشأنها؛ لا يلزمك إجراء هنا.</Notice>}
                {/* The printout reads the page's first table, which must be the entries. */}
                {cash && !printing && <CountSummary box={box} />}
                {printing && <p className="data-table-totals">{`صندوق ${box.number}، ${boxTypes[box.type]}، فُتح ${dateTime(box.openedAt)}، أُغلق ${dateTime(box.closedAt)}، ${box.paymentCount} حركات، الإجمالي ${formatMoney(box.totals?.ILS ?? 0)} شيكل، المستلم ${formatMoney(box.receivedAmounts?.ILS ?? 0)} شيكل${box.closedBy ? `، أغلقه ${box.closedBy}` : ''}`}</p>}
            </section>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile hero icon="wallet" label="إجمالي الصندوق" value={formatMoney(box.totals?.ILS ?? 0)} unit="₪" hint={otherCurrencies(box.totals)} />
                <KpiTile icon="check" label="المبلغ المستلم" value={box.receivedAt ? formatMoney(box.receivedAmounts?.ILS ?? 0) : '—'} unit={box.receivedAt ? 'شيكل' : undefined} hint={box.receivedAt ? otherCurrencies(box.receivedAmounts) : 'لم يؤكد الفرع إغلاقه بعد'} />
                <KpiTile icon="list" label="الحركات" value={box.paymentCount.toLocaleString('en')} hint={box.rejectedCount > 0 ? `${box.rejectedCount} مرفوضة` : undefined} />
                <KpiTile icon="lock" label="أغلقه" value={<span className="text-xl">{box.closedBy ?? 'لا يزال مفتوحًا'}</span>} hint={box.status === 'open' ? 'يؤكد الفرع إغلاقه بعد مراجعته، أو يُغلق عند القطع الأسبوعي' : `أُغلق إلى ${destinations[box.type]}`} />
            </div>
            <section className="financial-ledger-section space-y-4">
                <h3 className="text-lg font-bold text-(--ma-ink)">حركات الصندوق</h3>
                <BoxEntriesTable type={box.type} boxNumber={box.number} entries={entries} pagination={{ filters: {}, baseUrl: box.urls.show }} />
            </section>
        </div>
        {showAction && action && <CashBoxAction box={box} action={action} onClose={() => setShowAction(false)} onSuccess={() => setSaved('تم تأكيد التسليم.')} />}
    </AuthenticatedLayout>;
}
