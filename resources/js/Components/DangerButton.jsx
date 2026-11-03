/**
 * Destructive actions: a soft red button (glass.css `gl-danger`) that fills in on hover.
 */
export default function DangerButton({ className = '', disabled, children, ...props }) {
    return (
        <button {...props} disabled={disabled} className={`ui-btn-danger gl-btn gl-danger ${className}`}>
            {children}
        </button>
    );
}
