import { Checkbox } from '@heroui/react';

/**
 * A tick box: HeroUI's Checkbox, taking a native checkbox's props so a page
 * swaps one for the other unchanged. `onChange` gets an event-like object
 * (`event.target.checked`, `value`, `name`), `disabled`, `name`, `value`,
 * `id` and `aria-label` pass through, and `indeterminate` shows a page
 * partly ticked, and `showControl={false}` hides the box for a tile that shows its own mark. Its words are `children`; with none, the box sits inside
 * the page's own label, which still names it.
 */
export default function CheckBox({ checked = false, onChange, disabled = false, indeterminate = false, name, value, id, className = '', showControl = true, children = null, ...props }) {
    return (
        <Checkbox
            // Its own box, not a list table's row selection (HeroUI's Table would otherwise claim it).
            slot={null}
            {...props}
            id={id}
            name={name}
            value={value === undefined ? undefined : String(value)}
            isSelected={Boolean(checked)}
            isIndeterminate={indeterminate}
            isDisabled={disabled}
            onChange={(isSelected) => onChange?.({ target: { checked: isSelected, value, name }, currentTarget: { checked: isSelected, value, name } })}
            className={`gl-check ${className}`}
        >
            <Checkbox.Content>
                <Checkbox.Control className={showControl ? undefined : 'sr-only'}><Checkbox.Indicator /></Checkbox.Control>
                {children}
            </Checkbox.Content>
        </Checkbox>
    );
}
