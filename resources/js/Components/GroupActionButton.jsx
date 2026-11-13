/** The group actions' look (components.css `gl-group`) as a surface split into parts, and its parts. */
export const groupActionSurfaceClass = 'gl-btn-surface gl-group';
export const groupActionControlClass = 'gl-btn-part';

/**
 * An action on a group of rows or on a list itself (bulk actions, managing
 * user types, opening a full statement): charcoal, light grey in the dark
 * theme, so it is told apart from the screen's main action and from adding.
 */
export default function GroupActionButton({ children, className = '', type = 'button', ...props }) {
    return <button type={type} {...props} className={`gl-btn gl-group ${className}`}>{children}</button>;
}
