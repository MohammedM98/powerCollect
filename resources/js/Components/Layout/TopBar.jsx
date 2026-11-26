import { Button } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import Icon from '@/Components/UI/Icon';
import BrandLogo from '@/Components/BrandLogo';
import ActivityBell from '@/Components/Layout/ActivityBell';
import { useBrand } from '@/hooks/useBrand';
import { shouldPrefetchPage, HOME_LINK } from '@/lib/navigation';
import { AppearanceMenu, QuickActionsMenu } from './TopBarMenus';
import './top-bar.css';

/**
 * The bar's own state: whether the page has scrolled (the bar slims) and
 * which of its small menus is open (`popover`). A window over the page, a
 * new page, a new width or scrolling away closes the menu.
 */
function useTopBarState({ layerOpen, url }) {
    const [scrolled, setScrolled] = useState(false);
    const [popover, setPopover] = useState(null);
    const popoverY = useRef(0);
    const openPopover = useRef(null);
    openPopover.current = popover;

    useEffect(() => {
        if (layerOpen) {
            setPopover(null);
        }
    }, [layerOpen]);

    useEffect(() => {
        setPopover(null);
    }, [url]);

    useEffect(() => {
        function onScroll() {
            const y = window.scrollY;
            // Two edges, so a page resting near one cannot flip the bar back and forth.
            setScrolled((wasScrolled) => (wasScrolled ? y > 4 : y > 24));

            if (openPopover.current && Math.abs(y - popoverY.current) > 24) {
                setPopover(null);
            }
        }

        let lastWidth = window.innerWidth;
        function onResize() {
            if (window.innerWidth !== lastWidth) {
                lastWidth = window.innerWidth;
                setPopover(null);
            }
        }

        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);

        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    function togglePopover(kind) {
        popoverY.current = window.scrollY;
        setPopover((open) => (open === kind ? null : kind));
    }

    return { scrolled, popover, setPopover, togglePopover };
}

/**
 * The top bar: the working branch, search, theme, activity and account, with
 * the menu button on phones; the sections live in the side bar
 * (AppSidebar). The open section's pages (`subnav`) sit as tabs on a second
 * row directly under it, in the same bar. Once the page's title has scrolled
 * away, `where` ({ section, page, scope? }) takes the branch's place under
 * the name, and the page's name sits beside the logo on phones, so the user
 * still sees where they are — and, with `scope`, whose figures they read.
 * Wide screens show the working branch (`branchChip`) among the tools.
 */
export default function TopBar({ where, onOpenPalette, onOpenDrawer, drawerOpen, layerOpen, onShowShortcuts, onStartTour, subnav = null, branchChip = null }) {
    const { props, url } = usePage();
    const { name: companyName, tagline } = useBrand();
    const user = props.auth?.user;
    const branchLabel = props.branchView ? props.branchView.current?.name ?? 'جميع الفروع' : user?.branchName;
    const currentScope = props.branchView?.current ? branchLabel : where?.scope;
    const pageLabel = where ? (currentScope ? [where.page, currentScope] : [where.section, where.page]).filter(Boolean).join('، ') : null;
    const searchText = props.can?.recordPayments && props.can?.viewSubscriptions ? 'ابحث عن صفحة أو مشترك…' : 'ابحث عن صفحة أو أمر…';

    const { scrolled, popover, setPopover, togglePopover } = useTopBarState({ layerOpen, url });

    return (
        <header className={`tn-header ${scrolled ? 'is-scrolled' : ''}`} data-subnav={subnav ? true : undefined}>
                <div className="tn-bar">
                    <div className="tn-context flex min-w-0 items-center">
                        <Link href={HOME_LINK.href} prefetch={shouldPrefetchPage(HOME_LINK.href)} className="tn-brand" data-tour="brand" aria-label={`${companyName}، ${branchLabel ?? tagline}، الصفحة الرئيسية`}>
                            <span className="tn-top-logo"><BrandLogo alt="" /></span>
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
    );
}
