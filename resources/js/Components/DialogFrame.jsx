import { Button } from '@heroui/react';
import { useId } from 'react';
import Modal from '@/Components/Modal';
import Icon from '@/Components/Icon';

/**
 * The tinted badge behind a dialog's icon. One set for every dialog and
 * form: brand for adding and confirming, blue for editing, amber for a
 * warning, red for what cannot be undone.
 */
export const DIALOG_TONES = {
    primary: 'gl-tone-brand',
    brand: 'gl-tone-brand',
    blue: 'gl-tone-info',
    warning: 'gl-tone-warn',
    amber: 'gl-tone-warn',
    danger: 'gl-tone-bad',
};

/** A dialog's top: the icon in its tone, the title (and a line under it), and the close button. */
export function DialogHeader({ titleId, title, description = null, descriptionId, icon, tone = 'primary', onClose, closeDisabled = false }) {
    return (
        <header className="gl-dialog-head flex shrink-0 items-start gap-3 px-5 py-5 sm:gap-4 sm:px-6">
            <span className={`gl-tone hidden h-11 w-11 shrink-0 items-center justify-center rounded-[14px] sm:flex ${DIALOG_TONES[tone] ?? DIALOG_TONES.primary}`}><Icon name={icon} className="h-[22px] w-[22px]" /></span>
            <div className="min-w-0 flex-1 self-center">
                <h2 id={titleId} className="wrap-break-word text-xl font-extrabold leading-snug font-(family-name:--gl-head)!">{title}</h2>
                {description && <p id={descriptionId} className="gl-sub mt-1 wrap-break-word text-sm!">{description}</p>}
            </div>
            <Button data-raw="" variant="ghost" onClick={onClose} isDisabled={closeDisabled} aria-label="إغلاق النافذة" className="gl-ib disabled:opacity-40"><Icon name="close" className="h-4 w-4" /></Button>
        </header>
    );
}

/** A readable message layout using the site's modal, typeface, colors and controls. */
export default function DialogFrame({ show, onClose, title, description, icon = 'check', tone = 'primary', maxWidth = '2xl', role = 'dialog', children, footer, busy = false }) {
    const id = useId();

    return <Modal show={show} onClose={busy ? undefined : onClose} maxWidth={maxWidth} presentation="dialog">
        <div role={role} aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : role === 'alertdialog' ? `${id}-body` : undefined} aria-busy={busy || undefined} dir="rtl" className="flex max-h-[90dvh] min-h-0 flex-col">
            <DialogHeader titleId={`${id}-title`} title={title} description={description} descriptionId={`${id}-description`} icon={icon} tone={tone} onClose={onClose} closeDisabled={busy} />
            <div id={`${id}-body`} className="min-h-0 flex-1 space-y-5 overflow-y-auto wrap-break-word px-5 py-5 text-[15px] leading-8 sm:px-6 text-(--gl-ink)!">{children}</div>
            {footer && <footer className="gl-dialog-foot flex shrink-0 flex-wrap items-center justify-end gap-2 px-5 py-4 sm:px-6">{footer}</footer>}
        </div>
    </Modal>;
}
