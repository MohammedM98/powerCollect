/** The primary look (components.css `gl-btn`), for a link that acts as the screen's main action. */
export const primaryButtonClass = 'ui-btn-primary gl-btn';

/**
 * The main action on a screen.
 */
export default function PrimaryButton({ className = '', disabled, children, ...props }) {
    return (
        <button {...props} disabled={disabled} className={`${primaryButtonClass} ${className}`}>
            {children}
        </button>
    );
}
