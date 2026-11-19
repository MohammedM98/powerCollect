import { cloneElement } from 'react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';

/**
 * One labelled field of a form: its label (with a star when required), the
 * control (given the field's id), and under it either the error the server
 * found or the field's guidance (`hint`) in a quiet line. `span` is a grid
 * class to make it wider. The error or the guidance is read out with the
 * control (aria-describedby), so a screen reader names it on the field.
 */
export default function FormField({ id, label, required, error, hint, span = '', children }) {
    const errorId = error && id ? `${id}-error` : undefined;
    const hintId = !error && hint && id ? `${id}-hint` : undefined;
    const describedBy = [children.props['aria-describedby'], errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={`grid min-w-0 content-start gap-2 ${span}`}>
            <InputLabel htmlFor={id}>
                {label}
                {required && <span className="text-brand-500"> *</span>}
            </InputLabel>
            {cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
            {error ? <InputError id={errorId} message={error} /> : hint && <p id={hintId} className="m-0 text-[13.5px] leading-6 text-(--gl-muted)">{hint}</p>}
        </div>
    );
}
