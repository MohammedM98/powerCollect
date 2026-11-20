import { Radio, RadioGroup } from '@heroui/react';

/**
 * One choice among a few, each drawn as a card or a tile: HeroUI's
 * RadioGroup (arrow keys move the choice, the group is one tab stop).
 * `options` are `{ value, label, disabled? }` (a label may hold any
 * content); `itemClassName(option, selected)` draws each card, and
 * `showControl={false}` hides the round mark for a card that shows its
 * choice by its own look. `onChange` gets the value picked.
 */
export default function RadioCards({ label, name, value, onChange, options, isDisabled = false, className = '', itemClassName = () => '', showControl = true, controlClassName = '' }) {
    return (
        <RadioGroup
            aria-label={label}
            name={name}
            value={value === undefined || value === null || value === '' ? null : String(value)}
            onChange={(next) => onChange(next)}
            isDisabled={isDisabled}
            className={`gl-radio-cards ${className}`}
        >
            {options.map((option) => {
                const selected = String(option.value) === String(value);

                return (
                    <Radio key={option.value} value={String(option.value)} isDisabled={option.disabled} className={itemClassName(option, selected)}>
                        <Radio.Content>
                            <Radio.Control className={showControl ? controlClassName : 'sr-only'}><Radio.Indicator /></Radio.Control>
                            {option.label}
                        </Radio.Content>
                    </Radio>
                );
            })}
        </RadioGroup>
    );
}
