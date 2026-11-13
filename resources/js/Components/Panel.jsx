/**
 * The panel every page is built from (design-system.superpower.json):
 * a title, a muted line under it (`sub`), whatever goes at the other end
 * (`right`), then the body. `index` staggers its entrance after the ones
 * before it.
 */
export default function Panel({ title = null, sub = null, right = null, index = 0, className = '', as: Tag = 'section', children, ...props }) {
    return (
        <Tag className={`gl-card gl-panel gl-rise ${className}`} style={{ '--i': index }} {...props}>
            {(title || sub || right) && (
                <div className="gl-ph">
                    <div className="min-w-0">
                        {title && <h2>{title}</h2>}
                        {sub && <p className="gl-sub">{sub}</p>}
                    </div>
                    <div className="gl-sp" />
                    {right}
                </div>
            )}
            {children}
        </Tag>
    );
}
