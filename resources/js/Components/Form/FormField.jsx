import { cloneElement } from 'react';
import InfoTip from '@/Components/InfoTip';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';

/**
 * One labelled field of a form: its label (with a star when required), an
 * "!" beside it holding the field's guidance (`hint`), the control (given
 * the field's id) and the error the server found. `span` is a grid class
 * to make it wider. An error marks the control invalid and is read out with
 * it (aria-describedby), so a screen reader names the problem on the field.
 */
export default function FormField({ id, label, required, error, hint, span = '', children }) {
    const errorId = error && id ? `${id}-error` : undefined;
    const describedBy = [children.props['aria-describedby'], errorId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={span}>
            <div className="flex items-center gap-1">
                <InputLabel htmlFor={id}>
                    {label}
                    {required && <span className="text-brand-500"> *</span>}
                </InputLabel>
                {hint && <InfoTip label={`عن حقل ${typeof label === 'string' ? label : ''}`.trim()}>{hint}</InfoTip>}
            </div>
            <div className="mt-1">{cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}</div>
            <InputError id={errorId} message={error} className="mt-1" />
        </div>
    );
}
