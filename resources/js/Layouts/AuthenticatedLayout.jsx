import { lazy, Suspense, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import TopBar from '@/Components/TopBar/TopBar';
import BranchViewSwitcher, { WorkingBranchChip } from '@/Components/BranchViewSwitcher';
import Sidebar from '@/Components/TopBar/Sidebar';
import NavigationDrawer from '@/Components/TopBar/NavigationDrawer';
import { useBrandDocument } from '@/hooks/useBrand';
import { Breadcrumb, SectionPages } from '@/Components/TopBar/PageTrail';
import { handlePaletteShortcut, pageWindowOpen } from '@/Components/TopBar/shortcuts';
import { useTheme } from '@/hooks/useTheme';
import { currentPrintSettings } from '@/lib/print';
import AppFooter from '@/Components/AppFooter';
import { watchSessionStatus } from '@/lib/sessionStatus';
import { HOME_LINK, MAIN_LINKS, allowedNavigationGroups, navigationGroups, pageTrail, sectionLinks } from '@/lib/navigation';
import { useResponsiveTables } from '@/hooks/useResponsiveTables';
import { notify } from '@/lib/notify';
import { QUICK_MESSAGE_EVENT, openQuickMessage } from '@/lib/quickMessage';
const QuickPaymentSearch = lazy(() => import('@/Pages/Dashboard/QuickPaymentSearch'));
const PaymentModal = lazy(() => import('@/Pages/Subscriptions/PaymentModal'));
const SubscriptionModal = lazy(() => import('@/Pages/Subscriptions/SubscriptionModal'));
const MeterBoxModal = lazy(() => import('@/Pages/MeterBoxes/MeterBoxModal'));
const CommandPalette = lazy(() => import('@/Components/CommandPalette'));
const PrintDesigner = lazy(() => import('@/Components/Print/PrintDesigner'));
const TableExcelDesigner = lazy(() => import('@/Components/TableExcelDesigner'));
const TableExcelActions = lazy(() => import('@/Components/TableExcelActions'));
const KeyboardShortcuts = lazy(() => import('@/Components/TopBar/KeyboardShortcuts'));
const QuickTour = lazy(() => import('@/Components/TopBar/QuickTour'));
const QuickMessageModal = lazy(() => import('@/Pages/Messages/QuickMessageModal'));

const loadingTool = <p role="status" className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-control border border-gray-200 bg-surface px-4 py-3 text-sm text-gray-600 shadow-card">جارٍ تحميل الأدوات…</p>;

const NO_BADGES = {};
const SECTION_ACTIONS = { daily: 'subscriber', infrastructure: 'board', finance: 'pay', readings: 'reading' };
const ACTION_OPTION_PROPS = { pay: 'quickPaymentOptions', subscriber: 'quickSubscriptionOptions', board: 'quickMeterBoxOptions' };

function savedNavigation(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
}

function saveNavigation(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
}


// The first page of a visit to the app keeps the browser's own focus; later pages put it on their content.
let openedOnce = false;
let cachedBranchKey;

// How far down the bar reaches (with the section's pages under it), so content under it counts as scrolled away.
const BAR_CLEARANCE = 90;
const BAR_WITH_PAGES_CLEARANCE = 150;

/** Whether the user is typing, so a single-key shortcut must not fire. */
function isTyping(target) {
    return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
}

/**
 * Signed-in pages keep the sections in a desktop dock, the tools and section
 * tabs in the top bar, then the page's trail and content. Phones open the
 * sections from the menu button.
 * `badges` counts what waits on a page, by its link: { '/payments/summary': 2 }.
 * `scope` names the branch (or "جميع الفروع") whose figures the page shows;
 * the bar keeps it beside the page's name once the title has scrolled away.
 */
export default function AuthenticatedLayout({ header, badges = NO_BADGES, scope = null, children, beforePrint }) {
    const { props, url } = usePage();
    const { can } = props;
    const branchKey = `${props.auth?.user?.username ?? ''}:${props.branchView?.current?.id ?? 'all'}`;
    useEffect(() => {
        if (cachedBranchKey !== branchKey) {
            router.flushAll();
            cachedBranchKey = branchKey;
        }
    }, [branchKey]);
    const { dark, changePreference } = useTheme();
    // Keeps the document drawn in the company's identity (design attributes, colours, icon).
    const brand = useBrandDocument();
    const [collapsed, setCollapsed] = useState(() => savedNavigation('powercollect-sidebar-collapsed', false) === true);
    const [quickAction, setQuickAction] = useState(null);
    const [loadingAction, setLoadingAction] = useState(false);
    const [payer, setPayer] = useState(null);
    const lastPagesKey = 'powercollect-section-pages:' + (props.auth?.user?.username ?? '');
    const lastPages = savedNavigation(lastPagesKey, {});
    const closeQuickAction = () => { setQuickAction(null); setPayer(null); };
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [tourOpen, setTourOpen] = useState(false);
    // The quick message window, with the subscriptions it was opened for (see lib/quickMessage.js); null when closed.
    const [quickMessage, setQuickMessage] = useState(null);
    const printSettings = useMemo(() => currentPrintSettings(new URL(url, window.location.origin).search), [url]);
    useEffect(() => watchSessionStatus(() => window.location.replace('/login')), []);
    const menuButtonRef = useRef(null);
    const titleEndRef = useRef(null);
    const [pastTitle, setPastTitle] = useState(false);
    useResponsiveTables();

    const groups = navigationGroups(can);
    const trail = pageTrail(groups, url);
    const activeGroupId = trail?.group?.id ?? (trail?.link.href === HOME_LINK.href ? 'home' : null);
    const lastPage = trail?.exact ? trail.link.href : null;
    useEffect(() => {
        if (activeGroupId && activeGroupId !== 'home' && lastPage) {
            saveNavigation(lastPagesKey, { ...savedNavigation(lastPagesKey, {}), [activeGroupId]: lastPage });
        }
    }, [lastPagesKey, activeGroupId, lastPage]);

    const hasSectionPages = sectionLinks(trail?.group).length > 0;
    const barClearance = hasSectionPages ? BAR_WITH_PAGES_CLEARANCE : BAR_CLEARANCE;
    const searchesSubscribers = Boolean(can?.recordPayments && can?.viewSubscriptions);
    const anyLayerOpen = drawerOpen || paletteOpen || shortcutsOpen || tourOpen || Boolean(quickAction) || loadingAction;

    const paletteSections = [[HOME_LINK.label, [MAIN_LINKS[0]]], ...allowedNavigationGroups(can).map((group) => [group.label, group.links])];
    const quickActions = [
        can?.recordPayments && { id: 'pay', label: 'تسجيل دفعة', icon: 'banknotes', key: 'P' },
        can?.createSubscription && { id: 'subscriber', label: 'إضافة مشترك', icon: 'user', key: 'N' },
        can?.viewMeterReadings && { id: 'reading', label: 'فتح القراءات', icon: 'gauge', key: 'R' },
        can?.createMeterBox && { id: 'board', label: 'طبلون جديد', icon: 'table', key: 'B' },
    ].filter(Boolean);
    const currentAction = quickActions.find((action) => action.id === SECTION_ACTIONS[activeGroupId]);
    const commands = [
        ...quickActions,
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

    function runCommand(id) {
        const optionsProp = ACTION_OPTION_PROPS[id];
        if (optionsProp) {
            if (props[optionsProp]) {
                setQuickAction({ id, options: props[optionsProp] });
                return;
            }
            setLoadingAction(true);
            router.reload({
                only: [optionsProp],
                onSuccess: (page) => {
                    if (page.props[optionsProp]) setQuickAction({ id, options: page.props[optionsProp] });
                    else notify('تعذّر فتح الإجراء.', 'warning');
                },
                onFinish: () => setLoadingAction(false),
            });
        } else if (id === 'reading') {
            router.visit('/meter-readings');
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

    const handleShortcuts = useEffectEvent((event) => {
        if (handlePaletteShortcut(event, paletteOpen, onPaletteOpenChange)) return;
        if (event.defaultPrevented || isTyping(event.target) || event.ctrlKey || event.metaKey || anyLayerOpen || pageWindowOpen()) return;
        if (event.altKey) {
            const sectionNumber = /^[0-9]$/.test(event.key) ? event.key : null;
            const link = sectionNumber && document.querySelector('.gl-sidebar [data-section-index="' + sectionNumber + '"]');
            if (link && link.getClientRects().length) {
                event.preventDefault();
                link.click();
            }
            return;
        }
        if (event.key === '?' || event.key === '؟' || (event.code === 'Slash' && event.shiftKey)) {
            event.preventDefault();
            setShortcutsOpen(true);
        } else if (event.key === '/' || event.code === 'Slash') {
            event.preventDefault();
            setPaletteOpen(true);
        } else {
            const action = commands.find(({ key }) => /^[A-Z]$/.test(key ?? '') && (event.code === 'Key' + key || event.key.toUpperCase() === key));
            if (action && !event.repeat) {
                event.preventDefault();
                runCommand(action.id);
            }
        }
    });

    useEffect(() => {
        const listener = (event) => handleShortcuts(event);
        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    }, []);

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

    // After opening a page from the bar, the search or a link, focus lands on its content, not at the top of the document.
    useEffect(() => {
        if (openedOnce && (!document.activeElement || document.activeElement === document.body)) {
            document.getElementById('main-content')?.focus({ preventScroll: true });
        }

        openedOnce = true;
    }, []);

    // Whether the page's title has scrolled up under the bar.
    useEffect(() => {
        const marker = titleEndRef.current;

        if (!marker) {
            return undefined;
        }

        const observer = new IntersectionObserver(([entry]) => setPastTitle(!entry.isIntersecting && entry.boundingClientRect.top < barClearance), {
            rootMargin: `-${barClearance}px 0px 0px 0px`,
        });
        observer.observe(marker);

        return () => observer.disconnect();
    }, [barClearance]);

    // The phone menu is for narrow screens only.
    useEffect(() => {
        const media = window.matchMedia('(min-width: 900px)');
        const onChange = () => media.matches && setDrawerOpen(false);

        media.addEventListener('change', onChange);

        return () => media.removeEventListener('change', onChange);
    }, []);

    // Opened from a table's print button: the page without the menus (see lib/print.js).
    if (printSettings) {
        if (new URL(url, window.location.origin).searchParams.get('excel') === '1') {
            return <Suspense fallback={loadingTool}><TableExcelDesigner settings={printSettings}>{children}</TableExcelDesigner></Suspense>;
        }
        return <Suspense fallback={loadingTool}><PrintDesigner settings={printSettings} beforePrint={beforePrint}>{children}</PrintDesigner></Suspense>;
    }

    return (
        <div className="tn-shell gl-app-shell min-h-screen text-gray-900" data-sidebar-collapsed={collapsed || undefined}>
            <div className="tn-backdrop" aria-hidden="true" />
            <a href="#main-content" className="fixed start-4 -top-24 z-[100] rounded-xl bg-surface px-4 py-3 font-semibold tn-lift focus:top-3">
                تخطي إلى المحتوى
            </a>

            <Sidebar
                brand={brand}
                groups={groups}
                currentId={activeGroupId}
                lastPages={lastPages}
                badges={badges}
                collapsed={collapsed}
                onCollapse={() => {
                    setCollapsed(!collapsed);
                    saveNavigation('powercollect-sidebar-collapsed', !collapsed);
                }}
                onHelp={() => setTourOpen(true)}
            />
            <div className="gl-shell-content min-w-0" inert={drawerOpen || undefined}>
                <TopBar
                    actions={quickActions}
                    onRunAction={runCommand}
                    subnav={hasSectionPages ? <SectionPages trail={trail} url={url} badges={badges} action={currentAction} onAction={runCommand} /> : null}
                    branchChip={<WorkingBranchChip />}
                    where={pastTitle && trail ? { page: trail.link.label, scope } : null}
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

                <div>
                    <main id="main-content" tabIndex={-1} className="mx-auto max-w-[var(--ui-content-width)] px-[var(--tn-gutter)] pb-12 pt-5 outline-none">
                        <BranchViewSwitcher />
                        <span className="sr-only" aria-live="polite">{trail?.link.label}</span>
                        {!trail?.group && trail?.link.href !== HOME_LINK.href && <Breadcrumb trail={trail} />}
                        {header && <div className="gl-page-head rise-in mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">{header}</div>}
                        <div ref={titleEndRef} aria-hidden="true" />
                        {children}
                    </main>
                    <AppFooter />
                </div>
            </div>

            <NavigationDrawer
                open={drawerOpen}
                brand={brand}
                currentId={activeGroupId}
                lastPages={lastPages}
                onHelp={() => setTourOpen(true)}
                groups={groups}
                badges={badges}
                onClose={closeDrawer}
                onOpenPalette={() => onPaletteOpenChange(true)}
                returnFocusTo={menuButtonRef}
            />
            {loadingAction && loadingTool}
            <Suspense fallback={loadingTool}>
                {quickAction?.id === 'pay' && (payer
                    ? <PaymentModal key={payer.id} show onClose={closeQuickAction} onAnotherPayment={() => setPayer(null)} subscription={payer} balance={payer.balance} {...quickAction.options} />
                    : <QuickPaymentSearch show onClose={closeQuickAction} onPick={setPayer} />
                )}
                {quickAction?.id === 'subscriber' && <SubscriptionModal show onClose={closeQuickAction} subscription={null} {...quickAction.options}
                    visitOptions={activeGroupId === 'home' ? { headers: { 'X-Return-To': url } } : undefined} />}
                {quickAction?.id === 'board' && <MeterBoxModal show onClose={closeQuickAction} meterBox={null} {...quickAction.options} />}

                <TableExcelActions />
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
                    actions={quickActions}
                    canSendMessages={Boolean(can?.sendMessages)}
                    searchesSubscribers={searchesSubscribers}
                />}
                {quickMessage && (
                    <QuickMessageModal key={quickMessage.openedAt} subscriptionIds={quickMessage.subscriptionIds} selection={quickMessage.selection} onClose={() => setQuickMessage(null)} />
                )}
                {tourOpen && <QuickTour open={tourOpen} onClose={closeTour} searchesSubscribers={searchesSubscribers} />}
            </Suspense>
        </div>
    );
}
