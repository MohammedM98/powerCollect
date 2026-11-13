/**
 * A row of buttons in one tray, one of them chosen (the prototype's
 * segmented control, components.css `gl-seg`): the period a report covers, the
 * order of the branch cards. `options` are `{ value, label }`; `label`
 * names the group for screen readers.
 */
export default function SegmentedTabs({ options, value, onChange, label }) {
    return (
        <div role="group" aria-label={label} className="gl-seg">
            {options.map((option) => (
                <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
                    {option.label}
                </button>
            ))}
        </div>
    );
}
