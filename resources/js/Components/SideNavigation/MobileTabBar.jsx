import { Link, usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import { HOME_LINK, currentGroup, groupLandingLink, isActiveLink, shouldPrefetchPage } from '@/lib/navigation';
import { sectionBadge } from './SideNavigation';

/** How many sections the bar shows itself; the rest are under "المزيد". */
const SHOWN_SECTIONS = 2;

/**
 * The tab bar on phones and narrow screens, held to the screen's bottom
 * edge: home, the first sections, a button in the middle for a new payment
 * (for users who may record one), and "المزيد", which opens the menu with
 * every section (`onOpenMore`). Wide screens use the dock or the top bar.
 */
export default function MobileTabBar({ groups, badges, onOpenMore }) {
    const { props, url } = usePage();
    const current = currentGroup(groups, url);
    const shown = groups.filter((group) => groupLandingLink(group)).slice(0, SHOWN_SECTIONS);
    const canPay = Boolean(props.can?.recordPayments);
    const moreIsCurrent = Boolean(current) && !shown.some((group) => group.id === current.id);

    return (
        <nav className="sn-tabbar" aria-label="الأقسام" data-columns={shown.length + (canPay ? 3 : 2)}>
            <Link href={HOME_LINK.href} prefetch className="sn-tab" aria-current={isActiveLink(HOME_LINK, url) ? 'page' : undefined}>
                <Icon name={HOME_LINK.icon} />
                <span>{HOME_LINK.label}</span>
            </Link>
            {shown.slice(0, 1).map((group) => <SectionTab key={group.id} group={group} badges={badges} current={current} />)}
            {canPay && (
                <Link href="/payments" prefetch className="sn-tab sn-tab-main" aria-label="تسجيل دفعة">
                    <span><Icon name="plus" strokeWidth={2.2} /></span>
                </Link>
            )}
            {shown.slice(1).map((group) => <SectionTab key={group.id} group={group} badges={badges} current={current} />)}
            <button type="button" className="sn-tab" onClick={onOpenMore} aria-current={moreIsCurrent ? 'true' : undefined} aria-haspopup="dialog">
                <Icon name="grid" />
                <span>المزيد</span>
            </button>
        </nav>
    );
}

/** One section's tab: its icon, short name and what waits in it. */
function SectionTab({ group, badges, current }) {
    const landing = groupLandingLink(group);
    const waiting = sectionBadge(group, badges);

    return (
        <Link href={landing.href} prefetch={shouldPrefetchPage(landing.href)} className="sn-tab" aria-current={current?.id === group.id ? 'true' : undefined}>
            <Icon name={group.icon} />
            <span>{group.shortLabel}</span>
            {waiting > 0 && <b className="sn-dock-badge">{waiting}</b>}
        </Link>
    );
}
