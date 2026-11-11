import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/** The light under the hovered, open or current section of the bar: slid into place as it changes, and put back at once when the bar's size or font changes. */
export function useSectionHighlight({ highlightRef, itemRefs, litKey, navRef }) {
    // The dark light sits under the hovered, open or current section.
    const syncHighlight = useCallback(
        (instant = false) => {
            const highlight = highlightRef.current;
            const element = itemRefs.current.get(litKey);

            if (!highlight) {
                return;
            }

            if (!element || !element.offsetWidth) {
                highlight.style.opacity = 0;

                return;
            }

            if (instant || highlight.style.opacity !== '1') {
                highlight.style.transition = 'none';
                requestAnimationFrame(() => {
                    highlight.style.transition = '';
                });
            }

            highlight.style.width = `${element.offsetWidth}px`;
            highlight.style.transform = `translateX(${element.offsetLeft}px)`;
            highlight.style.opacity = 1;
        },
        [litKey, highlightRef, itemRefs],
    );

    useLayoutEffect(() => syncHighlight(), [syncHighlight]);

    // A change of size or font puts the light in place at once; set up once, so it never cuts a slide short.
    const syncRef = useRef(syncHighlight);
    syncRef.current = syncHighlight;

    useEffect(() => {
        const nav = navRef.current;

        if (!nav) {
            return undefined;
        }

        const observer = new ResizeObserver(() => syncRef.current(true));
        observer.observe(nav);
        document.fonts?.ready.then(() => syncRef.current(true));

        return () => observer.disconnect();
    }, [navRef]);

    return { syncHighlight };
}
