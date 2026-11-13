import InputError from '@/Components/InputError';

/**
 * A grouped list, as in a phone's settings: rows with the name on one
 * side and the value on the other, a field showing its frame only under
 * the pointer or while typing. Suits short forms of numbers and settings.
 * `caption` is a quiet line under the group.
 */
export default function InsetList({ caption = null, children }) {
    return (
        <div>
            <div className="gl-inset">{children}</div>
            {caption && <p className="gl-inset-caption">{caption}</p>}
        </div>
    );
}

/**
 * One row of a grouped list: its name (a <label> for `htmlFor`), a line
 * under it (`hint`), the value at the other end, and the server's error
 * under the row.
 */
export function InsetRow({ label, htmlFor = null, hint = null, required = false, error = null, children }) {
    return (
        <div>
            <div className="gl-inset-row">
                <div className="gl-inset-label">
                    {htmlFor ? <label htmlFor={htmlFor}>{label}{required && <span className="text-brand-500"> *</span>}</label> : <b>{label}</b>}
                    {hint && <small>{hint}</small>}
                </div>
                <div className="gl-inset-value">{children}</div>
            </div>
            {error && <InputError message={error} className="px-4 pb-3" />}
        </div>
    );
}
