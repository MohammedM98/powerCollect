import { useEffect, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import { shouldPrefetchPage, HOME_LINK, sectionLinks } from '@/lib/navigation';

/** Where the page sits: home, its section, then the page. */
export function Breadcrumb({ trail }) {
    if (!trail) {
        return null;
    }

    const { group, link, exact } = trail;

    return (
        <nav className="tn-trail tn-rise mb-3 flex items-center gap-1.5 text-[13.5px] text-gray-500" aria-label="مسار الصفحة">
            <Link href={HOME_LINK.href} prefetch={shouldPrefetchPage(HOME_LINK.href)} className="inline-flex min-h-6 items-center hover:text-gray-900">{HOME_LINK.label}</Link>
            {group && (
                <>
                    <Icon name="chevron-left" className="h-3.5 w-3.5" />
                    <span>{group.label}</span>
                </>
            )}
            <Icon name="chevron-left" className="h-3.5 w-3.5" />
            {exact
                ? <span className="font-semibold text-gray-800" aria-current="page">{link.label}</span>
                : <Link href={link.href} prefetch={shouldPrefetchPage(link.href)} className="inline-flex min-h-6 items-center font-semibold text-gray-800 hover:text-gray-900">{link.label}</Link>}
        </nav>
    );
}

/**
 * Which ends of a scrolling strip hide more of it: 'start', 'end', 'both'
 * or null. In right-to-left text the start is on the right and scrollLeft
 * runs from 0 down to minus the overflow.
 */
export function hiddenEnds(scrollLeft, scrollWidth, clientWidth) {
    const overflow = scrollWidth - clientWidth;
    const scrolled = Math.abs(scrollLeft);
    const start = scrolled > 1;
    const end = overflow - scrolled > 1;

    return start && end ? 'both' : start ? 'start' : end ? 'end' : null;
}

/**
 * The section's other pages, one click away, as the top bar's second row:
 * the current one lit and centred in view; an edge that hides more pages
 * fades, so a phone shows the strip scrolls.
 */
export function SectionPages({ trail, url, badges, action, onAction }) {
    const stripRef = useRef(null);
    const [fade, setFade] = useState(null);
    const [line, setLine] = useState(null);
    const links = sectionLinks(trail?.group);

    // The line under the open page: measured from the link, it slides when the page changes.
    useEffect(() => {
        const strip = stripRef.current;
        if (!strip) {
            return undefined;
        }

        let mounted = true;
        function placeLine() {
            if (!mounted) return;
            const currentLink = strip.querySelector('[aria-selected="true"]');
            setLine(currentLink ? { left: currentLink.offsetLeft, width: currentLink.offsetWidth } : null);
        }

        placeLine();
        window.addEventListener('resize', placeLine);
        document.fonts?.ready.then(placeLine);

        return () => {
            mounted = false;
            window.removeEventListener('resize', placeLine);
        };
    }, [url, links.length]);

    useEffect(() => {
        const strip = stripRef.current;
        if (!strip) return undefined;
        const measure = () => setFade(hiddenEnds(strip.scrollLeft, strip.scrollWidth, strip.clientWidth));
        measure();
        strip.addEventListener('scroll', measure, { passive: true });
        window.addEventListener('resize', measure);
        return () => {
            strip.removeEventListener('scroll', measure);
            window.removeEventListener('resize', measure);
        };
    }, [url, links.length]);

    useEffect(() => {
        const strip = stripRef.current;
        const currentLink = strip?.querySelector('[aria-selected="true"]');
        if (strip && currentLink) {
            const stripMiddle = strip.getBoundingClientRect().left + strip.clientWidth / 2;
            const linkMiddle = currentLink.getBoundingClientRect().left + currentLink.offsetWidth / 2;
            strip.scrollLeft += linkMiddle - stripMiddle;
        }
    }, [url]);

    if (!links.length) return null;

    function moveFocus(event) {
        const tabs = Array.from(stripRef.current.querySelectorAll('[role="tab"]'));
        const current = tabs.indexOf(event.currentTarget);
        const next = {
            ArrowLeft: (current + 1) % tabs.length,
            ArrowRight: (current + tabs.length - 1) % tabs.length,
            Home: 0,
            End: tabs.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        tabs[next]?.focus();
    }

    return (
        <div className="gl-section-bar">
            <div className="gl-section-title">
                <span className="gl-section-icon"><Icon name={trail.group.icon} className="h-5 w-5" /></span>
                <div className="min-w-0">
                    <strong>{trail.group.label}</strong>
                    <small className="block truncate text-gray-500">{trail.group.description}</small>
                </div>
            </div>
            <div
                ref={stripRef}
                data-tour="subnav"
                data-fade={fade ?? undefined}
                role="tablist"
                aria-label={'صفحات ' + trail.group.label}
                className="tn-subnav gl-section-tabs flex gap-1 overflow-x-auto [scrollbar-width:none]"
            >
                {links.map((link) => {
                    const selected = link.href === trail.link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            preserveScroll
                            prefetch={shouldPrefetchPage(link.href)}
                            role="tab"
                            aria-controls="main-content"
                            aria-selected={selected}
                            aria-current={selected ? 'page' : undefined}
                            tabIndex={selected ? 0 : -1}
                            onKeyDown={moveFocus}
                        >
                            {link.label}
                            {badges[link.href] > 0 && <span className="tn-badge">{badges[link.href]}</span>}
                        </Link>
                    );
                })}
                <span className="gl-section-indicator" aria-hidden="true" style={line ? { width: line.width, transform: 'translateX(' + line.left + 'px)' } : undefined} />
            </div>
            {action && <button type="button" className="gl-section-action" onClick={() => onAction(action.id)}>
                <Icon name="plus" className="h-4 w-4 shrink-0" /><span>{action.label}</span>
            </button>}
        </div>
    );
}
