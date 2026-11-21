/** The user's avatar: their initial on graphite, with a green dot for signed in. */
export function Avatar({ name, large = false }) {
    return (
        <span className={`tn-avatar ${large ? 'is-large' : ''}`} aria-hidden="true">
            {(name ?? '').trim().substring(0, 1)}
            <span className="tn-avatar-online" />
        </span>
    );
}

/** Signs out (the form posts to /logout with the page's CSRF token). */
export function LogoutForm({ children, className }) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

    return (
        <form method="POST" action="/logout" className={className}>
            <input type="hidden" name="_token" value={csrfToken} />
            {children}
        </form>
    );
}
