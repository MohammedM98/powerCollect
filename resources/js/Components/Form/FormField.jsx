import { cloneElement } from 'react';
import Icon from '@/Components/UI/Icon';
import InputError from '@/Components/UI/InputError';
import InputLabel from '@/Components/UI/InputLabel';

const LOCK_STATES = {
    locked: { icon: 'lock', label: 'مغلق' },
    open: { icon: 'unlock', label: 'مفتوح' },
};

/**
 * One labelled field of a form: its label row, the control (given the
 * field's id), and under it either the error the server found or the
 * field's guidance (`hint`) in a quiet line. `span` is a grid class to make
 * it wider. The error or the guidance is read out with the control
 * (aria-describedby), so a screen reader names it on the field.
 *
 * The label row holds the name (with a star when required); `lock` says
 * whether a field that can be closed is closed or open now ('locked' or
 * 'open', a small pill beside the name), and `action` is a key at the row's
 * end (a FieldAction: «تعديل يدوي», «إلغاء التعديل»).
 */
export default function FormField({ id, label, required, error, hint, span = '', lock = null, action = null, children }) {
    const errorId = error && id ? `${id}-error` : undefined;
    const hintId = !error && hint && id ? `${id}-hint` : undefined;
    const describedBy = [children.props['aria-describedby'], errorId, hintId].filter(Boolean).join(' ') || undefined;
    const state = LOCK_STATES[lock];

    return (
        <div className={`ma-field ${span}`} data-lock={state ? lock : undefined}>
            <div className="ma-field-head">
                <InputLabel htmlFor={id}>
                    {label}
                    {required && <span className="ma-field-req"> *</span>}
                </InputLabel>
                {state && (
                    <span className="ma-field-state" data-state={lock}>
                        <Icon name={state.icon} />
                        {state.label}
                    </span>
                )}
                {action}
            </div>
            {cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
            {error ? <InputError id={errorId} message={error} /> : hint && <p id={hintId} className="ma-field-hint">{hint}</p>}
        </div>
    );
}
