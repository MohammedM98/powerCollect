import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';

/** Each tab's icon, so a place is known at a glance. */
const TAB_ICONS = { open: 'unlock', closed: 'lock', sent: 'send', entries: 'list' };

/**
 * The financial boxes page's tabs, as the prototype's underlined tabs, in
 * the order work goes through them: the entries of the branch's open boxes,
 * its open boxes, its closed boxes not sent yet, and those sent to audit,
 * each with how many there are. The tab shown carries the line in the
 * company's colour; closed boxes waiting to be sent are counted in red.
 * `tabs` come from the server with their links; `current` is the key of
 * the one shown.
 */
export default function BoxTabs({ tabs, current }) {
    return (
        <nav aria-label="الصناديق المالية" className="gl-tabs max-w-full">
            {tabs.map((tab) => {
                const active = tab.key === current;
                const waiting = tab.key === 'closed' && tab.count > 0;

                return (
                    <Link
                        key={tab.key}
                        href={tab.url}
                        prefetch
                        preserveScroll
                        aria-current={active ? 'page' : undefined}
                        className="gl-tab"
                    >
                        <Icon name={TAB_ICONS[tab.key] ?? 'wallet'} className="h-4 w-4" />
                        {tab.label}
                        <span className="gl-cnt gl-num" style={waiting ? { background: 'var(--gl-bad)', color: '#fff' } : undefined}>
                            {tab.count.toLocaleString('en')}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
