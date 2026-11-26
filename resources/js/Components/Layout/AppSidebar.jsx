import { Accordion, Button, Chip, Dropdown, Header, Link, RouterProvider, Tooltip } from '@heroui/react';
import { useEffect, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import Icon from '@/Components/UI/Icon';
import BrandLogo from '@/Components/BrandLogo';
import { useBrand } from '@/hooks/useBrand';
import { HOME_LINK, currentGroup, isActiveLink, sectionLinks, shouldPrefetchPage } from '@/lib/navigation';
import { pageWindowOpen } from './shortcuts';
import { Avatar, LogoutForm } from './AccountMenu';
import './sidebar.css';

const SIDE_KEY = 'side';

/**
 * The side bar's two states, as in HeroUI Pro's sidebar: wide, with the
 * sections' names and their pages under them, or a compact rail of icons.
 * Only its toggle changes it, never the pointer passing by. Kept in this
 * browser; app.blade.php applies it before the page paints.
 */
function useSideMode() {
    const [mode, setMode] = useState(() => {
        try {
            return localStorage.getItem(SIDE_KEY) === 'rail' ? 'rail' : 'wide';
        } catch {
            return 'wide';
        }
    });

    useEffect(() => {
        document.documentElement.dataset.side = mode;

        try {
            localStorage.setItem(SIDE_KEY, mode);
        } catch {
            // A browser that keeps nothing still gets the chosen mode for this visit.
        }
    }, [mode]);

    return [mode, setMode];
}

/** How many things wait in a section's pages, from the page's badges. */
function badgeOf(group, badges) {
    return group.links.reduce((sum, link) => sum + (badges[link.href] > 0 ? badges[link.href] : 0), 0);
}

/** Loads a page's data while the pointer rests on its link, so opening it is instant. */
function prefetch(href) {
    if (shouldPrefetchPage(href)) {
        router.prefetch(href, { method: 'get' }, { cacheFor: '30s' });
    }
}

/** A count of what waits, as HeroUI's chip. */
function Count({ value }) {
    return value > 0 ? <Chip size="sm" className="sb-count">{value}</Chip> : null;
}

/** Shows `label` beside the compact rail's item; the wide bar already shows it. */
function RailTip({ compact, label, children }) {
    if (!compact) {
        return children;
    }

    return (
        <Tooltip delay={200} closeDelay={0}>
            {children}
            <Tooltip.Content placement="end" offset={10} className="sb-tip">{label}</Tooltip.Content>
        </Tooltip>
    );
}

/** One page in the bar: its icon, name and count; the open one raised. */
function SideLink({ link, url, badges, compact = false, nested = false }) {
    const current = isActiveLink(link, url);

    return (
        <RailTip compact={compact} label={link.label}>
            <Link
                href={link.href}
                className={`sb-item ${nested ? 'is-nested' : ''}`}
                data-current={current || undefined}
                aria-current={current ? 'page' : undefined}
                aria-label={compact ? link.label : undefined}
                data-tour={current && !nested ? 'current' : undefined}
                onHoverStart={() => prefetch(link.href)}
            >
                {!nested && <Icon name={link.icon} className="sb-icon" />}
                {!compact && <span className="sb-label">{link.label}</span>}
                {!compact && <Count value={badges[link.href]} />}
            </Link>
        </RailTip>
    );
}

/** A section on the compact rail: its icon opens a drop-down of its pages beside the bar. */
function RailSection({ group, url, badges, isCurrent, open, onOpenChange }) {
    const badge = badgeOf(group, badges);

    return (
        <Dropdown isOpen={open} onOpenChange={onOpenChange}>
            <Dropdown.Trigger className="sb-item" data-current={isCurrent || undefined} data-tour={isCurrent ? 'current' : undefined} aria-label={badge > 0 ? `${group.label}، ${badge} بانتظارك` : group.label}>
                <Icon name={group.icon} className="sb-icon" />
                {badge > 0 && <span className="sb-dot" aria-hidden="true" />}
            </Dropdown.Trigger>
            <Dropdown.Popover className="gl-pop sb-pop" placement="end top" offset={12}>
                <Dropdown.Menu aria-label={group.label}>
                    <Dropdown.Section>
                        <Header className="sb-pop-head">{group.label}</Header>
                        {sectionLinks(group).map((link) => (
                            <Dropdown.Item key={link.href} id={link.href} href={link.href} textValue={link.label} className="sb-pop-item" data-current={isActiveLink(link, url) || undefined}>
                                <Icon name={link.icon} className="sb-icon" />
                                <span className="sb-label">{link.label}</span>
                                <Count value={badges[link.href]} />
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Section>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}

/**
 * The desktop side bar, after HeroUI Pro's sidebar, built from HeroUI: the
 * company's logo and the toggle on top, home, then each
 * section. Wide, a section is an accordion whose pages open under it (the
 * current one open); compact, the rail shows icons with tooltips and a
 * section's icon opens a drop-down of its pages. The account sits at its
 * foot. Alt + a number opens a section.
 */
export default function AppSidebar({ groups, badges }) {
    const { props, url } = usePage();
    const { name: companyName, tagline } = useBrand();
    const user = props.auth?.user;
    const [mode, setMode] = useSideMode();
    const compact = mode === 'rail';
    const current = currentGroup(groups, url);
    const [expanded, setExpanded] = useState(() => new Set(current ? [current.id] : []));
    const [railOpen, setRailOpen] = useState(null);
    const onHome = isActiveLink(HOME_LINK, url);
    // A user with a single section sees its pages directly.
    const singleSection = groups.length === 1 ? groups[0] : null;

    // Opening a page in another section opens that section and closes the rail's menu.
    const [lastUrl, setLastUrl] = useState(url);
    if (url !== lastUrl) {
        setLastUrl(url);
        setRailOpen(null);
        if (current && !expanded.has(current.id)) {
            setExpanded(new Set([current.id]));
        }
    }

    useEffect(() => {
        function onKeyDown(event) {
            const digit = /^Digit[1-9]$/.test(event.code) ? Number(event.code.slice(5)) : null;
            const group = digit && groups[digit - 1];

            if (!event.altKey || event.ctrlKey || !group || pageWindowOpen() || !window.matchMedia('(min-width: 1024px)').matches) {
                return;
            }

            event.preventDefault();

            if (compact) {
                setRailOpen(group.id);
            } else {
                setExpanded(new Set([group.id]));
                requestAnimationFrame(() => document.querySelector(`.sb-side [data-group="${group.id}"] button`)?.focus());
            }
        }

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [groups, compact]);

    return (
        <RouterProvider navigate={(href) => router.visit(href)}>
            <aside className="sb-side" data-compact={compact || undefined} aria-label="الشريط الجانبي">
                <div className="sb-head">
                    <Link href={HOME_LINK.href} className="sb-brand" aria-label={`${companyName}، الصفحة الرئيسية`}>
                        <BrandLogo alt="" className="sb-logo" />
                        {!compact && (
                            <span className="sb-brand-text">
                                <b dir="auto">{companyName}</b>
                                <small dir="auto">{user?.branchName ?? tagline}</small>
                            </span>
                        )}
                    </Link>
                    <RailTip compact={compact} label="توسيع الشريط">
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            className="sb-toggle"
                            aria-label={compact ? 'توسيع الشريط الجانبي' : 'تصغير الشريط الجانبي'}
                            aria-expanded={!compact}
                            onPress={() => setMode(compact ? 'wide' : 'rail')}
                        >
                            <Icon name="layout-side" />
                        </Button>
                    </RailTip>
                </div>

                <nav className="sb-nav" data-tour="sections" aria-label="أقسام النظام">
                    <SideLink link={HOME_LINK} url={url} badges={badges} compact={compact} />
                    {!compact && <span className="sb-heading" aria-hidden="true">الأقسام</span>}

                    {singleSection ? (
                        sectionLinks(singleSection).map((link) => <SideLink key={link.href} link={link} url={url} badges={badges} compact={compact} />)
                    ) : compact ? (
                        groups.map((group) => (
                            <RailSection
                                key={group.id}
                                group={group}
                                url={url}
                                badges={badges}
                                isCurrent={!onHome && current?.id === group.id}
                                open={railOpen === group.id}
                                onOpenChange={(open) => setRailOpen(open ? group.id : null)}
                            />
                        ))
                    ) : (
                        <Accordion className="sb-groups" hideSeparator expandedKeys={expanded} onExpandedChange={setExpanded}>
                            {groups.map((group) => {
                                const badge = badgeOf(group, badges);
                                const isCurrent = current?.id === group.id;

                                return (
                                    <Accordion.Item key={group.id} id={group.id} className="sb-group" data-group={group.id}>
                                        <Accordion.Heading>
                                            <Accordion.Trigger className="sb-item" data-current={isCurrent || undefined} data-tour={isCurrent ? 'current' : undefined}>
                                                <Icon name={group.icon} className="sb-icon" />
                                                <span className="sb-label">{group.label}</span>
                                                <Count value={badge} />
                                                <Accordion.Indicator className="sb-chevron" />
                                            </Accordion.Trigger>
                                        </Accordion.Heading>
                                        <Accordion.Panel>
                                            <Accordion.Body className="sb-pages">
                                                {sectionLinks(group).map((link) => <SideLink key={link.href} link={link} url={url} badges={badges} nested />)}
                                            </Accordion.Body>
                                        </Accordion.Panel>
                                    </Accordion.Item>
                                );
                            })}
                        </Accordion>
                    )}
                </nav>

                <div className="sb-foot">
                    <RailTip compact={compact} label={user?.name ?? 'الملف الشخصي'}>
                        <Link href="/profile" className="sb-account" aria-label={`${user?.name ?? ''}، الملف الشخصي`} data-current={url.startsWith('/profile') || undefined}>
                            <Avatar name={user?.name} />
                            {!compact && (
                                <span className="sb-account-text">
                                    <b dir="auto">{user?.name}</b>
                                    <small dir="auto">{user?.roleLabel}</small>
                                </span>
                            )}
                        </Link>
                    </RailTip>
                    <LogoutForm>
                        <RailTip compact={compact} label="خارج النظام">
                            <Button isIconOnly variant="ghost" size="sm" type="submit" className="sb-toggle" aria-label="خارج النظام">
                                <Icon name="logout" />
                            </Button>
                        </RailTip>
                    </LogoutForm>
                </div>
            </aside>
        </RouterProvider>
    );
}
