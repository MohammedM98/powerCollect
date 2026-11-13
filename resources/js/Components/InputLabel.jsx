/** A field's name above it, as the prototype's (components.css `gl-label`). */
export default function InputLabel({ value, className = '', children, ...props }) {
    return (
        <label {...props} className={`gl-label block ${className}`}>
            {value ?? children}
        </label>
    );
}
