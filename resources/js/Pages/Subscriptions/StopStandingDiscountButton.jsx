import { useState } from 'react';
import { router } from '@inertiajs/react';
import ConfirmDialog from '@/Components/ConfirmDialog';

/**
 * Cancels a subscription's standing discount (خصم القراءات الأسبوعية) for good after a
 * confirmation: readings recorded from then on get no discount, earlier
 * readings keep theirs, and a new discount can be given again afterwards.
 * `discountLabel` is how the discount reads: "3 كيلو · موظفو أبو زايد".
 */
export default function StopStandingDiscountButton({ subscriptionId, subscriptionName, discountLabel, className = '' }) {
    const [confirming, setConfirming] = useState(false);
    const [stopping, setStopping] = useState(false);

    function stop() {
        setConfirming(false);
        router.delete(`/subscriptions/${subscriptionId}/standing-discount`, {
            preserveScroll: true,
            onStart: () => setStopping(true),
            onFinish: () => setStopping(false),
        });
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={stopping}
                className={`gl-pill-danger ${className}`}
            >
                {stopping ? 'جارٍ الإلغاء...' : 'إلغاء الخصم'}
            </button>

            <ConfirmDialog
                show={confirming}
                onConfirm={stop}
                onCancel={() => setConfirming(false)}
                title="إلغاء خصم القراءات الأسبوعية؟"
                message={`لن يُخصم (${discountLabel}) من قراءات ${subscriptionName} التي تُدخل بعد الآن. القراءات السابقة تحتفظ بخصمها، ويمكن إعطاء خصم جديد في أي وقت.`}
                confirmLabel="نعم، ألغِ الخصم"
                cancelLabel="إبقاء الخصم"
                icon="alert"
                tone="danger"
            />
        </>
    );
}
