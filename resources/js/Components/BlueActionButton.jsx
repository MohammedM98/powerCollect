export const blueActionSurfaceClass = 'gl-btn-surface';
export const blueActionControlClass = 'gl-btn-part';

/** The main button's look as a surface split into parts (the subscribers' bulk-actions control). */
export default function BlueActionButton({ children, className = '', type = 'button', ...props }) {
    return <button type={type} {...props} className={`gl-btn ${className}`}>{children}</button>;
}
