import { useId, useState } from 'react';
import Modal from '@/Components/UI/Modal';
import { FormHeader, movementStyle, SHEET_FORM_CLASS } from '@/Pages/Subscriptions/AccountFormParts';
import SplitPaymentForm from './SplitPaymentForm';
import { ConfirmDialog } from '@/Components/UI';

/**
 * The shared payment, in a window of its own: one bank transfer divided
 * between any subscribers. Closing it with something entered asks first, so a
 * long distribution is not lost by a stray click.
 */
export default function SplitPaymentModal({ onClose, transferBanks, senderBanks, initialSubscription = null }) {
    const titleId = useId();
    const [dirty, setDirty] = useState(false);
    const [discarding, setDiscarding] = useState(false);

    function requestClose() {
        if (dirty) {
            setDiscarding(true);
        } else {
            onClose();
        }
    }

    return (
        <>
            <Modal show onClose={requestClose} maxWidth="5xl">
                <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={SHEET_FORM_CLASS} data-ledger-tone="split" style={movementStyle('split')}>
                    <FormHeader titleId={titleId} icon="layers" tone="split" title="دفعة مقسّمة على عدة مشتركين" subtitle="حوالة واحدة توزَّع على مشتركين، ولو بهويات مختلفة" onClose={requestClose} />
                    <SplitPaymentForm transferBanks={transferBanks} senderBanks={senderBanks} onCancel={requestClose} onDirtyChange={setDirty} initialSubscription={initialSubscription} />
                </div>
            </Modal>

            <ConfirmDialog
                show={discarding}
                onConfirm={onClose}
                onCancel={() => setDiscarding(false)}
                title="تجاهل التغييرات؟"
                message="أدخلت بيانات لم تُحفظ بعد. إذا أغلقت النافذة الآن فستفقدها."
                confirmLabel="تجاهل التغييرات"
                cancelLabel="البقاء ومتابعة التعديل"
                icon="alert"
            />
        </>
    );
}
