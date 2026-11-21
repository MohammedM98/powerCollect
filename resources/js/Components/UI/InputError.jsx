/**
 * What is wrong with a field, under it, in the panel look's red. Announced
 * as it appears (role="alert"); give it an `id` and point the field's
 * aria-describedby at it so the error is read with the field too.
 */
export default function InputError({ message, id, className = '' }) {
    if (!message) {
        return null;
    }

    return (
        <p id={id} role="alert" data-input-error className={`gl-error ${className}`}>
            {message}
        </p>
    );
}
