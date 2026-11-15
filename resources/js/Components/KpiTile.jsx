import CountUp from '@/Components/CountUp';
import Icon from '@/Components/Icon';

/**
 * One figure on a card: an icon tile and a
 * label (with a `badge` at the far end, such as a change against the
 * period before), the figure with its unit (₪…), and a quiet line of
 * context under it. A number `value` counts up as it shows; a written
 * one (already formatted) shows as it is. `hero` is the card a page leads
 * with, washed in the company's colour with its line along the bottom.
 * `children` go under it all (a small breakdown of the figure); `index`
 * staggers its entrance.
 */
export default function KpiTile({ icon, label, value, unit, hint, badge, hero = false, compact = false, index = 0, className = '', style, children }) {
    return (
        <div className={`gl-card gl-kpi gl-rise ${hero ? 'gl-hero' : ''} ${className}`} style={{ '--i': index, ...style }}>
            <div className="gl-lbl">
                {icon && <span className="gl-ico"><Icon name={icon} className="h-[17px] w-[17px]" /></span>}
                <span className="min-w-0">{label}</span>
                {badge && <span className="ms-auto">{badge}</span>}
            </div>
            <div className="gl-val gl-num" style={compact && !hero ? { fontSize: 28 } : undefined}>
                {typeof value === 'number' ? <CountUp value={value} /> : value}
                {unit && <small>{unit}</small>}
            </div>
            {hint && <div className="gl-hint">{hint}</div>}
            {children}
        </div>
    );
}
