import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import { SidebarBrand, SidebarFooter, SidebarLinks } from './Sidebar';

export default function NavigationDrawer({ open, brand, onClose, onOpenPalette, onHelp, returnFocusTo, ...navigation }) {
    const { url } = usePage();
    const closeRef = useRef(null);
    const panelRef = useRef(null);
    const [retained, setRetained] = useState(open);
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) setRetained(true);
    }

    useLayoutEffect(() => {
        if (!open) return undefined;
        document.documentElement.classList.add('tn-locked');
        closeRef.current?.focus();
        return () => {
            document.documentElement.classList.remove('tn-locked');
        };
    }, [open]);

    useEffect(() => {
        if (open || !retained) return undefined;
        const opener = returnFocusTo?.current;
        const frame = requestAnimationFrame(() => {
            if (document.activeElement === document.body || panelRef.current?.contains(document.activeElement)) {
                opener?.focus({ preventScroll: true });
            }
        });
        const timer = window.setTimeout(() => setRetained(false), 230);
        return () => {
            cancelAnimationFrame(frame);
            window.clearTimeout(timer);
        };
    }, [open, retained, returnFocusTo]);

    const closeAfterVisit = useEffectEvent(() => {
        if (open) onClose();
    });

    useEffect(() => {
        closeAfterVisit();
    }, [url]);

    function onKeyDown(event) {
        if (event.key === 'Escape') onClose();
        if (event.key !== 'Tab') return;

        const controls = [...panelRef.current.querySelectorAll('a[href], button:not(:disabled)')].filter((item) => item.getClientRects().length);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
        }
    }

    if (!open && !retained) return null;

    return createPortal(
        <div className={'tn-drawer gl-mobile-drawer ' + (!open ? 'is-closing' : '')} dir="rtl" inert={!open} aria-hidden={!open || undefined}>
            <div className="tn-scrim" role="presentation" onClick={onClose} />
            {/* The dialog handles Escape and keeps the focus loop inside the drawer. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <aside ref={panelRef} className="tn-drawer-panel gl-sidebar-surface text-gray-900" role="dialog" aria-modal="true" data-top-bar-layer aria-label="قائمة التنقل" onKeyDown={onKeyDown}>
                <div className="flex items-center justify-between gap-2">
                    <SidebarBrand brand={brand} onNavigate={onClose} />
                    <button ref={closeRef} type="button" className="tn-tool" onClick={onClose} aria-label="إغلاق القائمة"><Icon name="close" /></button>
                </div>
                <button type="button" className="gl-btn gl-sec justify-start" onClick={onOpenPalette}><Icon name="search" />البحث في النظام</button>
                <SidebarLinks {...navigation} onNavigate={(event) => {
                    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) onClose();
                }} />
                <SidebarFooter onHelp={() => { onClose(); onHelp(); }} />
            </aside>
        </div>,
        document.body,
    );
}
