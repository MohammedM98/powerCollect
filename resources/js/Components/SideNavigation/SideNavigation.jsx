import { useEffect } from 'react';
import { Link, usePage } from '@inertiajs/react';
import BrandLogo from '@/Components/BrandLogo';
import Icon from '@/Components/Icon';
import { Avatar } from '@/Components/TopBar/AccountMenu';
import { HOME_LINK, currentGroup, groupLandingLink, isActiveLink, shouldPrefetchPage } from '@/lib/navigation';
import './side-navigation.css';

/** How many things wait in a section: the sum of its pages' badges. */
export function sectionBadge(group, badges) {
    return group.links.reduce((total, link) => total + (badges[link.href] ?? 0), 0);
}

/**
 * The section dock on wide screens, for a company whose look puts the
 * sections at the side (`sidebar`, or `rail`): a slim floating glass
 * column at the page's start (the right, in Arabic) with the logo, home,
 * one icon per section with its short name and what waits in it, and the
 * signed-in user at the bottom. A section opens its first page; its other
 * pages are the tabs above the page's title (PageTrail `SectionPages`).
 * Narrow screens keep the top bar and the bottom tab bar instead.
 */
export default function SideNavigation({ groups, badges }) {
    const { props, url } = usePage();
    const user = props.auth?.user;
    const current = currentGroup(groups, url);

    useEffect(() => {
        document.documentElement.dataset.sideNavigation = 'dock';

        return () => delete document.documentElement.dataset.sideNavigation;
    }, []);

    return (
        <aside className="sn-panel sn-dock text-gray-900" aria-label="الأقسام">
            <Link href={HOME_LINK.href} prefetch className="sn-dock-logo" aria-label={`${props.appName}، الرئيسية`}>
                <BrandLogo alt="" markSize={40} className="h-10 w-auto max-w-[56px] object-contain" />
            </Link>

            <nav className="sn-dock-items">
                <Link href={HOME_LINK.href} prefetch className="sn-dock-item" aria-current={isActiveLink(HOME_LINK, url) ? 'page' : undefined}>
                    <Icon name={HOME_LINK.icon} />
                    <span>{HOME_LINK.label}</span>
                </Link>
                {groups.map((group) => {
                    const landing = groupLandingLink(group);
                    const waiting = sectionBadge(group, badges);

                    if (!landing) {
                        return null;
                    }

                    return (
                        <Link
                            key={group.id}
                            href={landing.href}
                            prefetch={shouldPrefetchPage(landing.href)}
                            className="sn-dock-item"
                            aria-current={current?.id === group.id ? 'true' : undefined}
                            title={group.description}
                        >
                            <Icon name={group.icon} />
                            <span>{group.shortLabel}</span>
                            {waiting > 0 && <b className="sn-dock-badge" aria-label={`${waiting} بانتظارك`}>{waiting}</b>}
                        </Link>
                    );
                })}
            </nav>

            <Link href="/profile" prefetch className="sn-dock-me" aria-label={`${user?.name ?? ''}، الملف الشخصي`} title={user?.name}>
                <Avatar name={user?.name} />
            </Link>
        </aside>
    );
}
