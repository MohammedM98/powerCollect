import { Button } from '@heroui/react';
import Icon from '@/Components/UI/Icon';
import { formatMoney } from '@/lib/format';

const ACTION_LABELS = {
    add: 'إضافة المشتركين',
    reschedule: 'تغيير موعد القطع',
    remove: 'الإزالة من القائمة',
    warn: 'إرسال الإنذار',
    confirm: 'تأكيد القطع',
};

/**
 * How a bulk action went for each subscriber: how many it was applied to,
 * and each one it could not be applied to with why — never "all done" when
 * some were not.
 */
export default function ResultReport({ result, onClose }) {
    const failed = result.failed ?? [];
    const tone = result.succeeded === 0 ? 'bg-(--ma-owe-s)' : failed.length ? 'bg-(--ma-warn-s)' : 'bg-(--ma-pay-s)';
    const heading = result.succeeded === 0 ? 'لم يُطبَّق الإجراء' : failed.length ? 'طُبّق الإجراء جزئيًا' : 'طُبّق الإجراء بنجاح';

    return (
        <section role="status" aria-live="polite" className={`mb-6 rounded-[18px] p-4 shadow-(--ma-hl) ${tone}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-bold text-(--ma-ink)">
                        {ACTION_LABELS[result.action] ?? 'الإجراء'}: {heading}
                    </p>
                    <p className="mt-1 text-sm text-(--ma-ink)">
                        نجح لـ <b className="font-display">{result.succeeded.toLocaleString('en')}</b> مشترك
                        {failed.length > 0 && <>، لم يُطبَّق على <b className="font-display">{failed.length.toLocaleString('en')}</b></>}
                        {result.action === 'confirm' && result.succeeded > 0 && <>، رسوم القطع المحمّلة <b className="font-display">{formatMoney(result.feesTotal)} ₪</b></>}
                        {result.action === 'warn' && result.batchId && (
                            <>
                                {'، '}
                                <a href={`/messages/${result.batchId}`} className="font-semibold text-(--ma-brand) hover:underline">
                                    {result.channel === 'whatsapp' ? 'افتح الرسائل لإرسالها عبر واتساب' : 'تابع حالة الإرسال'}
                                </a>
                            </>
                        )}
                    </p>
                </div>
                <Button data-raw="" variant="ghost" onClick={onClose} aria-label="إغلاق التقرير" className="gl-ib">
                    <Icon name="close" className="h-4 w-4" />
                </Button>
            </div>
            {failed.length > 0 && (
                <ul className="mt-3 max-h-56 divide-y divide-(--ma-line) overflow-y-auto rounded-[14px] bg-(--ma-solid) text-sm">
                    {failed.map((item, index) => (
                        <li key={`${item.id ?? item.subscriptionId ?? 'x'}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <span>
                                <b className="text-(--ma-ink)">{item.name}</b>
                                {item.accountNumber && <bdi dir="ltr" className="ms-2 font-display text-xs text-(--ma-muted)">{item.accountNumber}</bdi>}
                            </span>
                            <span className="text-xs text-(--ma-muted)">{item.reason}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
