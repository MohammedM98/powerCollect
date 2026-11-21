import { Button } from '@heroui/react';
import { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import Modal from '@/Components/Modal';
import InputError from '@/Components/InputError';
import { formatNumber } from '@/lib/format';
import DateInput from '@/Components/DateInput';
import { PrimaryKey, SecondaryKey } from '@/Components/UI';

/** What a move or approval did, with each box it could not move and why. */
export function AllocationReport({ result, onConfirmDownloaded, onClose }) {
    const needsConfirmation = result.conflicts.some((conflict) => conflict.reason.includes('أكّد النقل'));

    return (
        <section
            role="status"
            aria-live="polite"
            className={`mb-6 rounded-card border p-4 ${result.conflicts.length ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-gray-900">
                    {result.action === 'approve' ? 'اعتُمد' : result.action === 'copy' ? 'نُسخ من الدورة السابقة' : 'نُقل'}{' '}
                    {formatNumber(result.moved)} طبلون
                    {result.conflicts.length > 0 && <>، راجع الطبلونات التي تعذّر تحديثها أدناه</>}
                </p>
                <Button data-raw="" variant="ghost" onClick={onClose} aria-label="إغلاق التقرير" className="rounded-control p-2 text-gray-500 hover:bg-gray-100">
                    <Icon name="close" className="h-4 w-4" />
                </Button>
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
                <Button data-raw="" variant="ghost"
                    onClick={onConfirmDownloaded}
                    className="mt-3 inline-flex items-center gap-2 rounded-control bg-amber-600 px-3 py-2 text-sm font-bold text-white"
                >
                    <Icon name="warning" className="h-4 w-4" />
                    أؤكد نقل الطبلونات التي نزّلها القارئ (قراءاته غير المرفوعة تُحفظ للمراجعة)
                </Button>
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
            <form onSubmit={submit} className="space-y-4 p-6" aria-labelledby="reading-day-title">
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
                    <SecondaryKey onClick={onClose}>إلغاء</SecondaryKey>
                    <PrimaryKey type="submit">حفظ</PrimaryKey>
                </div>
            </form>
        </Modal>
    );
}
