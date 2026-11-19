import { useState } from 'react';
import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import { groupActionSurfaceClass, groupActionControlClass } from '@/Components/GroupActionButton';
import RowMenu from '@/Components/DataTable/RowMenu';

const ACTIONS = [
    { key: 'minimum_charge', permission: 'minimumCharge', label: 'تعديل الحد الأدنى', icon: 'wallet', tone: 'amber' },
    { key: 'meter_box_id', permission: 'meterBox', label: 'نقل إلى طبلون آخر', icon: 'grid', tone: 'blue' },
    { key: 'message', permission: 'message', label: 'إرسال رسالة', icon: 'messages', tone: 'sky' },
    { key: 'status', permission: 'status', label: 'تغيير الحالة', icon: 'flag', tone: 'graphite' },
];

export function bulkActionOptions(abilities) {
    return ACTIONS.filter((action) => abilities[action.permission]);
}

/**
 * The list's group actions, as in the redesign: «إجراءات جماعية» opens the
 * actions to pick before choosing subscriptions, and «سجل التعديلات
 * الجماعية» beside it opens the log of changes already made.
 */
export default function BulkActionsMenu({ abilities, onChoose }) {
    const [anchor, setAnchor] = useState(null);
    const actions = bulkActionOptions(abilities);

    function close(restoreFocus) {
        if (restoreFocus) anchor?.focus();
        setAnchor(null);
    }

    return (
        <>
            <div className={`${groupActionSurfaceClass} items-stretch`}>
                <button
                    type="button"
                    onClick={(event) => {
                        const opener = event.currentTarget;
                        setAnchor((current) => (current ? null : opener));
                    }}
                    disabled={actions.length === 0}
                    aria-haspopup="menu"
                    aria-expanded={Boolean(anchor)}
                    className={`${groupActionControlClass} rounded-control`}
                >
                    <Icon name="layers" className="h-4 w-4" />
                    إجراءات جماعية
                </button>
                {anchor && (
                    <RowMenu
                        anchor={anchor}
                        onClose={close}
                        menu={{ title: 'إجراءات جماعية', groups: [{ label: 'اختر الإجراء ثم حدّد الاشتراكات', items: actions.map((action) => ({ ...action, onSelect: () => onChoose(action) })) }] }}
                    />
                )}
            </div>
            <Link href="/subscriptions/bulk-changes" prefetch className="gl-btn gl-sec">
                <Icon name="history" className="h-4 w-4" />
                سجل التعديلات الجماعية
            </Link>
        </>
    );
}
