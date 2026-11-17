import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import { shouldPrefetchPage } from '@/lib/navigation';

/**
 * The home page's action bar, right under the greeting: the main action
 * (recording a payment) as the one solid button, the others as surface
 * buttons beside it, each with a short line of what it does. An action with
 * `onClick` opens a window over the dashboard; the others open their page.
 *
 * @param {{ actions: Array<{ href: string, onClick?: (() => void) | null, icon: string, title: string, subtitle: string, main?: boolean }> }} props
 */
export default function DashboardActions({ actions }) {
    if (actions.length === 0) {
        return null;
    }

    return (
        <nav className="gl-actions gl-rise" style={{ '--i': 1 }} aria-label="إجراءات سريعة">
            {actions.map((action) => {
                const className = `gl-action ${action.main ? 'gl-main' : ''}`;
                const content = (
                    <>
                        <span className="gl-action-ico"><Icon name={action.icon} className="h-5 w-5" /></span>
                        <span className="min-w-0">
                            <b>{action.title}</b>
                            <small>{action.subtitle}</small>
                        </span>
                    </>
                );

                return action.onClick ? (
                    <button key={action.href} type="button" className={className} onClick={action.onClick} aria-haspopup="dialog">
                        {content}
                    </button>
                ) : (
                    <Link key={action.href} href={action.href} prefetch={shouldPrefetchPage(action.href)} className={className}>
                        {content}
                    </Link>
                );
            })}
        </nav>
    );
}
