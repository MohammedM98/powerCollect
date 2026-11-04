/**
 * A big number over a row of bars that rise in, one after another (e.g.
 * what each collector or day brought in), then lines of figures (`children`).
 * `bars` are numbers; each bar is as tall as its share of the largest.
 */
export default function LiveBars({ value, bars = [], label, children }) {
    const max = Math.max(1, ...bars);

    return (
        <>
            <div className="gl-num" style={{ font: '800 32px var(--gl-head)' }}>{value}</div>
            {bars.length > 0 && (
                <div className="gl-live" role="img" aria-label={label}>
                    {bars.map((bar, index) => <i key={index} style={{ height: `${Math.max(8, (bar / max) * 100)}%`, '--i': index }} />)}
                </div>
            )}
            {children}
        </>
    );
}
