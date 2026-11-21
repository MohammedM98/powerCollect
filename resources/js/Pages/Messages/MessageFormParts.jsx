import { useId } from 'react';
import Icon from '@/Components/Icon';

export function Field({ label, htmlFor, children, className = '' }) {
    return (
        <div className={className}>
            <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-gray-700">
                {label}
            </label>
            {children}
        </div>
    );
}

/** The keyboard focus ring every custom button here uses, like the app's own buttons. */
export const FOCUS_RING = 'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900';

/** One step of the page as a card, named by its title for screen readers. */
export function Card({ icon, title, description, children, actions = null }) {
    const titleId = useId();

    return (
        <section aria-labelledby={titleId} className="rounded-card border border-gray-100 bg-surface p-4 shadow-card sm:p-6">
            <div className="mb-6 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-graphite-gradient text-white dark:ring-1 dark:ring-white/10">
                    <Icon name={icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 id={titleId} className="font-sans font-bold text-gray-900">
                        {title}
                    </h2>
                    {description && <p className="text-xs text-gray-500">{description}</p>}
                </div>
                {actions}
            </div>
            {children}
        </section>
    );
}

export function Section({ title, hint, children }) {
    const titleId = useId();

    return (
        <section aria-labelledby={titleId} className="space-y-3">
            <div>
                <h4 id={titleId} className="text-sm font-bold text-gray-900">
                    {title}
                </h4>
                {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
            </div>
            {children}
        </section>
    );
}
