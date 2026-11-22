import { cloneElement } from 'react';
import Icon from '@/Components/UI/Icon';

/**
 * A field with its unit inside it, at the end: ₪ for money, ك.و.س for
 * kilowatt-hours. Wraps one input: <Affix unit="₪"><TextInput … /></Affix>.
 * An `id` given to the Affix (as a form Field gives it) goes to the input,
 * with the field's other reading-out props. A locked input (disabled or
 * read-only) shows a lock beside its unit.
 */
export default function Affix({ unit, id, children, ...fieldProps }) {
    const locked = Boolean(children.props.disabled || children.props.readOnly);

    return (
        <div className="ma-affix relative" data-locked={locked ? '' : undefined}>
            {cloneElement(children, { ...fieldProps, id: id ?? children.props.id, className: `${children.props.className ?? ''} field-room-end-unit` })}
            <span className="ma-affix-unit pointer-events-none absolute flex items-center">
                {locked && <Icon name="lock" />}
                {unit}
            </span>
        </div>
    );
}
