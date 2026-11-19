import { ToggleButton, ToggleButtonGroup } from '@heroui/react';

/**
 * A choice of one among a few, as the redesign's segmented control: HeroUI's
 * ToggleButtonGroup on a grey track, the chosen option white on it
 * (components.css `gl-seg-group`). `options` are `{ value, label }`, a
 * label may hold an icon; `onChange` gets the value picked.
 */
export default function SegmentedChoice({ label, value, onChange, options, className = '' }) {
    return (
        <ToggleButtonGroup
            aria-label={label}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[String(value)]}
            onSelectionChange={(keys) => {
                const [next] = keys;

                if (next !== undefined && next !== String(value)) {
                    onChange(options.find((option) => String(option.value) === next)?.value ?? next);
                }
            }}
            className={`gl-seg-group ${className}`}
        >
            {options.map((option) => (
                <ToggleButton key={String(option.value)} id={String(option.value)} className="gl-seg-item">
                    {option.label}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
