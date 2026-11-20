import { useRef } from 'react';
import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import Icon from '@/Components/Icon';

const DOT_COLORS = {
    green: 'var(--gl-ok)',
    amber: 'var(--gl-warn)',
    gray: 'var(--gl-faint)',
};

/**
 * A radio group rendered as chips (components.css `gl-chip`): HeroUI's
 * ToggleButtonGroup, one choice at a time.
 * Each option is `{ value, label, hint?, dot?, icon? }`:
 * `hint` is a quiet second part beside the label (a price, say), `dot` a
 * status color, `icon` an icon before the label, `disabled` a choice that
 * cannot be picked (with `title` saying why). The arrow keys move the
 * choice, as HeroUI's group does.
 *
 * `required` adds a hidden radio named `name`, so the form's own check
 * (validateFormFields) reports a missing choice under the field.
 */
export default function ChoiceChips({ id, name, value, onChange, options, label, required = false, disabled = false }) {
    const groupRef = useRef(null);
    const selectedIndex = options.findIndex((option) => String(option.value) === String(value));

    return (
        <div ref={groupRef} className="contents">
            <ToggleButtonGroup
                id={id}
                aria-label={label}
                aria-required={required || undefined}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={selectedIndex === -1 ? [] : [String(options[selectedIndex].value)]}
                onSelectionChange={(keys) => {
                    const [next] = keys;

                    if (next !== undefined) {
                        onChange(String(next));
                    }
                }}
                isDisabled={disabled}
                className="flex flex-wrap gap-2"
            >
                {options.map((option) => (
                    <ToggleButton
                        key={option.value}
                        id={String(option.value)}
                        isDisabled={option.disabled}
                        title={option.title}
                        className="gl-chip inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {option.icon && <Icon name={option.icon} className="h-4 w-4 shrink-0" />}
                        {option.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DOT_COLORS[option.dot] }} aria-hidden="true" />}
                        {option.label}
                        {option.hint && <span className="gl-num text-xs font-medium opacity-75">{option.hint}</span>}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            {required && (
                <input
                    type="radio"
                    name={name}
                    required
                    checked={selectedIndex !== -1}
                    onChange={() => {}}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only"
                    // The form focuses the first missing field; send it on to the choices.
                    onFocus={() => groupRef.current?.querySelector('[role="radio"]')?.focus()}
                />
            )}
        </div>
    );
}
