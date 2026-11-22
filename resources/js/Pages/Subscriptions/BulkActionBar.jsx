import { SelectionBar, SelectionBarKey } from '@/Components/UI';
import { printUrl } from '@/lib/print';
import { openQuickMessage } from '@/lib/quickMessage';

/** The most ticked subscriptions a printout carries in its address. */
export const MAX_LINKED_IDS = 400;

/**
 * The bar shown while subscriptions are chosen: how many, the actions —
 * change the minimum charge or the status (kept in the bulk changes log),
 * write them a message in the quick message window, print them — and
 * clearing the choice. Actions the user may not take don't show.
 */
export default function BulkActionBar({ count, selection, abilities, onAction, onClear, pendingAction = null, onContinue }) {
    const ids = selection.ids ?? [];
    const tooManyToLink = !selection.all && ids.length > MAX_LINKED_IDS;
    const linkHint = `اختر ${MAX_LINKED_IDS} مشتركًا أو أقل، أو «كل النتائج المطابقة»`;

    function print() {
        const url = printUrl(document.title);
        window.open(selection.all ? url : `${url}&filter%5Bids%5D=${ids.join(',')}`, '_blank');
    }

    return (
        <SelectionBar
            label="إجراءات على المشتركين المحددين"
            count={count}
            caption={selection.all ? 'اشتراك (كل النتائج المطابقة)' : 'اشتراك محدد'}
            onClear={onClear}
            room={false}
        >
            {pendingAction ? (
                <>
                    <span className="min-w-0 flex-1 text-sm">{pendingAction.label}{count === 0 && '، حدّد الاشتراكات من القائمة'}</span>
                    <SelectionBarKey icon="check" label="متابعة" tone="primary" onClick={onContinue} disabled={count === 0 || count > 5000} hint="حدّد من 1 إلى 5,000 اشتراك للمتابعة." />
                </>
            ) : (
                <>
                    {abilities.minimumCharge && <SelectionBarKey icon="wallet" label="تعديل الحد الأدنى" onClick={() => onAction('minimum_charge')} disabled={count > 5000} hint="يمكن تعديل 5,000 اشتراك على الأكثر؛ ضيّق الفلاتر." />}
                    {abilities.status && <SelectionBarKey icon="flag" label="الحالة" onClick={() => onAction('status')} disabled={count > 5000} hint="يمكن تعديل 5,000 اشتراك على الأكثر؛ ضيّق الفلاتر." />}
                    {abilities.meterBox && <SelectionBarKey icon="grid" label="نقل إلى طبلون آخر" onClick={() => onAction('meter_box_id')} disabled={count > 5000} hint="يمكن نقل 5,000 اشتراك على الأكثر؛ ضيّق الفلاتر." />}
                    {abilities.message && (
                        <SelectionBarKey
                            icon="messages"
                            label="إرسال رسالة"
                            onClick={() => openQuickMessage(ids, selection.all ? selection : null)}
                            disabled={count > 5000}
                            hint="يمكن مراسلة 5,000 اشتراك على الأكثر؛ ضيّق الفلاتر."
                        />
                    )}
                    <SelectionBarKey icon="printer" label="طباعة" tone="print" onClick={print} disabled={tooManyToLink} hint={linkHint} />
                </>
            )}
        </SelectionBar>
    );
}
