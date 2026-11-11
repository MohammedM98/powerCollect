import { useEffect } from 'react';
import { router } from '@inertiajs/react';
import { pageWindowOpen } from './shortcuts';

/** Clicks and focus outside the bar and its panel close the panel; Esc closes it and returns to its section; Alt + a number opens a section or its page. */
export function useMenuKeys({ closeMega, items, navRef, openMega, state }) {
    // Clicks and focus outside the bar and the panel close it; Esc closes it and returns to its section; Alt + a number opens a section.
    useEffect(() => {
        function inside(target) {
            return target?.closest?.('.tn-mega, .tn-sections');
        }

        function onClick(event) {
            if (!inside(event.target)) {
                closeMega();
            }
        }

        function onFocusIn(event) {
            if (state.current.openId && !inside(event.target)) {
                closeMega();
            }
        }

        function onKeyDown(event) {
            if (event.key === 'Escape' && state.current.openId) {
                closeMega(true);

                return;
            }

            const digit = /^Digit[1-9]$/.test(event.code) ? Number(event.code.slice(5)) : /^[1-9]$/.test(event.key) ? Number(event.key) : null;

            if (event.altKey && !event.ctrlKey && digit && navRef.current?.offsetParent && !state.current.layerOpen && !pageWindowOpen()) {
                const item = items[digit - 1];

                if (!item) {
                    return;
                }

                event.preventDefault();

                if (item.group) {
                    openMega(item.group.id, { pin: true, focus: true });
                } else {
                    router.visit(item.link.href);
                }
            }
        }

        document.addEventListener('click', onClick);
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('click', onClick);
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [closeMega, openMega, items, navRef, state]);

    return {};
}
