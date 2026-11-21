/** A label above its field (components.css `gl-label`). */
export default function InputLabel({ value, className = '', children, ...props }) {
    return (
        <label {...props} className={`gl-label block ${className}`}>
            {value ?? children}
        </label>
    );
}
