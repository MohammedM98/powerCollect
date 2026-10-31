import { useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import ActivityBell from '@/Components/ActivityBell';
import BrandLogo from '@/Components/BrandLogo';
import Icon from '@/Components/Icon';
import NavigationMenu, { NavigationAccount } from '@/Components/TopBar/NavigationMenu';
import { shortAppName } from '@/Components/TopBar/TopBar';
import { currentGroup } from '@/lib/navigation';
import './side-navigation.css';

const STORAGE_KEY = 'side-navigation-collapsed';

/** Whether the rail was left narrow in this browser, else as the company's look starts it (`rail` starts narrow). */
function readCollapsed(startsCollapsed) {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        return saved === null ? startsCollapsed : saved === '1';
    } catch {
        return startsCollapsed;
    }
}

/**
 * The side navigation on wide screens, for a company whose look puts the
 * sections at the side (`sidebar`, or `rail`, which starts narrow): the
 * logo, the notifications, the sections with the current one open, and
 * the account. It narrows to icons and back; a section's icon widens it
 * with that section open. Narrow screens keep the top bar and its menu.
 */
export default function SideNavigation({ groups, badges, startsCollapsed = false, onOpenPalette }) {
    const { props, url } = usePage();
    const [collapsed, setCollapsed] = useState(() => readCollapsed(startsCollapsed));
    const [expanded, setExpanded] = useState(() => currentGroup(groups, url)?.id ?? null);
    const [bellOpen, setBellOpen] = useState(false);
    const branchLabel = props.branchView ? props.branchView.current?.name ?? 'جميع الفروع' : props.auth?.user?.branchName;

    useEffect(() => {
        setExpanded(currentGroup(groups, url)?.id ?? null);
    }, [url]);

    useEffect(() => {
        document.documentElement.dataset.sideNavigation = collapsed ? 'collapsed' : 'open';

        return () => delete document.documentElement.dataset.sideNavigation;
    }, [collapsed]);

    function changeCollapsed(next) {
        setCollapsed(next);

        try {
            localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
        } catch {
            // Storage may be blocked (private mode); the choice still applies on this page.
        }
    }

    return (
        <aside className="sn-panel text-gray-900" data-collapsed={collapsed || undefined} aria-label="التنقل">
            <div className="sn-head">
                <BrandLogo alt={props.appName} className="sn-logo" />
                <span className="sn-title tn-nav-label">
                    <b dir="auto">{shortAppName(props.appName)}</b>
                    <small dir="auto">{branchLabel ?? 'نظام التحصيل الكهربائي'}</small>
                </span>
            </div>

            <div className="sn-tools">
                <ActivityBell open={bellOpen} onToggle={() => setBellOpen(!bellOpen)} onClose={() => setBellOpen(false)} />
                <button
                    type="button"
                    className="tn-tool"
                    onClick={() => changeCollapsed(!collapsed)}
                    aria-label={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
                    aria-expanded={!collapsed}
                    title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
                >
                    <Icon name={collapsed ? 'chevron-left' : 'chevron-right'} />
                </button>
            </div>

            <nav className="sn-body">
                <NavigationMenu
                    groups={groups}
                    badges={badges}
                    expanded={expanded}
                    onExpandedChange={setExpanded}
                    onOpenPalette={onOpenPalette}
                    compact={collapsed}
                    onExpand={(id) => {
                        setExpanded(id);
                        changeCollapsed(false);
                    }}
                />
            </nav>

            <div className="sn-foot">
                <NavigationAccount compact={collapsed} />
            </div>
        </aside>
    );
}
