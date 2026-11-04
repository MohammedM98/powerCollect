import { useEffect, useState } from 'react';
import { NAVIGATION_LAYOUT_KEY, navigationLayout } from '@/lib/navigation';

const CHANGE_EVENT = 'navigation-layout-change';

function readSaved() {
    try {
        return localStorage.getItem(NAVIGATION_LAYOUT_KEY);
    } catch {
        // Storage may be blocked (private mode); the company's navigation applies.
        return null;
    }
}

/**
 * The navigation this browser shows ('topbar', 'sidebar' or 'rail'), from
 * the company's (`companyNavigation`) unless its user switched between the
 * side menu and the top bar here, and the switch. The choice is remembered
 * in this browser; every switch on the page stays in step.
 */
export function useNavigationLayout(companyNavigation) {
    const [saved, setSaved] = useState(readSaved);

    useEffect(() => {
        const onChange = (event) => setSaved(event.detail);

        window.addEventListener(CHANGE_EVENT, onChange);

        return () => window.removeEventListener(CHANGE_EVENT, onChange);
    }, []);

    function changeLayout(next) {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));

        try {
            localStorage.setItem(NAVIGATION_LAYOUT_KEY, next);
        } catch {
            // Storage may be blocked (private mode); the choice still applies for this visit.
        }
    }

    return [navigationLayout(saved, companyNavigation), changeLayout];
}
