/** Settings kept in this browser: the last export of each kind, and the templates saved for it. */
export const store = {
    read(key, fallback) {
        try {
            const value = window.localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch {
            return fallback;
        }
    },
    write(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Private browsing: the settings simply aren't remembered.
        }
    },
};

export function Section({ title, hint = null, children }) {
    return (
        <section className="border-b border-gray-100 py-4 last:border-b-0">
            <h3 className="mb-3 flex items-center justify-between gap-2 text-sm font-bold text-gray-900">
                {title}
                {hint && <span className="text-xs font-medium text-gray-500">{hint}</span>}
            </h3>
            {children}
        </section>
    );
}
