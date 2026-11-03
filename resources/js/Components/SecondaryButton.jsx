/** The secondary look (glass.css `gl-btn gl-sec`), for a link that sits beside the main action (back, open, export…). */
export const secondaryButtonClass = 'ui-btn-secondary gl-btn gl-sec';

/**
 * Cancel and side actions: the prototype's quiet button, a glass tint with a thin line.
 */
export default function SecondaryButton({ className = '', disabled, children, type = 'button', ...props }) {
    return (
        <button {...props} type={type} disabled={disabled} className={`${secondaryButtonClass} ${className}`}>
            {children}
        </button>
    );
}
