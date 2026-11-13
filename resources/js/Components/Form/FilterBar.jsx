/**
 * A row of filters above a list: every filter the same width and height,
 * as many to a line as fit, wrapping evenly on smaller screens. Put one
 * FilterField in it per filter, whatever the control (search, list, date).
 */
export function FilterBar({ label = 'تصفية', className = '', children }) {
    return (
        <div role="group" aria-label={label} className={`gl-filter-bar ${className}`}>
            {children}
        </div>
    );
}

/**
 * One filter: its name above its control. `htmlFor` ties a native field to
 * the name; a control with its own aria-label (a date, a list) needs none.
 */
export function FilterField({ label, htmlFor, children }) {
    const Wrapper = htmlFor ? 'div' : 'label';

    return (
        <Wrapper className="gl-filter-field">
            {htmlFor ? <label htmlFor={htmlFor} className="gl-filter-label">{label}</label> : <span className="gl-filter-label">{label}</span>}
            {children}
        </Wrapper>
    );
}
