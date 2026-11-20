import { Children, Fragment, isValidElement, useLayoutEffect, useRef, useState } from 'react';
import { Label, ListBox, Select } from '@heroui/react';

/** The empty choice ("— اختر —") needs a key of its own: HeroUI's keys are never empty. */
const EMPTY_KEY = '__empty__';

const keyOf = (value) => (value === '' || value === null || value === undefined ? EMPTY_KEY : String(value));

/** The plain words of an option's label, for type-ahead and the closed field's reading. */
function textOf(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    if (isValidElement(node)) return textOf(node.props.children);

    return '';
}

/** The <option> elements among `children`, through fragments, arrays and conditions. */
function optionsOf(children) {
    return Children.toArray(children).flatMap((child) => {
        if (!isValidElement(child)) return [];
        if (child.type === Fragment) return optionsOf(child.props.children);
        if (child.type === 'option') {
            const value = child.props.value ?? textOf(child.props.children);

            return [{ key: keyOf(value), value: String(value ?? ''), label: child.props.children, text: textOf(child.props.children), disabled: Boolean(child.props.disabled) }];
        }

        return [];
    });
}

/**
 * A drop-down list: HeroUI's Select on the frosted pop surface, taking a
 * native <select>'s props and its <option> children, so a page swaps one
 * for the other unchanged. `onChange` gets an event-like object
 * (`event.target.value`); `name` keeps the choice in a form's data; `id`
 * goes on the field's key, so a page's <label htmlFor> still names it.
 */
export default function ChoiceSelect({ id, name, value, defaultValue, onChange, disabled = false, required = false, className = '', children, 'aria-label': ariaLabel, ...props }) {
    const options = optionsOf(children);
    const rootRef = useRef(null);
    // The page's own label for the field (a <label htmlFor={id}> or one around it), read once drawn, so the key is named by it.
    const [pageLabel, setPageLabel] = useState(null);

    useLayoutEffect(() => {
        const root = rootRef.current;
        const label = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || root?.closest('label');

        if (!label) {
            return;
        }

        const copy = label.cloneNode(true);
        copy.querySelectorAll('.gl-choice').forEach((node) => node.remove());
        const text = copy.textContent.replace(/\s+/g, ' ').trim();
        setPageLabel(text || null);
    }, [id]);

    const fieldName = ariaLabel ?? pageLabel;
    const selectedKey = value === undefined ? undefined : keyOf(value);

    return (
        <Select
            {...props}
            ref={rootRef}
            name={name}
            aria-label={fieldName ?? undefined}
            className={`gl-choice ${className}`}
            selectedKey={selectedKey}
            defaultSelectedKey={defaultValue === undefined ? undefined : keyOf(defaultValue)}
            disabledKeys={options.filter((option) => option.disabled).map((option) => option.key)}
            isDisabled={disabled}
            isRequired={required}
            onSelectionChange={(key) => {
                const chosen = options.find((option) => option.key === String(key));
                if (chosen) {
                    onChange?.({ target: { value: chosen.value, name }, currentTarget: { value: chosen.value, name } });
                }
            }}
        >
            {fieldName && <Label className="sr-only">{fieldName}</Label>}
            <Select.Trigger id={id} className="gl-choice-trigger">
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="gl-choice-pop">
                <ListBox>
                    {options.map((option) => (
                        <ListBox.Item key={option.key} id={option.key} textValue={option.text || ' '}>
                            {option.label}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}
