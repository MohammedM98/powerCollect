import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePage } from '@inertiajs/react';
import ActivityBell from '@/Components/ActivityBell';
import Icon from '@/Components/Icon';
import ThemeToggle from '@/Components/ThemeToggle';
import AccountMenu from './AccountMenu';
import { usePopover } from './usePopover';
import './top-bar.css';

function QuickActions({ actions, open, onToggle, onClose, onRun }) {
    const { anchorRef, popoverRef } = usePopover(open, onClose);
    if (!actions.length) {
        return null;
    }

    return (
        <>
            <button ref={anchorRef} type="button" className="gl-btn gl-quick-trigger" onClick={onToggle} aria-expanded={open} aria-haspopup="dialog" aria-label="إجراء سريع">
                <Icon name="plus" className="h-5 w-5 shrink-0" />
                <span>إجراء سريع</span>
                <Icon name="chevron-down" className="h-3.5 w-3.5 shrink-0" />
            </button>
            {open && createPortal(
                <div ref={popoverRef} dir="rtl" className="tn-popover w-[248px] p-2 text-gray-900" role="dialog" aria-label="إجراءات سريعة" data-top-bar-layer>
                    {actions.map((action) => (
                        <button key={action.id} type="button" className="tn-menu-item w-full" onClick={() => {
                            onClose();
                            anchorRef.current?.focus({ preventScroll: true });
                            onRun(action.id);
                        }}>
                            <Icon name={action.icon} />
                            {action.label}
                            <kbd className="tn-kbd ms-auto">{action.key}</kbd>
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </>
    );
}

export default function TopBar({ where, actions = [], onRunAction, onOpenPalette, onOpenDrawer, drawerOpen, layerOpen, onShowShortcuts, onStartTour, subnav = null, branchChip = null }) {
    const { props, url } = usePage();
    const user = props.auth?.user;
    const branchLabel = props.branchView ? props.branchView.current?.name ?? 'جميع الفروع' : user?.branchName;
    const searchText = props.can?.recordPayments && props.can?.viewSubscriptions ? 'ابحث عن صفحة أو مشترك…' : 'ابحث عن صفحة أو أمر…';
    const hour = new Date().getHours();
    const greeting = hour >= 5 && hour < 17 ? 'صباح الخير' : 'مساء الخير';
    const [openPopover, setOpenPopover] = useState(null);
    const [glass, setGlass] = useState(() => {
        try { return localStorage.getItem('powercollect-style') === 'glass'; } catch { return false; }
    });
    const popover = !layerOpen && openPopover?.url === url ? openPopover.name : null;
    const closePopover = () => setOpenPopover(null);
    const togglePopover = (name) => setOpenPopover(popover === name ? null : { name, url });

    useEffect(() => {
        document.documentElement.dataset.maStyle = glass ? 'glass' : 'classic';
    }, [glass]);

    function toggleGlass() {
        const next = !glass;
        setGlass(next);
        try { localStorage.setItem('powercollect-style', next ? 'glass' : 'classic'); } catch { /* Storage is optional. */ }
    }

    return (
        <header className="gl-shell-header" data-subnav={subnav ? true : undefined}>
            <div className="gl-topbar">
                <button type="button" className="tn-tool gl-mobile-menu" data-tour="menu" onClick={onOpenDrawer} aria-label="القائمة" aria-expanded={drawerOpen}>
                    <Icon name="menu" />
                </button>
                <div className="gl-top-greeting min-w-0">
                    <strong className="block truncate">{greeting}{user?.name && ' يا ' + user.name.trim().split(/\s+/)[0]}</strong>
                    <small className="block truncate text-gray-500">{(where ? [where.page, where.scope].filter(Boolean).join(' · ') : branchLabel) ?? 'منصّة الإدارة الموحّدة'}</small>
                </div>
                <div className="gl-top-branch">{branchChip}</div>
                <div className="gl-top-tools">
                    <button type="button" className="tn-search" data-tour="search" onClick={onOpenPalette} aria-label={searchText + ' Ctrl K'} aria-keyshortcuts="Control+K">
                        <Icon name="search" />
                        <span className="gl-top-search-text flex-1 text-start">{searchText}</span>
                        <span className="tn-kbd gl-top-search-key" dir="ltr">Ctrl K</span>
                    </button>
                    <QuickActions actions={actions} open={popover === 'quick'} onToggle={() => togglePopover('quick')} onClose={closePopover} onRun={onRunAction} />
                    <div className="gl-top-toggles">
                        <ActivityBell open={popover === 'bell'} onToggle={() => togglePopover('bell')} onClose={closePopover} />
                        <button type="button" className="tn-tool gl-style-toggle" aria-pressed={glass} aria-label="المظهر الزجاجي" title="المظهر الزجاجي" onClick={toggleGlass}><Icon name="layers" /></button>
                        <ThemeToggle className="tn-tool" />
                    </div>
                    <AccountMenu
                        open={popover === 'account'}
                        onToggle={() => togglePopover('account')}
                        onClose={closePopover}
                        onShowShortcuts={() => { closePopover(); onShowShortcuts(); }}
                        onStartTour={() => { closePopover(); onStartTour(); }}
                    />
                </div>
            </div>
            {subnav}
        </header>
    );
}
