import { Button } from '@heroui/react';
import { Link, usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import { shouldPrefetchPage, HOME_LINK, isActiveLink, lockedLinkProps, sectionLinks } from '@/lib/navigation';
import { Avatar, LogoutForm } from './AccountMenu';
import { LockMark } from './MegaMenu';
import ThemeSegments from './ThemeSegments';

/** How many things wait in a section's pages, from the page's badges. */
function badgeOf(group, badges) {
    return group.links.reduce((sum, link) => sum + (badges[link.href] > 0 ? badges[link.href] : 0), 0);
}

/**
 * The sections as a list: a search, the home page, then each section, which
 * opens to show its pages. Shared by the phone menu (NavigationDrawer) and
 * the side navigation. `expanded` is the open section's id. `compact` shows
 * only the icons (the narrow side rail): a section's icon calls `onExpand`
 * instead, so the rail can widen and open it.
 */
export default function NavigationMenu({ groups, badges, expanded, onExpandedChange, onOpenPalette, compact = false, onExpand }) {
    const { props, url } = usePage();
    const onHome = isActiveLink(HOME_LINK, url);
    const searchLabel = props.can?.recordPayments && props.can?.viewSubscriptions ? 'ابحث عن صفحة أو مشترك…' : 'ابحث عن صفحة أو أمر…';

    return <>
        <Button data-raw="" variant="ghost" onClick={onOpenPalette} className="tn-nav-search mb-3 flex h-12 w-full items-center gap-2.5 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 text-[15px] text-gray-500" aria-label={compact ? searchLabel : undefined} title={compact ? searchLabel : undefined}>
            <Icon name="search" className="h-5 w-5 shrink-0" />
            <span className="tn-nav-label">{searchLabel}</span>
        </Button>
        <div className="grid gap-1">
            <Link href={HOME_LINK.href} prefetch={shouldPrefetchPage(HOME_LINK.href)} className="tn-drawer-group" data-current={onHome || undefined} aria-current={onHome ? 'page' : undefined} title={compact ? HOME_LINK.label : undefined}>
                <Icon name={HOME_LINK.icon} className="tn-section-icon" />
                <span className="tn-nav-label">{HOME_LINK.label}</span>
            </Link>
            {groups.map((group) => {
                const isOpen = !compact && expanded === group.id;
                const badge = badgeOf(group, badges);

                return (
                    <div key={group.id}>
                        <Button data-raw="" variant="ghost"
                            className="tn-drawer-group"
                            aria-expanded={isOpen}
                            aria-label={compact ? group.label : undefined}
                            title={compact ? group.label : undefined}
                            onClick={() => (compact ? onExpand?.(group.id) : onExpandedChange(isOpen ? null : group.id))}
                        >
                            <Icon name={group.icon} className="tn-section-icon" />
                            <span className="tn-nav-label">{group.label}</span>
                            {badge > 0 && <span className="tn-nav-badge rounded-full bg-brand-500 px-1.5 text-[11px] font-bold leading-[18px] text-white">{badge}</span>}
                            <Icon name="chevron-down" className="tn-chevron" />
                        </Button>
                        {!compact && <div className={`tn-drawer-pages ${isOpen ? 'is-open' : ''}`} inert={!isOpen}>
                            <div>
                                <div className="grid gap-0.5 py-1 ps-3">
                                    {sectionLinks(group).map((link) => (
                                        <Link key={link.href} href={link.href} prefetch={!link.locked && shouldPrefetchPage(link.href)} className="tn-drawer-link" aria-current={isActiveLink(link, url) ? 'page' : undefined} {...lockedLinkProps(link)}>
                                            <Icon name={link.icon} />
                                            <span className="flex-1">{link.label}</span>
                                            {link.locked && <LockMark />}
                                            {badges[link.href] > 0 && <span className="rounded-full bg-brand-500 px-1.5 text-[11px] font-bold leading-[18px] text-white">{badges[link.href]}</span>}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>}
                    </div>
                );
            })}
        </div>
    </>;
}

/** Who is signed in, a way out, and the appearance (light, dark or the device's). `compact` keeps only the avatar and the way out. */
export function NavigationAccount({ compact = false }) {
    const user = usePage().props.auth?.user;

    return <>
        <div className={`mb-2 flex items-center gap-3 rounded-2xl bg-gray-50 p-2.5 ${compact ? 'flex-col' : ''}`}>
            <Link href="/profile" prefetch className="flex min-w-0 flex-1 items-center gap-3" aria-label={`${user?.name ?? ''}، الملف الشخصي`} title={compact ? user?.name : undefined}>
                <Avatar name={user?.name} />
                {!compact && <span className="min-w-0 flex-1">
                    <b dir="auto" className="block truncate text-[14.5px]">{user?.name}</b>
                    <small dir="auto" className="block text-[12.5px] text-gray-500">{user?.roleLabel}</small>
                </span>}
            </Link>
            <LogoutForm>
                <Button data-raw="" variant="ghost" type="submit" className="tn-tool" aria-label="تسجيل الخروج"><Icon name="logout" /></Button>
            </LogoutForm>
        </div>
        {!compact && <ThemeSegments />}
    </>;
}
