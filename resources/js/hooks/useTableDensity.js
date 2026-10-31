import { useEffect, useState } from 'react';

const STORAGE_KEY = 'table-density';
const CHANGE_EVENT = 'table-density-change';

/** The density picked last time in this browser, else the company's (`data-ui-density` on <html>): 'comfortable' unless 'compact'. */
function readDensity() {
    let saved = null;

    try {
        saved = localStorage.getItem(STORAGE_KEY);
    } catch {
        // Storage may be blocked (private mode); the company's density applies.
    }

    return (saved ?? document.documentElement.dataset.uiDensity) === 'compact' ? 'compact' : 'comfortable';
}

/**
 * How tightly table rows sit: 'comfortable' (floating cards) or 'compact'
 * (thin rows, about twice as many on screen). The choice is remembered in
 * this browser and set on <html> as `data-table-density`, so every
 * `.data-table` follows it (see app.css). app.blade.php applies the saved
 * choice before the page paints.
 */
export function useTableDensity() {
    const [density, setDensity] = useState(readDensity);

    // A page with several tables has several switches; keep them in step.
    useEffect(() => {
        const onChange = (event) => setDensity(event.detail);

        window.addEventListener(CHANGE_EVENT, onChange);
        return () => window.removeEventListener(CHANGE_EVENT, onChange);
    }, []);

    function changeDensity(next) {
        document.documentElement.dataset.tableDensity = next;
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));

        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Storage may be blocked (private mode); the choice still applies for this visit.
        }
    }

    return [density, changeDensity];
}
