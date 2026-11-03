import CountUp from '@/Components/CountUp';

/** A small trend line, oldest on the left, drawn in. Decorative. */
export function Spark({ values }) {
    if (!values || values.length < 2) {
        return null;
    }

    const width = 64;
    const height = 24;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const points = values.map((value, index) => [index * (width / (values.length - 1)), height - 3 - ((value - min) / (max - min || 1)) * (height - 8)]);

    return (
        <svg className="gl-spark" viewBox="0 0 64 24" aria-hidden="true">
            <path className="gl-draw" pathLength="1" d={`M${points.map((point) => point.join(',')).join(' L')}`} fill="none" stroke="rgb(var(--gl-brand))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/** One figure of the strip: its name, the number counting up with its unit, a change badge and a line of comparison. */
export function Stat({ label, value, unit = null, decimals = 0, format = null, badge = null, hint = null, children = null }) {
    return (
        <div className="gl-stat">
            <div className="gl-lbl">{label}</div>
            <div className="gl-big gl-num">
                <CountUp value={value} decimals={decimals} format={format} />
                {unit && <small>{unit}</small>}
                {children}
            </div>
            {(badge || hint) && (
                <div className="gl-foot">
                    {badge}
                    {hint && <span>{hint}</span>}
                </div>
            )}
        </div>
    );
}

/** The three figures across the top of a panel, divided by thin lines. */
export default function StatStrip({ children }) {
    return <div className="gl-stats">{children}</div>;
}

/** "+12%" against the period before, green up and red down; nothing without a period before. */
export function ChangePill({ change }) {
    if (change === null || change === undefined) {
        return null;
    }

    return (
        <span className={`gl-pill ${change >= 0 ? 'gl-ok' : 'gl-bad'}`} dir="ltr">
            {change >= 0 ? '+' : '−'}
            {Math.abs(change)}%
        </span>
    );
}
