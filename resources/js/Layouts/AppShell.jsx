import { createContext, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import TopBar from '@/Components/Layout/TopBar';
import { WorkingBranchSelect } from '@/Components/Layout/TopBarMenus';
import NavigationDrawer from '@/Components/Layout/NavigationDrawer';
import AppSidebar from '@/Components/Layout/AppSidebar';
import AppFooter from '@/Components/Layout/AppFooter';
import { handlePaletteShortcut, pageWindowOpen } from '@/Components/Layout/shortcuts';
import { useBrandDocument } from '@/hooks/useBrand';
import { useResponsiveTables } from '@/hooks/useResponsiveTables';
import { useTheme } from '@/hooks/useTheme';
import { HOME_LINK, MAIN_LINKS, allowedNavigationGroups, navigationGroups, pageTrail, sectionLinks } from '@/lib/navigation';
import { currentPrintSettings } from '@/lib/print';
import { QUICK_MESSAGE_EVENT, openQuickMessage } from '@/lib/quickMessage';
import { watchSessionStatus } from '@/lib/sessionStatus';

const CommandPalette = lazy(() => import('@/Components/Layout/CommandPalette'));
const TableExcelActions = lazy(() => import('@/Components/Excel/TableExcelActions'));
const KeyboardShortcuts = lazy(() => import('@/Components/Layout/KeyboardShortcuts'));
const QuickTour = lazy(() => import('@/Components/Layout/QuickTour'));
const QuickMessageModal = lazy(() => import('@/Pages/Messages/QuickMessageModal'));

export const loadingTool = <p role="status" className="fixed bottom-6 left-1/2 z-100 -translate-x-1/2 rounded-control border border-gray-200 bg-surface px-4 py-3 text-sm text-gray-600 shadow-card">جارٍ تحميل الأدوات…</p>;

export const NO_BADGES = {};

/** What the shell shares with the page inside it (AuthenticatedLayout): its trail, its print mode and where the page tells it its badges, scope and scroll. */
export const ShellContext = createContext(null);

/** Pages drawn without the signed-in frame: the sign-in, and the sheets made for printing. */
const STANDALONE_PAGES = new Set(['Auth/Login', 'CompanyForms/Print', 'Subscriptions/PaymentReceipt']);

let cachedBranchKey;

/** Whether the user is typing, so a single-key shortcut must not fire. */
function isTyping(target) {
    return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
}

/**
 * Every page's layout (app.jsx): a signed-in page sits in the shell, which
 * stays in place from one page to the next, so the top bar, the side bar and
 * their state are not drawn again on every visit. The sign-in page and the
 * printed sheets have no shell.
 */
export default function AppShell({ children }) {
    const { component, props } = usePage();

    return props.auth?.user && !STANDALONE_PAGES.has(component) ? <Shell>{children}</Shell> : children;
}

/**
 * Signed-in pages keep the sections in a desktop dock, the tools and section
 * tabs in the top bar, then the page's trail and content (AuthenticatedLayout).
 * Phones open the sections from the menu button. The page tells the shell
 * its `badges` (what waits on a page, by its link: { '/payments/summary': 2 }),
 * its `scope` (the branch, or "جميع الفروع", whose figures it shows: the bar
 * keeps it beside the page's name once the title has scrolled away) and
 * whether its title has scrolled away.
 */
export function Shell({ children }) {
    const { props, url, component } = usePage();
    const { can } = props;
    const pathname = new URL(url, window.location.origin).pathname;
    const branchKey = `${props.auth?.user?.username ?? ''}:${props.branchView?.current?.id ?? 'all'}`;
    useEffect(() => {
        if (cachedBranchKey !== branchKey) {
            router.flushAll();
            cachedBranchKey = branchKey;
        }
    }, [branchKey]);
    const { dark, changePreference } = useTheme();
    // Keeps the document drawn in the company's identity (design attributes, colours, icon).
    useBrandDocument();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [tourOpen, setTourOpen] = useState(false);
    // The quick message window, with the subscriptions it was opened for (see lib/quickMessage.js); null when closed.
    const [quickMessage, setQuickMessage] = useState(null);
    // What the page inside says about itself (AuthenticatedLayout).
    const [page, setPage] = useState(null);
    const [pastTitle, setPastTitle] = useState(false);
    const printSettings = useMemo(() => currentPrintSettings(new URL(url, window.location.origin).search), [url]);
    useEffect(() => watchSessionStatus(() => window.location.replace('/login')), []);
    const menuButtonRef = useRef(null);
    useResponsiveTables();

    const badges = page?.badges ?? NO_BADGES;
    const scope = page?.scope ?? null;
    const groups = useMemo(() => navigationGroups(can), [can]);
    const trail = useMemo(() => pageTrail(groups, url), [groups, url]);
    const hasSectionPages = sectionLinks(trail?.group).length > 0;
    const searchesSubscribers = Boolean(can?.recordPayments && can?.viewSubscriptions);
    const anyLayerOpen = drawerOpen || paletteOpen || shortcutsOpen || tourOpen;

    const paletteSections = [[HOME_LINK.label, [MAIN_LINKS[0]]], ...allowedNavigationGroups(can).map((group) => [group.label, group.links])];
    const commands = [
        ...(can?.recordPayments ? [{ id: 'pay', label: 'تسجيل دفعة', icon: 'banknotes', key: 'N' }] : []),
        ...(can?.sendMessages ? [{ id: 'message', label: 'رسالة سريعة لمشترك أو أكثر', icon: 'send', key: 'M' }] : []),
        { id: 'theme', label: 'تبديل الوضع الفاتح والداكن', icon: dark ? 'sun' : 'moon' },
        { id: 'tour', label: 'جولة سريعة في الشريط', icon: 'sparkles' },
        { id: 'keys', label: 'اختصارات لوحة المفاتيح', icon: 'keyboard', key: '?' },
    ];

    // The search replaces whatever else is open, as one layer at a time.
    const onPaletteOpenChange = useCallback((open) => {
        if (open) {
            setDrawerOpen(false);
            setShortcutsOpen(false);
            setTourOpen(false);
        }

        setPaletteOpen(open);
    }, []);

    const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);
    const closeTour = useCallback(() => setTourOpen(false), []);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);

    // Another page closes what was open over the last one, as when each page drew its own frame.
    const shownPage = useRef(`${component}:${pathname}`);
    useEffect(() => {
        if (shownPage.current === `${component}:${pathname}`) {
            return;
        }
        shownPage.current = `${component}:${pathname}`;
        setDrawerOpen(false);
        setPaletteOpen(false);
        setShortcutsOpen(false);
        setTourOpen(false);
        setQuickMessage(null);
    }, [component, pathname]);

    function runCommand(id) {
        if (id === 'pay') {
            router.visit('/payments');
        } else if (id === 'message') {
            openQuickMessage();
        } else if (id === 'theme') {
            changePreference(dark ? 'light' : 'dark');
        } else if (id === 'tour') {
            setTourOpen(true);
        } else if (id === 'keys') {
            setShortcutsOpen(true);
        }
    }

    // From any page: / opens the search, ? the keys, N the payment page. Listened on the window, after the page's own
    // keys: a page that uses one of them (a table's / to its search) keeps it, and nothing fires over a page's window.
    useEffect(() => {
        function onKeyDown(event) {
            if (handlePaletteShortcut(event, paletteOpen, onPaletteOpenChange)) {
                return;
            }
            if (event.defaultPrevented || isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey || anyLayerOpen || pageWindowOpen()) {
                return;
            }

            if (event.key === '?' || event.key === '؟' || (event.code === 'Slash' && event.shiftKey)) {
                event.preventDefault();
                setShortcutsOpen(true);
            } else if (event.key === '/' || event.code === 'Slash') {
                event.preventDefault();
                setPaletteOpen(true);
            } else if (can?.recordPayments && (event.key === 'n' || event.key === 'N' || event.code === 'KeyN')) {
                event.preventDefault();
                router.visit('/payments');
            } else if (can?.sendMessages && (event.key === 'm' || event.key === 'M' || event.code === 'KeyM')) {
                event.preventDefault();
                openQuickMessage();
            }
        }

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [anyLayerOpen, paletteOpen, onPaletteOpenChange, can?.recordPayments, can?.sendMessages]);

    // Any page opens the quick message window through openQuickMessage().
    useEffect(() => {
        if (!can?.sendMessages) {
            return undefined;
        }

        function onOpen(event) {
            setPaletteOpen(false);
            setQuickMessage({ subscriptionIds: event.detail?.subscriptionIds ?? [], selection: event.detail?.selection ?? null, openedAt: Date.now() });
        }

        window.addEventListener(QUICK_MESSAGE_EVENT, onOpen);

        return () => window.removeEventListener(QUICK_MESSAGE_EVENT, onOpen);
    }, [can?.sendMessages]);

    // The phone menu is for narrow screens only.
    useEffect(() => {
        const media = window.matchMedia('(min-width: 1024px)');
        const onChange = () => media.matches && setDrawerOpen(false);

        media.addEventListener('change', onChange);

        return () => media.removeEventListener('change', onChange);
    }, []);

    const context = useMemo(() => ({ trail, hasSectionPages, url, printSettings, setPage, setPastTitle }), [trail, hasSectionPages, url, printSettings]);

    // Opened from a table's print button: the page without the menus (see lib/print.js and AuthenticatedLayout).
    if (printSettings) {
        return <ShellContext.Provider value={context}>{children}</ShellContext.Provider>;
    }

    return (
        <ShellContext.Provider value={context}>
            <div className="tn-shell min-h-screen text-gray-900">
                <div className="tn-backdrop" aria-hidden="true" />
                <a href="#main-content" className="fixed inset-s-4 -top-24 z-100 rounded-xl bg-surface px-4 py-3 font-semibold tn-lift focus:top-3">
                    تخطي إلى المحتوى
                </a>
                <AppSidebar groups={groups} badges={badges} />
                <TopBar
                    branchChip={<WorkingBranchSelect />}
                    badges={badges}
                    where={pastTitle && trail ? { section: trail.group?.shortLabel, page: trail.link.label, scope } : null}
                    drawerOpen={drawerOpen}
                    layerOpen={anyLayerOpen}
                    onOpenPalette={() => onPaletteOpenChange(true)}
                    onOpenDrawer={(event) => {
                        menuButtonRef.current = event.currentTarget;
                        setDrawerOpen(true);
                    }}
                    onShowShortcuts={() => setShortcutsOpen(true)}
                    onStartTour={() => setTourOpen(true)}
                />

                <div className="tn-content">
                    <main id="main-content" tabIndex={-1} className="mx-auto max-w-(--ui-content-width) px-(--tn-gutter) pb-8 pt-6 outline-hidden">
                        {children}
                    </main>
                    <AppFooter />
                </div>

                <NavigationDrawer
                    open={drawerOpen}
                    groups={groups}
                    badges={badges}
                    onClose={closeDrawer}
                    onOpenPalette={() => onPaletteOpenChange(true)}
                    returnFocusTo={menuButtonRef}
                />
                {/* Mounted on every page: loads quietly, apart from the windows below, so no notice flashes as a page opens. */}
                <Suspense fallback={null}>
                    <TableExcelActions />
                </Suspense>
                <Suspense fallback={loadingTool}>
                    {paletteOpen && <CommandPalette
                        open={paletteOpen}
                        onOpenChange={onPaletteOpenChange}
                        sections={paletteSections}
                        commands={commands}
                        onCommand={runCommand}
                        searchSubscribers={searchesSubscribers}
                    />}
                    {shortcutsOpen && <KeyboardShortcuts
                        open={shortcutsOpen}
                        onClose={closeShortcuts}
                        canRecordPayments={Boolean(can?.recordPayments)}
                        canSendMessages={Boolean(can?.sendMessages)}
                        searchesSubscribers={searchesSubscribers}
                    />}
                    {quickMessage && (
                        <QuickMessageModal key={quickMessage.openedAt} subscriptionIds={quickMessage.subscriptionIds} selection={quickMessage.selection} onClose={() => setQuickMessage(null)} />
                    )}
                    {tourOpen && <QuickTour open={tourOpen} onClose={closeTour} searchesSubscribers={searchesSubscribers} />}
                </Suspense>
            </div>
        </ShellContext.Provider>
    );
}
