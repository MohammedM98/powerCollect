/** The primary look (glass.css `gl-btn`), for a link that acts as the screen's main action. */
export const primaryButtonClass = 'ui-btn-primary gl-btn';

/**
 * The main action on a screen (one per screen): the prototype's button,
 * a gradient in the company's colour with an inner shine and a soft glow.
 */
export default function PrimaryButton({ className = '', disabled, children, ...props }) {
    return (
        <button {...props} disabled={disabled} className={`${primaryButtonClass} ${className}`}>
            {children}
        </button>
    );
}
