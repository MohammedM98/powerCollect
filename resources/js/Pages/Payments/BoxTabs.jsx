import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';

/** Each tab's icon, so a place is known at a glance. */
const TAB_ICONS = { open: 'unlock', closed: 'lock', sent: 'send', entries: 'list' };

/**
 * The financial boxes page's places as the redesign's segmented control, in
 * the order work goes through them: the entries of the branch's open boxes,
 * its open boxes, and its closed boxes, each with how many there are. The
 * place shown is white on the grey track; closed boxes waiting are counted
 * in the company's soft tint. `tabs` come from the server with their links; `current` is the
 * key of the one shown; `hint` says what the place holds, under it.
 */
export default function BoxTabs({ tabs, current, hint = null }) {
    return (
        <div className="gl-cb-top">
            <nav aria-label="الصناديق المالية" className="gl-cb-tabs">
                {tabs.map((tab) => {
                    const active = tab.key === current;

                    return (
                        <Link key={tab.key} href={tab.url} prefetch preserveScroll aria-current={active ? 'page' : undefined} className="gl-cb-tab">
                            <Icon name={TAB_ICONS[tab.key] ?? 'wallet'} className="h-4 w-4" />
                            {tab.label}
                            <span className="gl-cb-count gl-num" data-waiting={tab.key === 'closed' && tab.count > 0 ? '' : undefined}>
                                {tab.count.toLocaleString('en')}
                            </span>
                        </Link>
                    );
                })}
            </nav>
            {hint && <p className="gl-cb-info">{hint}</p>}
        </div>
    );
}
