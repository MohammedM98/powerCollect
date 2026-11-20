import { Button } from '@heroui/react';
import { useEffect, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import BrandLogo from '@/Components/BrandLogo';
import ActivityBell from '@/Components/ActivityBell';
import { useBrand } from '@/hooks/useBrand';
import { shouldPrefetchPage, HOME_LINK, currentGroup, topBarItems } from '@/lib/navigation';
import MegaMenu, { megaWidth } from './MegaMenu';
import { LogoutForm } from './AccountMenu';
import { AppearanceMenu, QuickActionsMenu } from './TopBarMenus';
import './top-bar.css';
import { useMegaMenu } from './useMegaMenu';

const SIDE_KEY = 'side';

/**
 * The side bar's mode, as in the redesign: a narrow rail of icons (the
 * default) that slides open under the pointer, wide with the sections'
 * names, or hidden off the screen's edge (it slides back in while the
 * pointer rests on that edge). Kept in this browser; app.blade.php applies
 * it before the page paints.
 */
const SIDE_MODES = ['rail', 'wide', 'hidden'];
/** The top bar's button walks the modes in the redesign's order. */
const NEXT_MODE = { rail: 'hidden', hidden: 'wide', wide: 'rail' };
const MODE_LABELS = { wide: 'موسّعة', rail: 'أيقونات', hidden: 'مخفية' };

function useSideMode() {
    const [mode, setMode] = useState(() => {
        try {
            const saved = localStorage.getItem(SIDE_KEY);
            return SIDE_MODES.includes(saved) ? saved : 'rail';
        } catch {
            return 'rail';
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

/**
 * The desktop dock holds the sections. The top bar holds the working branch,
 * search, theme, activity and account, with the menu button on phones.
 * The open section's pages (`subnav`) sit as
 * tabs on a second row directly under it, in the same bar. Once the page's title has
 * scrolled away, `where` ({ section, page, scope? }) takes the branch's place
 * under the name, and the page's name sits beside the logo on phones, so the
 * user still sees where they are — and, with `scope`, whose figures they read. A section's pages open in one panel under it
 * that reshapes itself as the pointer moves between sections; a mouse click
 * on a section opens its first page, while touch and the keyboard, with no
 * hover, open the panel. Wide screens show the working branch (`branchChip`)
 * among the tools.
 */
export default function TopBar({ groups, badges, where, onOpenPalette, onOpenDrawer, drawerOpen, layerOpen, onShowShortcuts, onStartTour, subnav = null, branchChip = null }) {
    const { props, url } = usePage();
    const { name: companyName, tagline } = useBrand();
    const user = props.auth?.user;
    const branchLabel = props.branchView ? props.branchView.current?.name ?? 'جميع الفروع' : user?.branchName;
    const items = topBarItems(groups);
    const current = currentGroup(groups, url);
    const currentScope = props.branchView?.current ? branchLabel : where?.scope;
    const pageLabel = where ? (currentScope ? [where.page, currentScope] : [where.section, where.page]).filter(Boolean).join('، ') : null;
    const [sideMode, setSideMode] = useSideMode();
    const wideSide = sideMode === 'wide';
    const searchText = props.can?.recordPayments && props.can?.viewSubscriptions ? 'ابحث عن صفحة أو مشترك…' : 'ابحث عن صفحة أو أمر…';

    const { scrolled, clearTimers, closeMega, currentKey, geometry, highlightRef, hoverItem, itemRefs, leaveZone, litKey, megaRef, navRef, onMegaKeyDown, onSectionClick, onSectionKeyDown, openGroup, openId, panelRef, panels, pointerType, popover, setHoverKey, setPopover, still, togglePopover } = useMegaMenu({ current, groups, items, layerOpen, url });

    return (
        <>
            <header className={`tn-header ${scrolled ? 'is-scrolled' : ''}`} data-subnav={subnav ? true : undefined}>
                {/* With the bar hidden, resting the pointer on the screen's edge slides it back in. */}
                <div className="tn-side-edge" aria-hidden="true" />
                <aside className="tn-side" aria-label="الشريط الجانبي">
                    <Link href={HOME_LINK.href} prefetch={shouldPrefetchPage(HOME_LINK.href)} className="tn-side-logo" aria-label={`${companyName}، الصفحة الرئيسية`}>
                        <BrandLogo alt="" markSize={40} className="h-10 w-auto max-w-[56px] object-contain" />
                    </Link>
                    <Button data-raw="" variant="ghost"
                        className="tn-side-pin"
                        onClick={() => setSideMode(wideSide ? 'rail' : 'wide')}
                        aria-pressed={wideSide}
                        aria-label={wideSide ? 'إلغاء تثبيت الشريط الجانبي' : 'تثبيت الشريط الجانبي مفتوحًا'}
                        title={wideSide ? 'إلغاء التثبيت' : 'تثبيت الشريط مفتوحًا'}
                    >
                        <Icon name="thumbtack" />
                    </Button>
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
                                return [
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
                                        <span className="tn-section-label">{item.link.label}</span>
                                        {badges[item.link.href] > 0 && <span className="tn-badge" aria-hidden="true">{badges[item.link.href]}</span>}
                                    </Link>,
                                    index === 0 && items.length > 1 ? <span key="heading" className="tn-side-heading" aria-hidden="true">الأقسام</span> : null,
                                ];
                            }

                            const badge = badgeOf(item.group, badges);

                            return (
                                <Button data-raw="" variant="ghost"
                                    key={item.key}
                                    ref={register}
                                    className="tn-section"
                                    data-item={item.key}
                                    data-lit={litKey === item.key}
                                    data-current={isCurrent || undefined}
                                    data-tour={isCurrent ? 'current' : undefined}
                                    aria-expanded={openId === item.group.id}
                                    aria-controls="tn-mega"
                                    aria-current={isCurrent ? 'true' : undefined}
                                    title={`${item.group.label}، Alt+${index + 1}`}
                                    onPointerDown={(event) => { pointerType.current = event.pointerType; }}
                                    onClick={(event) => onSectionClick(event, item.group)}
                                    onKeyDown={(event) => onSectionKeyDown(event, item)}
                                >
                                    <Icon name={item.group.icon} className="tn-section-icon" />
                                    <span className="tn-section-short" aria-hidden="true">{item.group.shortLabel}</span>
                                    <span className="tn-section-full">{item.group.label}</span>
                                    {badge > 0 && (
                                        <>
                                            <span className="tn-badge" aria-hidden="true">{badge}</span>
                                            <span className="sr-only">، {badge} بانتظارك</span>
                                        </>
                                    )}
                                    {/* The section opens a menu of its pages (MegaMenu): its arrow points toward it, once the bar is open. */}
                                    <Icon name="chevron-left" className="tn-section-chev" />
                                </Button>
                            );
                        })}
                    </nav>

                    <div className="tn-side-foot">
                        <Link href="/profile" prefetch={shouldPrefetchPage('/profile')} className="tn-section" aria-current={url.startsWith('/profile') ? 'page' : undefined} data-current={url.startsWith('/profile') || undefined} title="الملف الشخصي">
                            <Icon name="user-circle" className="tn-section-icon" />
                            <span className="tn-section-label">الملف الشخصي</span>
                        </Link>
                        <LogoutForm>
                            <Button data-raw="" variant="ghost" type="submit" className="tn-section" title="تسجيل الخروج">
                                <Icon name="door" className="tn-section-icon" />
                                <span className="tn-section-label">خارج النظام</span>
                            </Button>
                        </LogoutForm>
                    </div>
                </aside>

                <div className="tn-bar">
                    <div className="tn-context flex min-w-0 items-center">
                        <Button data-raw="" variant="ghost"
                            className="tn-tool tn-side-mode tn-desktop-only"
                            onClick={() => setSideMode(NEXT_MODE[sideMode])}
                            aria-label={`وضع القائمة الجانبية: ${MODE_LABELS[sideMode]}، التالي ${MODE_LABELS[NEXT_MODE[sideMode]]}`}
                            title="وضع القائمة: موسّعة ← أيقونات ← مخفية"
                        >
                            <Icon name="layout-side" />
                        </Button>
                        <Link href={HOME_LINK.href} prefetch={shouldPrefetchPage(HOME_LINK.href)} className="tn-brand" data-tour="brand" aria-label={`${companyName}، ${branchLabel ?? tagline}، الصفحة الرئيسية`}>
                            <span className="tn-top-logo"><BrandLogo alt="" markSize={38} /></span>
                            <span className="tn-brand-divider" aria-hidden="true" />
                            <span className="tn-brand-text">
                                <span className="tn-brand-name" dir="auto">{companyName}</span>
                                <span className="tn-brand-branch" dir="auto">
                                    <span key={pageLabel ?? ''} className={`tn-brand-swap ${pageLabel ? 'is-page' : ''}`}>{pageLabel ?? branchLabel ?? tagline}</span>
                                </span>
                            </span>
                        </Link>
                        {where && <span key={where.page} className="tn-where" aria-hidden="true">{[where.page, where.scope].filter(Boolean).join('، ')}</span>}
                    </div>

                    <div className="tn-tools flex items-center gap-1">
                        {branchChip}
                        {props.can?.recordPayments && (
                            <Link href="/payments" prefetch={shouldPrefetchPage('/payments')} className="tn-pay" aria-keyshortcuts="N" title="تسجيل دفعة، N">
                                <Icon name="banknotes" />
                                تسجيل دفعة
                            </Link>
                        )}
                        {/* Named by the words it shows, so a voice command that says them reaches it, even when the narrow bar hides them. */}
                        <Button data-raw="" variant="ghost" className="tn-search" data-tour="search" onClick={onOpenPalette} aria-label={`${searchText} Ctrl K`} aria-keyshortcuts="Control+K" title="بحث وأوامر، Ctrl K">
                            <Icon name="search" />
                            <span className="tn-search-text flex-1 text-start">{searchText}</span>
                            <span className="tn-kbd" dir="ltr">Ctrl K</span>
                        </Button>
                        <QuickActionsMenu onPickSubscriber={onOpenPalette} />
                        <AppearanceMenu onShowShortcuts={onShowShortcuts} onStartTour={onStartTour} />
                        <ActivityBell open={popover === 'bell'} onToggle={() => togglePopover('bell')} onClose={() => setPopover(null)} />
                        <Button data-raw="" variant="ghost" className="tn-tool tn-mobile-only" data-tour="menu" onClick={onOpenDrawer} aria-label="القائمة" aria-expanded={drawerOpen}>
                            <Icon name="menu" />
                        </Button>
                    </div>
                    {subnav && <div className="tn-bar-tabs">{subnav}</div>}
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
