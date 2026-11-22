import { Notice } from '@/Components/UI';
import { Button } from '@heroui/react';
import { WEEK_DAYS, formatWeekDay } from '@/lib/weekDays';

export function EntryWindowNotice({ entryWindow, canRecord, canApprove, weekIsViewOnly, onShowLatestWeek }) {
    if (entryWindow.appliesToActor && !entryWindow.isOpen) {
        const days = WEEK_DAYS.filter((day) => entryWindow.openDays.includes(day.value)).map((day) => day.label);
        const openingDay = entryWindow.nextOpensOn ? formatWeekDay(entryWindow.nextOpensOn) : days.join(' و');

        return (
            <Notice role="status" tone="warn" title="إدخال القراءات الجديدة مغلق حاليًا." className="mb-4">
                <p>
                    {openingDay ? `سيُفتح الإدخال يوم ${openingDay} من ${entryWindow.opensAt} إلى ${entryWindow.closesAt} بتوقيت الشركة.` : 'سيُفتح عندما يفتحه المدير.'} حتى ذلك الحين يمكنك تعديل القراءات المُدخلة
                    للأسبوع الأخير فقط.
                </p>
            </Notice>
        );
    }

    if (!canRecord) {
        // Approvers have their own bar below; for everyone else the sheet is read-only.
        return canApprove ? null : <p className="mb-4 text-sm text-(--ma-muted)">يمكنك عرض القراءات فقط.</p>;
    }

    if (weekIsViewOnly) {
        return (
            <div
                role="status"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--ma-line) bg-(--ma-tile) p-4 text-sm"
            >
                <div>
                    <p className="font-semibold text-(--ma-ink)">هذا أسبوع سابق — قراءاته للعرض فقط.</p>
                    <p className="mt-1 text-(--ma-muted)">يمكن إدخال القراءات وتعديلها للأسبوع الأخير فقط.</p>
                </div>
                <Button data-raw="" variant="ghost" onClick={onShowLatestWeek} className="text-sm font-semibold text-(--ma-brand) hover:underline">
                    الانتقال إلى الأسبوع الأخير
                </Button>
            </div>
        );
    }

    if (entryWindow.appliesToActor) {
        return <p className="mb-4 text-sm font-medium text-(--ma-pay)">إدخال القراءات مفتوح الآن.</p>;
    }

    return null;
}
