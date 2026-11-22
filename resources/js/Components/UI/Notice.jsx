import Icon from '@/Components/UI/Icon';

const ICONS = { neutral: 'info', info: 'info', brand: 'info', success: 'check', warn: 'alert', danger: 'alert' };

/**
 * A note inside a form or a window, in the MA tones: `neutral` (a quiet
 * remark), `info`, `brand`, `success`, `warn` (take care) or `danger`
 * (cannot be undone). `title` is a bold first line; `role="alert"` is for a
 * note that appears in answer to what the user just did.
 */
export default function Notice({ tone = 'neutral', title = null, icon, role, className = '', children }) {
    return (
        <div className={`ma-notice ${className}`} data-tone={tone} role={role}>
            <Icon name={icon ?? ICONS[tone] ?? 'info'} />
            <div className="min-w-0 flex-1">
                {title && <b>{title}</b>}
                {children}
            </div>
        </div>
    );
}
