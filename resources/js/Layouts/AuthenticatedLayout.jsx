import { lazy, Suspense, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { Breadcrumb, SectionPages } from '@/Components/Layout/PageTrail';
import { NO_BADGES, Shell, ShellContext, loadingTool } from '@/Layouts/AppShell';

const PrintDesigner = lazy(() => import('@/Components/Print/PrintDesigner'));
const TableExcelDesigner = lazy(() => import('@/Components/Excel/TableExcelDesigner'));

// The first page of a visit to the app keeps the browser's own focus; later pages put it on their content.
let openedOnce = false;

// How far down the bar reaches, so content under it counts as scrolled away.
const BAR_CLEARANCE = 90;

/**
 * A signed-in page's own part of the frame: its trail, its title (`header`),
 * its section's tabs and its content, inside the shell that stays from page
 * to page (AppShell, Inertia's layout in app.jsx). The page tells the shell
 * its `badges` (what waits on a page, by its link: { '/payments/summary': 2 })
 * and `scope` (the branch, or "جميع الفروع", whose figures it shows).
 * Opened for printing, it is the print designer around the content.
 * A page shown outside the shell (a test rendering it alone) brings its own.
 */
export default function AuthenticatedLayout(props) {
    const shell = useContext(ShellContext);

    return shell ? <PageFrame {...props} /> : <Shell><PageFrame {...props} /></Shell>;
}

function PageFrame({ header, badges = NO_BADGES, scope = null, children, beforePrint }) {
    const { trail, hasSectionPages, url, printSettings, setPage, setPastTitle } = useContext(ShellContext);
    const titleEndRef = useRef(null);
    const badgesKey = JSON.stringify(badges);

    // The shell's bar and side bar show this page's badges and scope while it is open.
    useLayoutEffect(() => {
        setPage({ badges: JSON.parse(badgesKey), scope });

        return () => setPage(null);
    }, [badgesKey, scope, setPage]);

    // After opening a page from the bar, the search or a link, focus lands on its content, not at the top of the document.
    useEffect(() => {
        if (openedOnce && (!document.activeElement || document.activeElement === document.body)) {
            document.getElementById('main-content')?.focus({ preventScroll: true });
        }

        openedOnce = true;
    }, []);

    // Whether the page's title has scrolled up under the bar.
    useEffect(() => {
        const marker = titleEndRef.current;

        if (!marker) {
            return undefined;
        }

        const observer = new IntersectionObserver(([entry]) => setPastTitle(!entry.isIntersecting && entry.boundingClientRect.top < BAR_CLEARANCE), {
            rootMargin: `-${BAR_CLEARANCE}px 0px 0px 0px`,
        });
        observer.observe(marker);

        return () => {
            observer.disconnect();
            setPastTitle(false);
        };
    }, [setPastTitle]);

    // Opened from a table's print button: the page without the menus (see lib/print.js).
    if (printSettings) {
        if (new URL(url, window.location.origin).searchParams.get('excel') === '1') {
            return <Suspense fallback={loadingTool}><TableExcelDesigner settings={printSettings}>{children}</TableExcelDesigner></Suspense>;
        }
        return <Suspense fallback={loadingTool}><PrintDesigner settings={printSettings} beforePrint={beforePrint}>{children}</PrintDesigner></Suspense>;
    }

    return (
        <>
            {/* As in the redesign: the trail, the title and its line, the section's tabs, then the page's actions. */}
            <div className="gl-page-top">
                <Breadcrumb trail={trail} />
                {header && <div className="gl-page-head rise-in">{header}</div>}
                {hasSectionPages && <div className="tn-page-tabs"><SectionPages trail={trail} url={url} badges={badges} /></div>}
            </div>
            <div ref={titleEndRef} aria-hidden="true" />
            {children}
        </>
    );
}
