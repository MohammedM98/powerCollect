import { useEffect, useState } from 'react';

const SURFACES = ['solid', 'glass'];

function readSurface() {
    return document.documentElement.dataset.surface === 'glass' ? 'glass' : 'solid';
}

/**
 * The person's choice of surfaces: solid panels, or glass ones that let the
 * page's faint colour through, frosted (theme.css, section 8). Kept in this
 * browser; app.blade.php applies it before the page paints.
 */
export function useSurface() {
    const [surface, setSurface] = useState(readSurface);

    useEffect(() => {
        function sync(event) {
            if (event.type === 'storage' && event.key !== 'surface') {
                return;
            }
            const next = event.type === 'storage' ? (event.newValue === 'glass' ? 'glass' : 'solid') : readSurface();
            apply(next);
            setSurface(next);
        }
        window.addEventListener('surface-changed', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('surface-changed', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    function changeSurface(next) {
        if (!SURFACES.includes(next)) {
            return;
        }
        apply(next);
        try {
            localStorage.setItem('surface', next);
        } catch {
            // The choice still applies to this page when browser storage is unavailable.
        }
        setSurface(next);
        window.dispatchEvent(new Event('surface-changed'));
    }

    return { surface, changeSurface };
}

function apply(next) {
    if (next === 'glass') {
        document.documentElement.dataset.surface = 'glass';
    } else {
        delete document.documentElement.dataset.surface;
    }
}
