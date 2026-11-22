import { Button } from '@heroui/react';
import { useMemo } from 'react';
import { boardCounters, branchDistributionSummary } from '@/lib/readingBoard';
import { formatNumber, formatDate } from '@/lib/format';
import InputError from '@/Components/UI/InputError';
import DistributionDialog from './DistributionDialog';
import DistributionAreaBreakdown from './DistributionAreaBreakdown';
import { Notice, PrimaryKey, SecondaryKey } from '@/Components/UI';

export default function DistributionSummaryModal({ cycle, boards, readers, paperSheets, abilities, busy, errors, result, onClose, onApprove, onPaper, onPreparePaper, onRemaining }) {
    const columns = useMemo(() => branchDistributionSummary(boards, readers), [boards, readers]);
    const counters = boardCounters(boards);
    const paper = columns.find((column) => column.key === 'paper');
    const available = columns.find((column) => column.key === 'available');
    const readerColumns = columns.filter((column) => column.key.startsWith('reader:'));
    const printed = paperSheets.filter((sheet) => sheet.printCount > 0).length;

    return <DistributionDialog title="ملخّص توزيع الفرع" subtitle={`${cycle.branchName}، قراءة ${formatDate(cycle.readingDate)}، يشمل جميع طبلونات الفرع دون تأثير البحث والتصفية`} busy={busy} onClose={onClose}
        footer={<><SecondaryKey disabled={busy} onClick={onClose}>العودة للتوزيع</SecondaryKey>{abilities.approve && counters.draft > 0 && <PrimaryKey disabled={busy} onClick={onApprove}>اعتماد كل الجاهز ({formatNumber(counters.draft)})</PrimaryKey>}</>}>
        {result && <Notice role="status" tone={result.conflicts.length ? 'warn' : 'success'}>
            {result.action === 'approve' ? 'اعتُمد' : 'حُدّث توزيع'} {formatNumber(result.moved)} طبلون.
            {result.conflicts.length > 0 && <> توجد طبلونات تعذّر تحديثها. <Button data-raw="" variant="ghost" onClick={onClose} className="font-bold underline">عرض أسباب التعارض</Button></>}
        </Notice>}
        <InputError message={errors.approve} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
                ['إجمالي الطبلونات', boards.length], ['على القرّاء', counters.mobile], ['للكشوف الورقية', counters.paper], ['غير موزع', counters.available],
            ].map(([label, count]) => <div key={label} className="rounded-control border border-(--ma-line) bg-(--ma-tile) p-3"><p className="text-xs text-(--ma-muted)">{label}</p><p className="mt-2 font-display text-2xl font-bold text-(--ma-ink)">{formatNumber(count)}</p></div>)}
        </div>
        <div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-(--ma-tile)" aria-hidden="true">{[[counters.mobile, 'bg-(--ma-brand)'], [counters.paper, 'bg-(--ma-pay)'], [counters.available, 'bg-(--ma-warn)']].map(([count, color]) => <span key={color} className={color} style={{ width: `${boards.length ? count / boards.length * 100 : 0}%` }} />)}</div>
            <p className="mt-2 text-xs leading-6 text-(--ma-muted)">{formatNumber(counters.subscribers)} مشترك، {formatNumber(counters.approved)} طبلون معتمد، {formatNumber(counters.draft)} بانتظار الاعتماد</p>
        </div>
        <section aria-label="توزيع القرّاء" className="grid items-start gap-3 md:grid-cols-3">
            {readerColumns.map((reader) => <article key={reader.key} className="min-w-0 rounded-card border border-(--ma-line) p-4">
                <div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--ma-brand-soft) font-bold text-(--ma-brand)">{reader.label.slice(0, 1)}</span><h3 className="font-bold text-(--ma-ink)">{reader.label}</h3></div>
                <p className="mt-3 text-sm text-(--ma-ink)"><b className="font-display text-xl text-(--ma-brand)">{formatNumber(reader.boxes)}</b> طبلون، {formatNumber(reader.subscribers)} مشترك</p>
                {reader.unavailable && <p className="mt-2 text-xs text-(--ma-warn)">تحتاج هذه المهام إلى مراجعة القارئ المكلّف.</p>}
                {reader.drafts > 0 && <p className="mt-2 text-xs text-(--ma-warn)">{formatNumber(reader.drafts)} بانتظار الاعتماد</p>}
                {reader.boxes ? <DistributionAreaBreakdown areas={reader.areas} /> : <p className="mt-3 text-xs text-(--ma-muted)">لا توجد طبلونات مخصصة.</p>}
            </article>)}
            {readerColumns.length === 0 && <p className="text-sm text-(--ma-muted) md:col-span-3">لا يوجد قرّاء متاحون في الفرع.</p>}
        </section>
        <div className="grid items-start gap-4 sm:grid-cols-2">
            <section className="min-w-0 rounded-card border border-(--ma-pay) p-4" aria-label="ملخّص الكشوف الورقية">
                <h3 className="font-bold text-(--ma-ink)">الكشوف الورقية <span className="font-display">({formatNumber(paper.boxes)})</span></h3>
                <p className="mt-2 text-xs leading-6 text-(--ma-muted)">{formatNumber(paper.subscribers)} مشترك، {formatNumber(paperSheets.length)} كشف منشأ: {formatNumber(printed)} مطبوع، {formatNumber(paperSheets.length - printed)} لم يُطبع.</p>
                <DistributionAreaBreakdown areas={paper.areas} />
                {abilities.printSheets && paper.boxes > 0 && <SecondaryKey className="mt-3 w-full" disabled={busy} onClick={onPreparePaper}>تجهيز الطبلونات الورقية ({formatNumber(paper.boxes)})</SecondaryKey>}
                {(abilities.printSheets || paperSheets.length > 0) && <SecondaryKey className="mt-3 w-full" disabled={busy} onClick={onPaper}>مراجعة الكشوف والطباعة</SecondaryKey>}
            </section>
            <section className="min-w-0 rounded-card border border-(--ma-warn) bg-(--ma-warn-s) p-4" aria-label="الطبلونات المتبقية">
                <h3 className="font-bold text-(--ma-ink)">غير موزع <span className="font-display">({formatNumber(available.boxes)})</span></h3>
                <p className="mt-2 text-xs leading-6 text-(--ma-muted)">{available.boxes ? `${formatNumber(available.subscribers)} مشترك بانتظار تحديد قارئ أو كشف ورقي.` : 'تم توزيع جميع الطبلونات في الفرع.'}</p>
                <DistributionAreaBreakdown areas={available.areas} />
                {abilities.manage && available.boxes > 0 && <SecondaryKey className="mt-3 w-full" disabled={busy} onClick={onRemaining}>توزيع المتبقي ({formatNumber(available.boxes)})</SecondaryKey>}
            </section>
        </div>
        {counters.available > 0 && counters.draft > 0 && abilities.approve && <p className="text-xs leading-6 text-(--ma-warn)">الاعتماد يشمل الطبلونات الجاهزة فقط؛ تبقى الطبلونات غير الموزعة بحاجة إلى توزيع.</p>}
    </DistributionDialog>;
}
