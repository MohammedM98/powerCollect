import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { HOME_LINK, groupLandingLink, isActiveLink } from '@/lib/navigation';
import { megaWidth } from './MegaMenu';
import { useSectionHighlight } from './useSectionHighlight';
import { useMenuKeys } from './useMenuKeys';

function menuPosition(button, width, height) {
    const bounds = button.getBoundingClientRect();
    const dock = button.closest('.tn-side').getBoundingClientRect();
    const rtl = getComputedStyle(button).direction === 'rtl';
    const viewport = document.documentElement;
    const besideDock = rtl ? dock.left - width - 10 : dock.right + 10;

    return {
        x: Math.max(16, Math.min(viewport.clientWidth - width - 16, besideDock)),
        top: Math.max(16, Math.min(bounds.top, viewport.clientHeight - height - 16)),
    };
}

/** The top bar's menus: which section's panel is open or pinned, the panels sliding between sections, the light under the hovered section, the small menus (popover), the bar slimming on scroll, and the mouse and keyboard ways in and out of them. */
export function useMegaMenu({ current, groups, items, layerOpen, url }) {
    const [scrolled, setScrolled] = useState(false);
    const [hoverKey, setHoverKey] = useState(null);
    const [openId, setOpenId] = useState(null);
    const [pinned, setPinned] = useState(false);
    const [popover, setPopover] = useState(null);
    const [panels, setPanels] = useState([]);
    const [still, setStill] = useState(false);
    const [geometry, setGeometry] = useState({ width: 420, height: 300, x: 0, top: 92 });

    const navRef = useRef(null);
    const highlightRef = useRef(null);
    const megaRef = useRef(null);
    const itemRefs = useRef(new Map());
    const panelRef = useRef(null);
    const timers = useRef({ open: null, close: null, leaving: new Set() });
    const focusedPanel = useRef(null);
    const pointerType = useRef(null);
    const panelsRef = useRef([]);
    panelsRef.current = panels;
    const state = useRef({ openId: null, pinned: false, popover: null, popoverY: 0 });
    state.current = { ...state.current, openId, pinned, popover, layerOpen };

    const currentKey =
        groups.length === 1
            ? items.find((item) => item.link && isActiveLink(item.link, url))?.key
            : isActiveLink(HOME_LINK, url)
              ? 'home'
              : current?.id;
    const litKey = hoverKey ?? openId ?? currentKey;

    const clearTimers = useCallback(() => {
        clearTimeout(timers.current.open);
        clearTimeout(timers.current.close);
    }, []);

    const closeMega = useCallback((returnFocus = false) => {
        clearTimeout(timers.current.open);
        const id = state.current.openId;

        if (!id) {
            return;
        }

        setOpenId(null);
        setPinned(false);

        if (returnFocus) {
            itemRefs.current.get(id)?.focus();
        }
    }, []);

    const openMega = useCallback(
        (id, { pin = false, focus = false } = {}) => {
            const group = groups.find((candidate) => candidate.id === id);
            const button = itemRefs.current.get(id);

            if (!group || !button) {
                return;
            }

            setPopover(null);

            if (state.current.openId === id) {
                if (pin) {
                    setPinned(true);
                }

                if (focus) {
                    megaRef.current
                        ?.querySelector('.tn-mega-content:not(.is-leaving) .tn-feature, .tn-mega-content:not(.is-leaving) .tn-mega-link')
                        ?.focus();
                }

                return;
            }

            const first = !state.current.openId;
            const previousIndex = groups.findIndex((candidate) => candidate.id === state.current.openId);
            const index = groups.findIndex((candidate) => candidate.id === id);
            const shift = first ? 0 : index > previousIndex ? -24 : 24;
            const width = megaWidth(group);
            setStill(first);
            setGeometry((previous) => ({ ...previous, width, ...menuPosition(button, width, previous.height) }));
            // Each panel fades out for 200ms from the moment it starts leaving, then goes.
            if (!first) {
                panelsRef.current
                    .filter((panel) => !panel.leaving)
                    .forEach((panel) => {
                        const timer = setTimeout(() => {
                            timers.current.leaving.delete(timer);
                            setPanels((current) => current.filter((candidate) => candidate.key !== panel.key));
                        }, 200);
                        timers.current.leaving.add(timer);
                    });
            }

            setPanels((previous) => [
                ...(first ? [] : previous.map((panel) => (panel.leaving ? panel : { ...panel, leaving: true, shift }))),
                { id, key: `${id}-${Date.now()}`, shift, leaving: false, focus },
            ]);
            setOpenId(id);
            setPinned(pin);
        },
        [groups],
    );

    // The panel takes the height of the section it shows, and focuses its first page when opened from the keyboard.
    useLayoutEffect(() => {
        const content = panelRef.current;

        if (!content) {
            return undefined;
        }

        const newest = panels.at(-1);
        const button = itemRefs.current.get(newest?.id);
        if (!button) {
            return undefined;
        }

        function placeMenu() {
            const height = content.offsetHeight;
            setGeometry((previous) => ({ ...previous, height, ...menuPosition(button, previous.width, height) }));
        }

        placeMenu();
        const observer = new ResizeObserver(placeMenu);
        observer.observe(content);

        if (newest?.focus && focusedPanel.current !== newest.key) {
            focusedPanel.current = newest.key;
            requestAnimationFrame(() => content.querySelector('.tn-feature, .tn-mega-link')?.focus());
        }

        return () => observer.disconnect();
    }, [panels]);

    // On the first open the panel appears at its size, then reshapes smoothly from there.
    useEffect(() => {
        if (!still) {
            return undefined;
        }

        const frame = requestAnimationFrame(() => setStill(false));

        return () => cancelAnimationFrame(frame);
    }, [still]);

    const { syncHighlight } = useSectionHighlight({ highlightRef, itemRefs, litKey, navRef });

    // A window over the page (search, keys, tour, the phone menu) closes the bar's menus.
    useEffect(() => {
        if (layerOpen) {
            closeMega();
            setPopover(null);
        }
    }, [layerOpen, closeMega]);

    // Opening a page closes the menus.
    useEffect(() => {
        setOpenId(null);
        setPinned(false);
        setPopover(null);
        setHoverKey(null);
    }, [url]);

    // The bar slims on scroll and its small menus close once the page moves away.
    useEffect(() => {
        function onScroll() {
            const y = window.scrollY;
            // Two edges, so a page resting near one cannot flip the bar back and forth.
            setScrolled((wasScrolled) => (wasScrolled ? y > 4 : y > 24));

            if (state.current.popover && Math.abs(y - state.current.popoverY) > 24) {
                setPopover(null);
            } else if (!state.current.popover) {
                state.current.popoverY = y;
            }
        }

        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // A new width closes the menus and puts the light back in place at once.
    useEffect(() => {
        let lastWidth = window.innerWidth;
        let frame;

        function onResize() {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (window.innerWidth !== lastWidth) {
                    lastWidth = window.innerWidth;
                    closeMega();
                    setPopover(null);
                }

                syncHighlight(true);
            });
        }

        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', onResize);
        };
    }, [closeMega, syncHighlight]);

    useMenuKeys({ closeMega, items, navRef, openMega, state });

    useEffect(
        () => () => {
            clearTimers();
            timers.current.leaving.forEach(clearTimeout);
        },
        [clearTimers],
    );

    function hoverItem(item) {
        clearTimeout(timers.current.close);
        setHoverKey(item.key);

        if (item.group) {
            clearTimeout(timers.current.open);
            timers.current.open = setTimeout(() => openMega(item.group.id), state.current.openId ? 70 : 110);
        } else {
            clearTimeout(timers.current.open);

            if (state.current.openId && !state.current.pinned) {
                timers.current.close = setTimeout(() => closeMega(), 160);
            }
        }
    }

    function leaveZone() {
        clearTimers();
        timers.current.close = setTimeout(() => {
            setHoverKey(null);

            if (!state.current.pinned) {
                closeMega();
            }
        }, 220);
    }

    function onSectionClick(event, group) {
        const id = group.id;
        const landing = groupLandingLink(group);

        if (event.detail && pointerType.current === 'mouse' && landing) {
            closeMega();
            router.visit(landing.href);
        } else if (openId === id && !pinned && event.detail) {
            openMega(id, { pin: true });
        } else if (openId === id) {
            closeMega();
        } else {
            openMega(id, { pin: true, focus: !event.detail });
        }
    }

    function onSectionKeyDown(event, item) {
        const keys = items.map((candidate) => candidate.key);
        const index = keys.indexOf(item.key);

        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            const next = items[(index + (event.key === 'ArrowLeft' ? 1 : -1) + items.length) % items.length];
            itemRefs.current.get(next.key)?.focus();
            setHoverKey(next.key);

            if (state.current.openId && next.group) {
                openMega(next.group.id, { pin: true });
            } else if (state.current.openId) {
                closeMega();
            }
        } else if (event.key === 'ArrowDown' && item.group) {
            event.preventDefault();
            openMega(item.group.id, { pin: true, focus: true });
        }
    }

    function onMegaKeyDown(event) {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return;
        }

        event.preventDefault();
        const links = [
            ...megaRef.current.querySelectorAll('.tn-mega-content:not(.is-leaving) .tn-feature, .tn-mega-content:not(.is-leaving) .tn-mega-link'),
        ];
        const index = links.indexOf(document.activeElement);

        if (index <= 0 && event.key === 'ArrowUp') {
            closeMega(true);

            return;
        }

        links[(index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]?.focus();
    }

    function togglePopover(kind) {
        closeMega();
        state.current.popoverY = window.scrollY;
        setPopover((open) => (open === kind ? null : kind));
    }

    const openGroup = groups.find((group) => group.id === openId);

    return {
        scrolled,
        clearTimers,
        closeMega,
        currentKey,
        geometry,
        highlightRef,
        hoverItem,
        itemRefs,
        leaveZone,
        litKey,
        megaRef,
        navRef,
        onMegaKeyDown,
        onSectionClick,
        onSectionKeyDown,
        openGroup,
        openId,
        panelRef,
        panels,
        pointerType,
        popover,
        setHoverKey,
        setPopover,
        still,
        togglePopover,
    };
}
