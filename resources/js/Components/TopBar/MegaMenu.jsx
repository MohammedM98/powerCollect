import { Button } from '@heroui/react';
import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import { shouldPrefetchPage, isActiveLink, lockedLinkProps, sectionLinks } from '@/lib/navigation';

/** The small lock on a page the user may not open; its link opens nothing. */
export function LockMark() {
    return (
        <span className="tn-lock" title="لا تملك صلاحية فتح هذه الصفحة">
            <Icon name="lock" />
            <span className="sr-only">(بلا صلاحية)</span>
        </span>
    );
}

/** The panel's width: one column of the section's pages, as in HeroUI's menu. */
export function megaWidth() {
    return 340;
}

/**
 * One section's pages, beside the side bar: the section's name and what it
 * holds on top, then each page with its icon and a line on it (a count of
 * what waits there), the open page on a soft fill, and a footer with the
 * keys and a way to every page.
 */
export default function MegaMenu({ group, url, badges, width, shift, leaving, onSearch, contentRef }) {
    const links = sectionLinks(group);

    return (
        <div
            ref={contentRef}
            className={`tn-mega-content tn-fly ${leaving ? 'is-leaving' : ''}`}
            style={{ width, '--tn-shift': `${shift}px` }}
            aria-hidden={leaving || undefined}
        >
            <div className="tn-fly-head">
                <span className="tn-fly-icon"><Icon name={group.icon} /></span>
                <span className="min-w-0">
                    <b>{group.label}</b>
                    <small>{group.description}</small>
                </span>
            </div>

            {links.length === 0 && <p className="px-3 py-4 text-sm text-gray-500">لا توجد صفحات متاحة ضمن صلاحياتك.</p>}
            <ul className="tn-fly-list">
                {links.map((link) => (
                    <li key={link.href}>
                        <Link href={link.href} prefetch={!link.locked && shouldPrefetchPage(link.href)} className="tn-mega-link" aria-current={isActiveLink(link, url) ? 'page' : undefined} tabIndex={leaving ? -1 : undefined} {...lockedLinkProps(link)}>
                            <span className="tn-tile"><Icon name={link.icon} /></span>
                            <span className="min-w-0">
                                <b>{link.label}</b>
                                <small>{link.description}</small>
                            </span>
                            {link.locked ? <LockMark /> : badges[link.href] > 0 ? <span className="tn-badge">{badges[link.href]}</span> : null}
                        </Link>
                    </li>
                ))}
            </ul>

            <div className="tn-fly-foot">
                <span className="inline-flex items-center gap-2"><span className="tn-kbd">↑ ↓</span>تنقّل</span>
                <span className="inline-flex items-center gap-2"><span className="tn-kbd">Esc</span>إغلاق</span>
                <Button data-raw="" variant="ghost" onClick={onSearch} tabIndex={leaving ? -1 : undefined} className="ms-auto inline-flex shrink-0 items-center gap-2 font-semibold">
                    <Icon name="search" className="h-4 w-4" />
                    كل الصفحات <span className="tn-kbd" dir="ltr">Ctrl K</span>
                </Button>
            </div>
        </div>
    );
}
