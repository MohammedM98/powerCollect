import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import BrandLogo from '@/Components/BrandLogo';
import { currentGroup } from '@/lib/navigation';
import NavigationMenu, { NavigationAccount } from './NavigationMenu';
import { shortAppName } from './TopBar';

/**
 * The menu on phones and narrow screens: the same sections as the bar, the
 * current one open, a search, and the account with the appearance below.
 * It slides in from the side and back out when closed.
 */
export default function NavigationDrawer({ open, groups, badges, onClose, onOpenPalette, returnFocusTo }) {
    const { props, url } = usePage();
    const { appName, auth } = props;
    const user = auth?.user;
    const current = currentGroup(groups, url);
    const [shown, setShown] = useState(open);
    const [closing, setClosing] = useState(false);
    const [expanded, setExpanded] = useState(current?.id ?? null);
    const panelRef = useRef(null);

    useEffect(() => {
        if (open) {
            setShown(true);
            setClosing(false);
            setExpanded(currentGroup(groups, url)?.id ?? null);

            return undefined;
        }

        if (!shown) {
            return undefined;
        }

        setClosing(true);
        const timer = setTimeout(() => {
            setShown(false);
            setClosing(false);
        }, 230);

        return () => clearTimeout(timer);
    }, [open]);

    // While open the page behind stays still; closing returns to the menu button.
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        document.documentElement.classList.add('tn-locked');
        requestAnimationFrame(() => panelRef.current?.querySelector('button')?.focus());

        return () => {
            document.documentElement.classList.remove('tn-locked');
            returnFocusTo?.current?.focus();
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

    // A page opened from the menu closes it.
    useEffect(() => {
        if (open) {
            onClose();
        }
    }, [url]);

    if (!open && !shown) {
        return null;
    }

    return createPortal(
        <div className={`tn-drawer ${closing ? 'is-closing' : ''}`} dir="rtl">
            <div className="tn-scrim" onClick={onClose} />
            <aside ref={panelRef} className="tn-drawer-panel text-gray-900" role="dialog" aria-modal="true" data-top-bar-layer aria-label="قائمة التنقل">
                <div className="flex items-center gap-2 border-b border-gray-200/70 p-3">
                    <BrandLogo alt={appName} className="h-9 w-auto" markSize={36} />
                    <span className="min-w-0 flex-1">
                        <b dir="auto" className="block text-[16px]">{shortAppName(appName)}</b>
                        <small dir="auto" className="block text-[12.5px] text-gray-500">{user?.branchName ?? 'نظام التحصيل الكهربائي'}</small>
                    </span>
                    <button type="button" className="tn-tool" onClick={onClose} aria-label="إغلاق القائمة"><Icon name="close" /></button>
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
