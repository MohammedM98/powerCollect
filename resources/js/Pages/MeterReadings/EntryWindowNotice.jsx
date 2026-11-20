import { Button } from '@heroui/react';
import { WEEK_DAYS, formatWeekDay } from '@/lib/weekDays';

export function EntryWindowNotice({ entryWindow, canRecord, canApprove, weekIsViewOnly, onShowLatestWeek }) {
    if (entryWindow.appliesToActor && !entryWindow.isOpen) {
        const days = WEEK_DAYS.filter((day) => entryWindow.openDays.includes(day.value)).map((day) => day.label);
        const openingDay = entryWindow.nextOpensOn ? formatWeekDay(entryWindow.nextOpensOn) : days.join(' و');

        return (
            <div role="status" className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
                <p className="font-semibold">إدخال القراءات الجديدة مغلق حاليًا.</p>
                <p className="mt-1">
                    {openingDay ? `سيُفتح الإدخال يوم ${openingDay} من ${entryWindow.opensAt} إلى ${entryWindow.closesAt} بتوقيت الشركة.` : 'سيُفتح عندما يفتحه المدير.'} حتى ذلك الحين يمكنك تعديل القراءات المُدخلة
                    للأسبوع الأخير فقط.
                </p>
            </div>
        );
    }

    if (!canRecord) {
        // Approvers have their own bar below; for everyone else the sheet is read-only.
        return canApprove ? null : <p className="mb-4 text-sm text-gray-500">يمكنك عرض القراءات فقط.</p>;
    }

    if (weekIsViewOnly) {
        return (
            <div
                role="status"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm"
            >
                <div>
                    <p className="font-semibold text-gray-900">هذا أسبوع سابق — قراءاته للعرض فقط.</p>
                    <p className="mt-1 text-gray-500">يمكن إدخال القراءات وتعديلها للأسبوع الأخير فقط.</p>
                </div>
                <Button onClick={onShowLatestWeek} className="text-sm font-semibold text-brand-600 hover:underline">
                    الانتقال إلى الأسبوع الأخير
                </Button>
            </div>
        );
    }

    if (entryWindow.appliesToActor) {
        return <p className="mb-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">إدخال القراءات مفتوح الآن.</p>;
    }

    return null;
}
