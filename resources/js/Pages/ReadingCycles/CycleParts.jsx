import { Button } from '@heroui/react';
import { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import Icon from '@/Components/UI/Icon';
import DialogFrame from '@/Components/UI/DialogFrame';
import InputError from '@/Components/UI/InputError';
import { formatNumber } from '@/lib/format';
import DateInput from '@/Components/UI/DateInput';
import { Notice, PrimaryKey, SecondaryKey } from '@/Components/UI';

/** What a move or approval did, with each box it could not move and why. */
export function AllocationReport({ result, onConfirmDownloaded, onClose }) {
    const needsConfirmation = result.conflicts.some((conflict) => conflict.reason.includes('أكّد النقل'));

    return (
        <section
            role="status"
            aria-live="polite"
            className={`mb-6 rounded-[18px] p-4 shadow-(--ma-hl) ${result.conflicts.length ? 'bg-(--ma-warn-s)' : 'bg-(--ma-pay-s)'}`}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-(--ma-ink)">
                    {result.action === 'approve' ? 'اعتُمد' : result.action === 'copy' ? 'نُسخ من الدورة السابقة' : 'نُقل'}{' '}
                    {formatNumber(result.moved)} طبلون
                    {result.conflicts.length > 0 && <>، راجع الطبلونات التي تعذّر تحديثها أدناه</>}
                </p>
                <Button data-raw="" variant="ghost" onClick={onClose} aria-label="إغلاق التقرير" className="gl-ib">
                    <Icon name="close" className="h-4 w-4" />
                </Button>
            </div>
            {result.conflicts.length > 0 && (
                <ul className="mt-3 max-h-48 divide-y divide-(--ma-line) overflow-y-auto rounded-[14px] bg-(--ma-solid) text-sm">
                    {result.conflicts.map((conflict, index) => (
                        <li key={`${conflict.boxId ?? conflict.label}-${index}`} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                            <b className="text-(--ma-ink)">{conflict.label}</b>
                            <span className="text-xs text-(--ma-muted)">{conflict.reason}</span>
                        </li>
                    ))}
                </ul>
            )}
            {needsConfirmation && onConfirmDownloaded && (
                <SecondaryKey onClick={onConfirmDownloaded} className="mt-3">
                    <Icon name="warning" className="h-4 w-4 text-(--ma-warn)" />
                    أؤكد نقل الطبلونات التي نزّلها القارئ (قراءاته غير المرفوعة تُحفظ للمراجعة)
                </SecondaryKey>
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
        <DialogFrame
            show
            onClose={onClose}
            title="تغيير يوم القراءة لهذه الدورة"
            icon="calendar"
            tone="blue"
            maxWidth="md"
            footer={
                <>
                    <SecondaryKey onClick={onClose}>إلغاء</SecondaryKey>
                    <PrimaryKey type="submit" form="reading-day-form">حفظ</PrimaryKey>
                </>
            }
        >
            <form id="reading-day-form" onSubmit={submit} className="space-y-4">
                <p className="text-sm text-(--ma-muted)">
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
                <Notice>القرّاء الذين نزّلوا مهامهم ينزّلونها من جديد ليعرفوا اليوم الجديد؛ القراءات في غير يوم القراءة تُحفظ للمراجعة.</Notice>
            </form>
        </DialogFrame>
    );
}
