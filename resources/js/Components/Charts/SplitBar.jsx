/**
 * A thin bar split into coloured parts that grow in from the start, one
 * after another, then a line per part (its name and share). `parts` are
 * `{ label, value, color }`; `color` is a CSS colour, e.g. `rgb(var(--gl-btn))`.
 */
export default function SplitBar({ parts, label, formatValue = null }) {
    const total = parts.reduce((sum, part) => sum + Math.max(0, Number(part.value) || 0), 0);
    const share = (part) => (total > 0 ? Math.round((Math.max(0, Number(part.value) || 0) / total) * 100) : 0);

    return (
        <>
            <div className="gl-split" role="img" aria-label={label}>
                {total > 0 && parts.map((part, index) => share(part) > 0 && <i key={part.label} style={{ '--i': index, width: `${share(part)}%`, background: part.color }} />)}
            </div>
            {parts.map((part) => (
                <div key={part.label} className="gl-kv">
                    <span className="inline-flex items-center gap-2"><i className="inline-block h-2 w-2 rounded-sm" style={{ background: part.color }} aria-hidden="true" />{part.label}</span>
                    <b className="gl-num">{formatValue ? `${formatValue(part.value)}، ` : ''}{share(part)}%</b>
                </div>
            ))}
        </>
    );
}
