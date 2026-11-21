import { useEffect, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import Icon from '@/Components/UI/Icon';
import { shouldPrefetchPage, HOME_LINK, isActiveLink, sectionLinks } from '@/lib/navigation';

/** Where the page sits: home, its section, then the page. */
export function Breadcrumb({ trail }) {
    if (!trail) {
        return null;
    }

    const { group, link, exact } = trail;

    return (
        <nav className="tn-trail tn-rise mb-3 flex items-center gap-2 text-[13.5px] text-gray-500" aria-label="مسار الصفحة">
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
export function SectionPages({ trail, url, badges }) {
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

        function placeLine() {
            const currentLink = strip.querySelector('[aria-current="page"]');
            setLine(currentLink ? { left: currentLink.offsetLeft + 6, width: currentLink.offsetWidth - 12 } : null);
        }

        placeLine();
        window.addEventListener('resize', placeLine);
        document.fonts?.ready.then(placeLine);

        return () => window.removeEventListener('resize', placeLine);
    }, [url, links.length]);

    useEffect(() => {
        const strip = stripRef.current;
        if (!strip) {
            return undefined;
        }

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
        function centre() {
            const strip = stripRef.current;
            const currentLink = strip?.querySelector('[aria-current="page"]');

            if (strip && currentLink) {
                strip.scrollLeft += currentLink.getBoundingClientRect().left + currentLink.offsetWidth / 2 - (strip.getBoundingClientRect().left + strip.clientWidth / 2);
            }
        }

        const frame = requestAnimationFrame(centre);
        const timer = setTimeout(centre, 120);

        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(timer);
        };
    }, [url]);

    if (links.length === 0) {
        return null;
    }

    return (
        <div
            ref={stripRef}
            data-tour="subnav"
            data-fade={fade ?? undefined}
            role="navigation"
            aria-label={`صفحات ${trail.group.label}`}
            className="tn-subnav flex gap-1 overflow-x-auto scrollbar-none"
        >
            {links.map((link) => (
                <Link key={link.href} href={link.href} prefetch={shouldPrefetchPage(link.href)} aria-current={isActiveLink(link, url) ? 'page' : undefined}>
                    <Icon name={link.icon} />
                    {link.label}
                    {badges[link.href] > 0 && <span className="tn-badge">{badges[link.href]}</span>}
                </Link>
            ))}
            <span className="tn-subnav-line" aria-hidden="true" style={line ? { width: line.width, transform: `translateX(${line.left}px)` } : undefined} />
        </div>
    );
}
