/** What is wrong with a field, under it, in the glass look's red. */
export default function InputError({ message, className = '' }) {
    if (!message) {
        return null;
    }

    return (
        <p data-input-error className={`gl-error ${className}`}>
            {message}
        </p>
    );
}
