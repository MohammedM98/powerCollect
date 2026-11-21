import { useId } from 'react';
import { Button } from '@heroui/react';
import Modal from '@/Components/UI/Modal';
import Icon from '@/Components/UI/Icon';

/** Each tone's look: its tile and its confirm key (components.css `gl-confirm`). */
const TONES = { primary: 'primary', brand: 'primary', blue: 'info', warning: 'warning', amber: 'warning', danger: 'danger' };

/**
 * A yes/no question in the app's own window, used instead of the browser's
 * confirm(), large and plain: the icon on a big tile in its tone, the
 * question as a big title, the explanation in full-size text, and two big
 * HeroUI keys. Closing it (Escape, the backdrop, or the cancel key) counts
 * as "no".
 *
 * `tone="danger"` is for throwing work away: the confirm key turns red and
 * the safe choice (cancel) gets the focus; `tone="warning"` is amber.
 * Otherwise confirm is focused, so Enter answers straight away.
 * `confirmDisabled` holds the confirm key until the question's own
 * condition is met (a typed name).
 */
export default function ConfirmDialog({
    show,
    onConfirm,
    onCancel,
    title,
    message,
    confirmLabel = 'تأكيد',
    cancelLabel = 'إلغاء',
    icon = 'check',
    tone = 'primary',
    confirmDisabled = false,
    children,
}) {
    const id = useId();
    const look = TONES[tone] ?? 'primary';
    const isDanger = look === 'danger';

    return (
        <Modal show={show} onClose={onCancel} maxWidth="lg" presentation="dialog">
            <div role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} dir="rtl" className="gl-confirm" data-tone={look}>
                <span className="gl-confirm-icon" aria-hidden="true"><Icon name={icon} strokeWidth={2} /></span>
                <h2 id={`${id}-title`} className="gl-confirm-title">{title}</h2>
                <div id={`${id}-message`} className="gl-confirm-message">{message}</div>
                {children && <div className="gl-confirm-extra">{children}</div>}
                <div className="gl-confirm-keys">
                    <Button variant={isDanger ? 'danger' : 'primary'} className="gl-confirm-yes" onPress={onConfirm} isDisabled={confirmDisabled} autoFocus={!isDanger}>
                        {confirmLabel}
                    </Button>
                    <Button variant="secondary" className="gl-confirm-no" onPress={onCancel} autoFocus={isDanger}>
                        {cancelLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

/**
 * The "are you sure?" shown before a create/edit form is sent. `isEdit`
 * picks the wording for changing an existing record over adding a new one;
 * `message` replaces the explanation when a save needs a specific warning.
 */
export function SaveConfirmDialog({ show, isEdit, onConfirm, onCancel, message = null, action = null }) {
    if (action) {
        return (
            <ConfirmDialog
                show={show}
                onConfirm={onConfirm}
                onCancel={onCancel}
                title={action.title}
                message={message}
                confirmLabel={action.confirmLabel}
                cancelLabel="مراجعة البيانات"
                icon={action.icon}
                tone={action.tone}
            />
        );
    }

    return (
        <ConfirmDialog
            show={show}
            onConfirm={onConfirm}
            onCancel={onCancel}
            title={isEdit ? 'حفظ التعديلات؟' : 'إضافة السجل؟'}
            message={
                message ??
                (isEdit
                    ? 'سيتم حفظ التعديلات التي أجريتها على هذا السجل. هل تريد المتابعة؟'
                    : 'سيتم إضافة سجل جديد بالبيانات التي أدخلتها. هل تريد المتابعة؟')
            }
            confirmLabel={isEdit ? 'نعم، احفظ التعديلات' : 'نعم، أضف'}
            cancelLabel="مراجعة البيانات"
        />
    );
}
