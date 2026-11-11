import { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import KpiTile from '@/Components/KpiTile';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import InputError from '@/Components/InputError';
import { formatNumber } from '@/lib/format';
import { boardCounters, columnTotals } from '@/lib/readingBoard';
import DateInput from '@/Components/DateInput';

export function DistributionSummary({ boxes }) {
    const counters = boardCounters(boxes);
    const read = columnTotals(boxes).read;
    return (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
            <KpiTile hero icon="table" label="الطبلونات ضمن نتائج البحث والتصفية" value={formatNumber(boxes.length)} unit="طبلون">
                <div className="gl-kv mt-3 border-t pt-3" style={{ borderColor: 'var(--gl-line)' }}>
                    <span className="inline-flex items-center gap-1.5">
                        <Icon name="users" className="h-4 w-4" />
                        المشتركون
                    </span>
                    <b className="gl-num">{formatNumber(counters.subscribers)}</b>
                </div>
            </KpiTile>
            {[
                {
                    icon: 'users',
                    label: 'موزعة على القرّاء',
                    value: counters.mobile,
                    hint: `قُرئ ${formatNumber(read)} من ${formatNumber(counters.subscribers)} مشترك`,
                    tone: 'text-gray-900',
                },
                {
                    icon: 'table',
                    label: 'بانتظار التوزيع',
                    value: counters.available,
                    hint: 'اختر قارئًا أو خصصها للكشوف الورقية',
                    tone: 'text-amber-700 dark:text-amber-400',
                },
                { icon: 'printer', label: 'للكشوف الورقية', value: counters.paper, hint: 'مخصصة للقراءة دون هاتف', tone: 'text-gray-900' },
            ].map((stat) => (
                <div key={stat.label} className="rounded-card border border-gray-100 bg-surface p-5 shadow-card">
                    <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-control bg-gray-50 text-gray-600">
                        <Icon name={stat.icon} className="h-5 w-5" />
                    </span>
                    <p className="text-xs font-semibold text-gray-500">{stat.label}</p>
                    <p className={`mt-1 font-display text-2xl font-bold ${stat.tone}`}>{formatNumber(stat.value)}</p>
                    <p className="mt-2 text-xs leading-5 text-gray-500">{stat.hint}</p>
                </div>
            ))}
        </div>
    );
}

/** What a move or approval did, with each box it could not move and why. */
export function AllocationReport({ result, onConfirmDownloaded, onClose }) {
    const needsConfirmation = result.conflicts.some((conflict) => conflict.reason.includes('أكّد النقل'));

    return (
        <section
            role="status"
            aria-live="polite"
            className={`mb-5 rounded-card border p-4 ${result.conflicts.length ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-gray-900">
                    {result.action === 'approve' ? 'اعتُمد' : result.action === 'copy' ? 'نُسخ من الدورة السابقة' : 'نُقل'}{' '}
                    {formatNumber(result.moved)} طبلون
                    {result.conflicts.length > 0 && <> · راجع الطبلونات التي تعذّر تحديثها أدناه</>}
                </p>
                <button type="button" onClick={onClose} aria-label="إغلاق التقرير" className="rounded-control p-1.5 text-gray-500 hover:bg-gray-100">
                    <Icon name="close" className="h-4 w-4" />
                </button>
            </div>
            {result.conflicts.length > 0 && (
                <ul className="mt-3 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-control border border-gray-100 bg-surface text-sm">
                    {result.conflicts.map((conflict, index) => (
                        <li key={`${conflict.boxId ?? conflict.label}-${index}`} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                            <b className="text-gray-900">{conflict.label}</b>
                            <span className="text-xs text-gray-600">{conflict.reason}</span>
                        </li>
                    ))}
                </ul>
            )}
            {needsConfirmation && onConfirmDownloaded && (
                <button
                    type="button"
                    onClick={onConfirmDownloaded}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-control bg-amber-600 px-3 py-2 text-sm font-bold text-white"
                >
                    <Icon name="warning" className="h-4 w-4" />
                    أؤكد نقل الطبلونات التي نزّلها القارئ (قراءاته غير المرفوعة تُحفظ للمراجعة)
                </button>
            )}
        </section>
    );
}

/** Move the cycle's reading day within the days its week allows. */
export function ReadingDayModal({ cycle, onClose }) {
    const { errors } = usePage().props;
    const [date, setDate] = useState(cycle.readingDate);

    function submit(event) {
        event.preventDefault();
        router.patch(`/reading-cycles/${cycle.id}`, { reading_date: date }, { preserveScroll: true, onSuccess: onClose });
    }

    return (
        <Modal show onClose={onClose} maxWidth="md">
            <form onSubmit={submit} className="space-y-4 p-7" aria-labelledby="reading-day-title">
                <h3 id="reading-day-title" className="text-lg font-bold text-gray-900">
                    تغيير يوم القراءة لهذه الدورة
                </h3>
                <p className="text-sm text-gray-600">
                    موعد القراءة حسب إعدادات الفرع أو الموقع:{' '}
                    <bdi dir="ltr" className="whitespace-nowrap">
                        {cycle.scheduledReadingDate}
                    </bdi>
                    . يمكنك اختيار موعد من{' '}
                    <bdi dir="ltr" className="whitespace-nowrap">
                        {cycle.minReadingDate}
                    </bdi>{' '}
                    إلى{' '}
                    <bdi dir="ltr" className="whitespace-nowrap">
                        {cycle.maxReadingDate}
                    </bdi>
                    . تغيير يوم القراءة الأسبوعي الدائم يتم من صفحة إعدادات القراءات.
                </p>
                <DateInput
                    name="reading_date"
                    aria-label="يوم القراءة"
                    min={cycle.minReadingDate}
                    max={cycle.maxReadingDate}
                    value={date}
                    onChange={setDate}
                    required
                />
                <InputError message={errors.reading_date} />
                <p className="text-xs text-gray-500">
                    القرّاء الذين نزّلوا مهامهم ينزّلونها من جديد ليعرفوا اليوم الجديد؛ القراءات في غير يوم القراءة تُحفظ للمراجعة.
                </p>
                <div className="flex justify-end gap-3">
                    <SecondaryButton onClick={onClose}>إلغاء</SecondaryButton>
                    <PrimaryButton type="submit">حفظ</PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}

/** Each kind of lane's dot and note on the distribution board. */
export const LANE_LOOKS = {
    available: { color: 'var(--gl-warn)', note: 'بانتظار توزيعها' },
    paper: { color: 'var(--gl-info)', note: 'تُطبع وتُسلَّم للقارئ' },
    reader: { color: 'var(--gl-ok)', note: 'قارئ ميداني' },
};

/** A box's card on the distribution board: its number, subscribers, area, state and how much of it is read. */
export function BoxCard({ box }) {
    const share = box.subscribers ? Math.round((box.read / box.subscribers) * 100) : 0;

    return (
        <>
            <div className="gl-oh">
                <span className="gl-id" dir="ltr">
                    {box.number}
                </span>
                <span>{formatNumber(box.subscribers)} مشترك</span>
            </div>
            <div className="gl-who">
                <span className="gl-av" aria-hidden="true">
                    {box.name.slice(0, 1)}
                </span>
                <span className="min-w-0 truncate" dir="auto">
                    {box.name}
                </span>
            </div>
            <div className="gl-items">{box.subAreaName ?? 'بدون منطقة 2'}</div>
            <div className="gl-of">
                <span className="gl-num text-sm" dir="ltr">
                    {formatNumber(box.read)} / {formatNumber(box.subscribers)}
                </span>
                <span className="gl-tag">
                    {box.status === 'approved' ? 'معتمد' : box.status ? 'بانتظار الاعتماد' : 'غير موزع'}
                    {box.downloaded ? ' · نُزّلت' : ''}
                </span>
            </div>
            <div className="gl-progress" role="img" aria-label={`قُرئ ${box.read} من ${box.subscribers}`}>
                <span style={{ width: `${share}%` }} />
            </div>
        </>
    );
}
