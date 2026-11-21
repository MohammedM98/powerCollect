import { Link } from '@inertiajs/react';
import Icon from '@/Components/UI/Icon';

/**
 * Every page's title, laid out as in the redesign: an optional quiet line
 * above it (`eyebrow`: the branch, a link back), the large title, the
 * page's guidance as a muted line under it (`info`), an optional line of
 * facts (`meta`: dates, counts), and the page's actions in their own row
 * under the section's tabs (placed by `.gl-page-top`). Goes in the
 * layout's `header`.
 */
export default function PageHeader({ title, eyebrow = null, info = null, meta = null, actions = null, titleAddon = null }) {
    return (
        <>
            <div className="gl-page-title min-w-0">
                {eyebrow && <div className="mb-1 text-sm font-semibold text-gray-500">{eyebrow}</div>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h1 className="ui-page-title text-3xl font-bold text-gray-900">{title}</h1>
                    {titleAddon}
                </div>
                {info && <p className="gl-page-sub">{info}</p>}
                {meta && <div className="gl-page-sub">{meta}</div>}
            </div>
            {actions && <div className="gl-page-actions flex flex-wrap items-center gap-2">{actions}</div>}
        </>
    );
}

/** The way back to the page above, as a page header's `eyebrow`. */
export function BackLink({ href, children }) {
    return (
        <Link href={href} prefetch className="inline-flex items-center gap-1 rounded transition hover:text-gray-900 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900">
            <Icon name="chevron-right" className="h-4 w-4" />
            {children}
        </Link>
    );
}
