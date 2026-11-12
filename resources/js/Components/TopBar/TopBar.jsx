import { Link, usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import BrandLogo from '@/Components/BrandLogo';
import ActivityBell from '@/Components/ActivityBell';
import { shouldPrefetchPage, HOME_LINK, currentGroup, topBarItems } from '@/lib/navigation';
import MegaMenu, { megaWidth } from './MegaMenu';
import AccountMenu from './AccountMenu';
import LookStudio from './LookStudio';
import { useTheme } from '@/hooks/useTheme';
import './top-bar.css';
import { useMegaMenu } from './useMegaMenu';

/** The app name without the "AF" the logo already shows. */
export function shortAppName(appName) {
    return (appName ?? '').replace(/^AF\s+/i, '');
}

/** How many things wait in a section's pages, from the page's badges. */
function badgeOf(group, badges) {
    return group.links.reduce((sum, link) => sum + (badges[link.href] > 0 ? badges[link.href] : 0), 0);
}

/**
 * The floating glass bar at the top of every page: the logo, the sections in
 * the middle with a dark light that follows the pointer, and the tools (search,
 * activity, account; the menu button on phones). Once the page's title has
 * scrolled away, `where` ({ section, page, scope? }) takes the branch's place
 * under the name, and the page's name sits beside the logo on phones, so the
 * user still sees where they are — and, with `scope`, whose figures they read. A section's pages open in one panel under it
 * that reshapes itself as the pointer moves between sections; a mouse click
 * on a section opens its first page, while touch and the keyboard, with no
 * hover, open the panel. Beside the section dock (`slim`), wide screens see
 * one context card instead: where the page sits (`trail`), the working
 * branch (`branchChip`), the search, the theme, this person's appearance
 * panel (LookStudio), the activity and the account on its first row, and
 * the section's pages (`context`) as tabs on its second.
 */
export default function TopBar({ groups, badges, where, onOpenPalette, onOpenDrawer, drawerOpen, layerOpen, onShowShortcuts, onStartTour, slim = false, trail = null, context = null, branchChip = null }) {
    const { props, url } = usePage();
    const { dark, changePreference } = useTheme();
    const { appName, auth } = props;
    const user = auth?.user;
    const branchLabel = props.branchView ? props.branchView.current?.name ?? 'جميع الفروع' : user?.branchName;
    const items = topBarItems(groups);
    const current = currentGroup(groups, url);
    const currentScope = props.branchView?.current ? branchLabel : where?.scope;
    const pageLabel = where ? (currentScope ? [where.page, currentScope] : [where.section, where.page]).filter(Boolean).join(' · ') : null;
    const searchText = props.can?.recordPayments && props.can?.viewSubscriptions ? 'ابحث عن صفحة أو مشترك…' : 'ابحث عن صفحة أو أمر…';

    const { scrolled, barRef, clearTimers, closeMega, currentKey, geometry, highlightRef, hoverItem, itemRefs, leaveZone, litKey, megaRef, navRef, onMegaKeyDown, onSectionClick, onSectionKeyDown, openGroup, openId, panelRef, panels, pointerType, popover, setGeometry, setHoverKey, setPopover, state, still, syncHighlight, togglePopover } = useMegaMenu({ current, groups, items, layerOpen, url });

    return (
        <>
            <header className={`tn-header ${scrolled ? 'is-scrolled' : ''}`} data-slim={slim || undefined}>
                <div
                    ref={barRef}
                    className="tn-glass"
                    onTransitionEnd={(event) => {
                        if (event.target === barRef.current) {
                            syncHighlight(true);

                            if (state.current.openId) {
                                setGeometry((previous) => ({ ...previous, top: barRef.current.getBoundingClientRect().bottom + 10 }));
                            }
                        }
                    }}
                >
                    <div className="flex min-w-0 items-center">
                        <Link href={HOME_LINK.href} prefetch={shouldPrefetchPage(HOME_LINK.href)} className="tn-brand" data-tour="brand" aria-label={`${appName}، ${branchLabel ?? 'نظام التحصيل الكهربائي'}، الصفحة الرئيسية`}>
                            <BrandLogo alt={appName} markSize={38} />
                            <span className="tn-brand-divider" aria-hidden="true" />
                            <span className="tn-brand-text">
                                <span className="tn-brand-name" dir="auto">{shortAppName(appName)}</span>
                                <span className="tn-brand-branch" dir="auto">
                                    <span key={pageLabel ?? ''} className={`tn-brand-swap ${pageLabel ? 'is-page' : ''}`}>{pageLabel ?? branchLabel ?? 'نظام التحصيل الكهربائي'}</span>
                                </span>
                            </span>
                        </Link>
                        {where && <span key={where.page} className="tn-where" aria-hidden="true">{[where.page, where.scope].filter(Boolean).join(' · ')}</span>}
                    </div>

                    <nav
                        ref={navRef}
                        className="tn-sections"
                        data-tour="sections"
                        aria-label="أقسام النظام"
                        onPointerOver={(event) => {
                            const element = event.target.closest('[data-item]');
                            const item = element && items.find((candidate) => candidate.key === element.dataset.item);

                            if (item && event.pointerType === 'mouse') {
                                hoverItem(item);
                            }
                        }}
                        onPointerLeave={(event) => event.pointerType === 'mouse' && leaveZone()}
                        onFocus={(event) => {
                            const element = event.target.closest('[data-item]');

                            if (element && event.target.matches(':focus-visible')) {
                                setHoverKey(element.dataset.item);
                            }
                        }}
                        onBlur={(event) => {
                            if (!event.relatedTarget?.closest?.('.tn-sections')) {
                                setHoverKey(null);
                            }
                        }}
                    >
                        <span ref={highlightRef} className="tn-highlight" aria-hidden="true" />
                        {items.map((item, index) => {
                            const isCurrent = item.key === currentKey;
                            const register = (element) => (element ? itemRefs.current.set(item.key, element) : itemRefs.current.delete(item.key));

                            if (item.link) {
                                return (
                                    <Link
                                        key={item.key}
                                        ref={register}
                                        href={item.link.href}
                                        prefetch={shouldPrefetchPage(item.link.href)}
                                        className="tn-section"
                                        data-item={item.key}
                                        data-lit={litKey === item.key}
                                        data-current={isCurrent || undefined}
                                        data-tour={isCurrent ? 'current' : undefined}
                                        aria-current={isCurrent ? 'page' : undefined}
                                        onKeyDown={(event) => onSectionKeyDown(event, item)}
                                    >
                                        <Icon name={item.link.icon} className="tn-section-icon" />
                                        <span>{item.link.label}</span>
                                        {badges[item.link.href] > 0 && <span className="tn-badge" aria-hidden="true">{badges[item.link.href]}</span>}
                                    </Link>
                                );
                            }

                            const badge = badgeOf(item.group, badges);

                            return (
                                <button
                                    key={item.key}
                                    ref={register}
                                    type="button"
                                    className="tn-section"
                                    data-item={item.key}
                                    data-lit={litKey === item.key}
                                    data-current={isCurrent || undefined}
                                    data-tour={isCurrent ? 'current' : undefined}
                                    aria-expanded={openId === item.group.id}
                                    aria-controls="tn-mega"
                                    aria-current={isCurrent ? 'true' : undefined}
                                    title={`${item.group.label} · Alt+${index + 1}`}
                                    onPointerDown={(event) => { pointerType.current = event.pointerType; }}
                                    onClick={(event) => onSectionClick(event, item.group)}
                                    onKeyDown={(event) => onSectionKeyDown(event, item)}
                                >
                                    <Icon name={item.group.icon} className="tn-section-icon" />
                                    <span className="tn-label-short">{item.group.shortLabel}</span>
                                    <span className="tn-label-full">{item.group.label}</span>
                                    {badge > 0 && (
                                        <>
                                            <span className="tn-badge" aria-hidden="true">{badge}</span>
                                            <span className="sr-only">، {badge} بانتظارك</span>
                                        </>
                                    )}
                                    <Icon name="chevron-down" className="tn-chevron" />
                                </button>
                            );
                        })}
                    </nav>

                    <div className="tn-tools flex items-center gap-1">
                        {trail && <div className="tn-bar-trail">{trail}</div>}
                        {branchChip}
                        {/* Named by the words it shows, so a voice command that says them reaches it, even when the narrow bar hides them. */}
                        <button type="button" className="tn-search" data-tour="search" onClick={onOpenPalette} aria-label={`${searchText} Ctrl K`} aria-keyshortcuts="Control+K" title="بحث وأوامر · Ctrl K">
                            <Icon name="search" />
                            <span className="tn-search-text flex-1 text-start">{searchText}</span>
                            <span className="tn-kbd" dir="ltr">Ctrl K</span>
                        </button>
                        <button type="button" className="tn-tool" onClick={() => changePreference(dark ? 'light' : 'dark')} aria-label={dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'} title={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}>
                            <Icon name={dark ? 'sun' : 'moon'} />
                        </button>
                        <LookStudio open={popover === 'look'} onToggle={() => togglePopover('look')} onClose={() => setPopover(null)} />
                        <ActivityBell open={popover === 'bell'} onToggle={() => togglePopover('bell')} onClose={() => setPopover(null)} />
                        <span className="tn-separator" aria-hidden="true" />
                        <AccountMenu
                            open={popover === 'account'}
                            onToggle={() => togglePopover('account')}
                            onClose={() => setPopover(null)}
                            onShowShortcuts={() => {
                                setPopover(null);
                                onShowShortcuts();
                            }}
                            onStartTour={() => {
                                setPopover(null);
                                onStartTour();
                            }}
                        />
                        <button type="button" className="tn-tool tn-mobile-only" data-tour="menu" onClick={onOpenDrawer} aria-label="القائمة" aria-expanded={drawerOpen}>
                            <Icon name="menu" />
                        </button>
                    </div>
                    {context && <div className="tn-bar-tabs">{context}</div>}
                </div>
            </header>

            {/* The mega menu opens on hover and takes the arrow keys and Escape. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <div
                id="tn-mega"
                ref={megaRef}
                role="region"
                aria-label={openGroup?.label ?? 'صفحات القسم'}
                inert={!openId}
                className={`tn-mega ${openId ? 'is-open' : ''} ${still ? 'is-still' : ''}`}
                style={{ '--tn-mega-width': `${geometry.width}px`, '--tn-mega-height': `${geometry.height}px`, '--tn-mega-x': `${geometry.x}px`, '--tn-mega-top': `${geometry.top}px` }}
                onPointerEnter={clearTimers}
                onPointerLeave={(event) => event.pointerType === 'mouse' && leaveZone()}
                onKeyDown={onMegaKeyDown}
            >
                {panels.map((panel, index) => {
                    const group = groups.find((candidate) => candidate.id === panel.id);

                    return group && (
                        <MegaMenu
                            key={panel.key}
                            contentRef={index === panels.length - 1 ? panelRef : undefined}
                            group={group}
                            url={url}
                            badges={badges}
                            width={megaWidth(group)}
                            shift={panel.shift}
                            leaving={panel.leaving}
                            onSearch={() => {
                                closeMega();
                                onOpenPalette();
                            }}
                        />
                    );
                })}
            </div>
        </>
    );
}
