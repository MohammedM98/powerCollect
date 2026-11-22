import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Icon from '@/Components/UI/Icon';
import { Card } from '@heroui/react';
import { useDataTable } from '@/hooks/useDataTable';
import { formatMoney } from '@/lib/format';
import {
    boxTypes,
    BoxCard,
    BoxStage,
    BoxTypeIcon,
    CashBoxAction,
    CollectorAuditNotes,
    CollectorDebts,
    boxAction,
    actionLabel,
} from './CollectorCashBox';
import OpenEntriesTable from './OpenEntriesTable';
import PageHeader from '@/Components/PageHeader';
import InfoTip from '@/Components/UI/InfoTip';
import { Notice, PrimaryKey } from '@/Components/UI';

/**
 * What the user collected today, on the prototype's charcoal card: the
 * total, then one bar split by how it came in (cash and transfers) with the
 * amounts beside it.
 */
function TodaysSummary({ today }) {
    const total = Number(today.total) || 0;
    const parts = [
        { key: 'cash', label: 'نقدًا', value: Number(today.cash), color: '#6dbf98' },
        { key: 'transfers', label: 'تحويلات بنكية', value: Number(today.transfers), color: '#93b2d8' },
    ];

    return (
        <Card aria-label="ما حصّلته اليوم" className="gl-today">
            <small>ما حصّلته اليوم</small>
            <b><bdi dir="ltr">{formatMoney(today.total)}</bdi> <span>₪</span></b>
            <p>{today.count.toLocaleString('en')} {today.count === 1 ? 'دفعة' : 'دفعات'}</p>
            <div className="gl-today-split" aria-hidden="true">
                {total > 0 && parts.map((part) => part.value > 0 && <span key={part.key} style={{ width: `${(part.value / total) * 100}%`, background: part.color }} />)}
            </div>
            <dl className="gl-today-parts">
                {parts.map((part) => (
                    <div key={part.key}>
                        <dt><i style={{ background: part.color }} aria-hidden="true" />{part.label}</dt>
                        <dd><bdi dir="ltr">{formatMoney(part.value)}</bdi> ₪</dd>
                    </div>
                ))}
            </dl>
        </Card>
    );
}

const dayName = (date) => new Intl.DateTimeFormat('ar', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

/** The user's last seven days of collection as columns, cash and transfers stacked, each day's total above it. */
function RecentDays({ days }) {
    const totals = days.map((day) => Number(day.cash) + Number(day.transfers));
    const largest = Math.max(1, ...totals);

    return (
        <Card className="gl-week" aria-labelledby="recent-days-title">
            <Card.Header className="gl-flow-head">
                <span className="gl-set-ico" aria-hidden="true"><Icon name="chart" /></span>
                <Card.Title id="recent-days-title" className="gl-set-title">تحصيلك في آخر 7 أيام</Card.Title>
                <span className="gl-flow-week"><i className="gl-week-key" style={{ background: '#2d855c' }} />نقدًا <i className="gl-week-key" style={{ background: 'var(--ma-clr)' }} />تحويلات</span>
            </Card.Header>
            <Card.Content>
                <ol className="gl-week-days">
                    {days.map((day, index) => (
                        <li key={day.date} aria-label={`${dayName(day.date)}: ${formatMoney(totals[index])} شيكل، منها نقدًا ${formatMoney(day.cash)}`}>
                            <b><bdi dir="ltr">{formatMoney(totals[index])}</bdi></b>
                            <span className="gl-week-col" style={{ height: `${Math.max(2, (totals[index] / largest) * 100)}%` }}>
                                {Number(day.transfers) > 0 && <span style={{ flex: Number(day.transfers), background: 'var(--ma-clr)' }} />}
                                {Number(day.cash) > 0 && <span style={{ flex: Number(day.cash), background: '#2d855c' }} />}
                            </span>
                            <small>{dayName(day.date)}</small>
                        </li>
                    ))}
                </ol>
            </Card.Content>
        </Card>
    );
}

/** The user's latest payments today, each with its receipt. */
function TodaysPayments({ today }) {
    return (
        <section aria-labelledby="todays-payments" className="mt-8 space-y-4">
            <h2 id="todays-payments" className="font-sans text-lg font-bold text-(--ma-ink)">
                آخر دفعاتك اليوم
            </h2>

            {today.payments.length > 0 ? (
                <ul className="divide-y divide-(--ma-line) overflow-hidden rounded-panel border border-(--ma-line) bg-(--ma-solid) shadow-card">
                    {today.payments.map((payment) => (
                        <li key={payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                            <span className="min-w-0 flex-1 basis-48 font-semibold text-(--ma-ink)">{payment.subscriptionName}</span>
                            <span className="text-(--ma-muted)">
                                {payment.methodLabel}
                                {payment.bankName && `، ${payment.bankName}`}
                            </span>
                            {payment.voucherNumber && (
                                <span dir="ltr" className="font-display text-xs text-(--ma-muted)">
                                    #{payment.voucherNumber}
                                </span>
                            )}
                            <span dir="ltr" className="font-display text-xs text-(--ma-muted)">
                                {payment.time}
                            </span>
                            <b className="font-display text-base text-(--ma-pay)">{formatMoney(payment.amount)} ₪</b>
                            <a
                                href={payment.receiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="tone-print inline-flex items-center gap-2 rounded-control border px-3 py-2 text-xs font-semibold transition"
                            >
                                <Icon name="printer" className="h-4 w-4" />
                                السند
                            </a>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="rounded-panel border border-dashed border-(--ma-line) bg-(--ma-solid) px-4 py-8 text-center text-sm text-(--ma-muted)">لم تسجّل أي دفعة اليوم بعد.</p>
            )}
        </section>
    );
}

/**
 * The collector's summary: what they collected today, what waits on them
 * (entries the branch sent back, a handover to confirm, audit notes,
 * debts), the boxes open now, every entry in them in one table, searched
 * and narrowed to one type of box (a box's card picks its type), and their
 * latest payments today with receipts.
 */
export default function Summary({ today, recentDays = [], cashBox, current, entries, filters, counts, needsAction, pendingCount, collectionUrls }) {
    const [selected, setSelected] = useState(null);
    const [saved, setSaved] = useState(null);
    const table = useDataTable(collectionUrls.summary, filters);
    const shownType = table.filterValues.type ?? '';

    /** Shows only the entries of one type of box in the table below, or every entry again when that type is already shown. */
    function showBoxType(type) {
        if (shownType === type) {
            table.setFilter('type', '');
            return;
        }

        table.setFilter('type', type);
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        document.getElementById('open-entries')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }

    return <AuthenticatedLayout badges={{ '/payments/summary': pendingCount }} header={<PageHeader eyebrow={cashBox.branchName ?? 'حسابك الحالي'} title="ملخص التحصيل" />}>
        <Head title="ملخص التحصيل" />
        {saved && <Notice tone="success" role="status" className="mb-4">{saved}</Notice>}
        <div className="gl-today-row">
            <TodaysSummary today={today} />
            {recentDays.length > 0 && <RecentDays days={recentDays} />}
        </div>
        {cashBox.started ? <div className="space-y-8">
            {needsAction.length > 0 && <section className="space-y-3 rounded-[18px] bg-(--ma-warn-s) p-4 shadow-(--ma-hl)">
                <h3 className="font-bold text-(--ma-ink)">تحتاج إجراء منك</h3>
                {needsAction.map((box) => <div key={box.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-(--ma-line) pt-3"><div className="flex items-center gap-3"><BoxTypeIcon type={box.type} className="h-10 w-10" /><div className="space-y-2"><Link href={box.urls.show} prefetch className="font-semibold text-(--ma-ink)">{boxTypes[box.type]}، <bdi dir="ltr" className="font-display text-xs">{box.number}</bdi></Link><BoxStage box={box} /></div></div><PrimaryKey onClick={() => setSelected({ box, action: boxAction(box) })}>{actionLabel(box)}</PrimaryKey></div>)}
            </section>}
            <CollectorAuditNotes notes={cashBox.auditNotes} onSaved={() => setSaved('أُرسل ردّك إلى الفرع.')} />
            <CollectorDebts debts={cashBox.debts} />

            <section aria-labelledby="open-boxes" className="space-y-4">
                <div className="flex items-center gap-1">
                    <h3 id="open-boxes" className="text-lg font-bold text-(--ma-ink)">صناديقي المفتوحة</h3>
                    <InfoTip label="عن صناديقي المفتوحة">لكل نوع صندوق خاص به؛ يراجعه الفرع ويؤكد إغلاقه، أو يُغلق عند القطع الأسبوعي.</InfoTip>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    {Object.keys(boxTypes).map((type) => <BoxCard key={type} type={type} box={current[type]} selected={shownType === type && Boolean(current[type])} onSelect={() => showBoxType(type)} />)}
                </div>
            </section>

            <section id="open-entries" aria-labelledby="open-entries-title" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-1">
                    <h3 id="open-entries-title" className="text-lg font-bold text-(--ma-ink)">حركاتي المفتوحة</h3>
                    <InfoTip label="عن حركاتي المفتوحة">كل ما سجّلته في صناديقك المفتوحة؛ حركات الصناديق المغلقة تجدها داخل كل صندوق في صفحة الصناديق المالية.</InfoTip>
                </div>
                <OpenEntriesTable table={table} entries={entries} filters={filters} counts={counts} url={collectionUrls.summary} label="حركاتي المفتوحة" />
            </section>
        </div> : <p className="rounded-panel border border-dashed border-(--ma-line) bg-(--ma-solid) p-6 text-sm leading-7 text-(--ma-muted)">{cashBox.branchName ? 'تُفتح الصناديق تلقائيًا عند تسجيل أول دفعة أو مقاصة في فرعك.' : 'حسابك غير مرتبط بفرع، لذلك لا يوجد سجل صناديق شخصي.'}</p>}
        <TodaysPayments today={today} />
        {selected && <CashBoxAction key={`${selected.box.id}-${selected.action}`} {...selected} onClose={() => setSelected(null)} onSuccess={() => setSaved('تم تأكيد التسليم.')} />}
    </AuthenticatedLayout>;
}
