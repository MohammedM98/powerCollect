/**
 * Tabs with a line in the company's colour under the open one, and a
 * small count beside each that has one. `options` are `{ value, label, count? }`.
 */
export default function UnderlineTabs({ options, value, onChange, label }) {
    return (
        <div className="gl-tabs gl-rise" role="tablist" aria-label={label}>
            {options.map((option) => (
                <button key={option.value} type="button" role="tab" aria-selected={value === option.value} onClick={() => onChange(option.value)}>
                    {option.label}
                    {option.count !== undefined && option.count !== null && <span className="gl-cnt gl-num">{option.count}</span>}
                </button>
            ))}
        </div>
    );
}
