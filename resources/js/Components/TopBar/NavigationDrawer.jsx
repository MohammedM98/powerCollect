import { Button } from '@heroui/react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import BrandLogo from '@/Components/BrandLogo';
import { useBrand } from '@/hooks/useBrand';
import { currentGroup } from '@/lib/navigation';
import NavigationMenu, { NavigationAccount } from './NavigationMenu';

/**
 * The menu on phones and narrow screens: the same sections as the bar, the
 * current one open, a search, and the account with the appearance below.
 * It slides in from the side and back out when closed.
 */
export default function NavigationDrawer({ open, groups, badges, onClose, onOpenPalette, returnFocusTo }) {
    const { props, url } = usePage();
    const { name: companyName, tagline } = useBrand();
    const user = props.auth?.user;
    const current = currentGroup(groups, url);
    const [shown, setShown] = useState(open);
    const [closing, setClosing] = useState(false);
    const [expanded, setExpanded] = useState(current?.id ?? null);
    const panelRef = useRef(null);

    const [wasOpen, setWasOpen] = useState(open);

    // Opening shows the drawer with the current section expanded; closing plays the slide-out first.
    if (open !== wasOpen) {
        setWasOpen(open);

        if (open) {
            setShown(true);
            setClosing(false);
            setExpanded(current?.id ?? null);
        } else if (shown) {
            setClosing(true);
        }
    }

    useEffect(() => {
        if (!closing) {
            return undefined;
        }

        const timer = setTimeout(() => {
            setShown(false);
            setClosing(false);
        }, 230);

        return () => clearTimeout(timer);
    }, [closing]);

    // While open the page behind stays still; closing returns to the menu button.
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const menuButton = returnFocusTo?.current;
        document.documentElement.classList.add('tn-locked');
        requestAnimationFrame(() => panelRef.current?.querySelector('button')?.focus());

        return () => {
            document.documentElement.classList.remove('tn-locked');
            menuButton?.focus();
        };
    }, [open, returnFocusTo]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        function onKeyDown(event) {
            if (event.key === 'Escape') {
                onClose();
            } else if (event.key === 'Tab') {
                const focusable = [...panelRef.current.querySelectorAll('button, a[href], input')].filter((element) => element.offsetParent);

                if (!focusable.length) {
                    return;
                }

                if (event.shiftKey && document.activeElement === focusable[0]) {
                    event.preventDefault();
                    focusable.at(-1).focus();
                } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
                    event.preventDefault();
                    focusable[0].focus();
                }
            }
        }

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    const closeAfterVisit = useEffectEvent(() => {
        if (open) {
            onClose();
        }
    });

    // A page opened from the menu closes it.
    useEffect(() => {
        closeAfterVisit();
    }, [url]);

    if (!open && !shown) {
        return null;
    }

    return createPortal(
        <div className={`tn-drawer ${closing ? 'is-closing' : ''}`} dir="rtl">
            <div className="tn-scrim" role="presentation" onClick={onClose} />
            <aside ref={panelRef} className="tn-drawer-panel text-gray-900" role="dialog" aria-modal="true" data-top-bar-layer aria-label="قائمة التنقل">
                <div className="flex items-center gap-2 border-b border-gray-200/70 p-3">
                    <BrandLogo alt="" className="h-9 w-auto" />
                    <span className="min-w-0 flex-1">
                        <b dir="auto" className="block text-[16px]">{companyName}</b>
                        <small dir="auto" className="block text-[12.5px] text-gray-500">{user?.branchName ?? tagline}</small>
                    </span>
                    <Button data-raw="" variant="ghost" className="tn-tool" onClick={onClose} aria-label="إغلاق القائمة"><Icon name="close" /></Button>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    <NavigationMenu groups={groups} badges={badges} expanded={expanded} onExpandedChange={setExpanded} onOpenPalette={onOpenPalette} />
                </div>

                <div className="border-t border-gray-200/70 p-3">
                    <NavigationAccount />
                </div>
            </aside>
        </div>,
        document.body,
    );
}
