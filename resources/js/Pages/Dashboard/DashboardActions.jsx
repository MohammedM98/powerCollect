import { Button } from '@heroui/react';
import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import { shouldPrefetchPage } from '@/lib/navigation';

/**
 * The home page's action bar, right under the greeting, as the redesign's
 * pills: the main action (recording a payment) solid green, the others
 * quiet beside it; each says what it does when hovered. An action with
 * `onClick` opens a window over the dashboard; the others open their page.
 *
 * @param {{ actions: Array<{ href: string, onClick?: (() => void) | null, icon: string, title: string, subtitle: string, main?: boolean }> }} props
 */
export default function DashboardActions({ actions }) {
    if (actions.length === 0) {
        return null;
    }

    return (
        <nav className="gl-acts gl-dash-acts gl-rise" style={{ '--i': 1 }} aria-label="إجراءات سريعة">
            {actions.map((action) => {
                const className = `gl-act ${action.main ? 'is-solid' : ''}`;
                const content = (
                    <>
                        <Icon name={action.icon} className="h-[17px] w-[17px]" />
                        {action.title}
                    </>
                );

                return action.onClick ? (
                    <Button data-raw="" variant="ghost" key={action.href} className={className} data-tone={action.main ? 'pay' : undefined} onClick={action.onClick} aria-haspopup="dialog" title={action.subtitle}>
                        {content}
                    </Button>
                ) : (
                    <Link key={action.href} href={action.href} prefetch={shouldPrefetchPage(action.href)} className={className} data-tone={action.main ? 'pay' : undefined} title={action.subtitle}>
                        {content}
                    </Link>
                );
            })}
        </nav>
    );
}
