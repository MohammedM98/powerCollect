import { useEffect, useRef } from 'react';
import { Modal } from '@heroui/react';

/** Lists, calendars and tips the app draws straight into <body> (marked `data-react-aria-top-layer`) belong to the window that opened them. */
const FLOATING = '[data-react-aria-top-layer], .gl-pop, [data-date-picker]';

let titleCount = 0;

/**
 * Four window sizes only, each with its use: small (420) for a field or two and confirmations,
 * medium (560) for most forms, large (820) for a form beside a preview or two columns of fields,
 * extra large (1040) for long forms with an index and statements. The older names map onto them.
 */
const WIDTHS = {
    sm: 'sm:max-w-[420px]',
    md: 'sm:max-w-[420px]',
    lg: 'sm:max-w-[560px]',
    xl: 'sm:max-w-[560px]',
    '2xl': 'sm:max-w-[820px]',
    '3xl': 'sm:max-w-[820px]',
    '4xl': 'sm:max-w-[820px]',
    '5xl': 'sm:max-w-[1040px]',
    '6xl': 'sm:max-w-[1040px]',
    '7xl': 'sm:max-w-[1040px]',
    full: 'sm:max-w-none',
};

/**
 * The app's window, built on HeroUI's Modal (React Aria underneath) in the
 * MA look: a pop-up in the middle of the screen (never a side panel), 28px
 * corners and `--ma-float`, glass or solid with the surface. One taller than
 * the screen scrolls, and on phones it sits on the screen's bottom edge as a
 * sheet (app.css `.modal-scroll`).
 *
 * HeroUI brings the behaviour: drawn into <body> so a window opened from
 * another still covers the screen, the page behind keeps still and is hidden
 * from assistive tech, Tab stays inside, Escape closes only the newest
 * window, a press outside closes it only when it started outside, and focus
 * goes back to whatever opened it. A panel whose content doesn't name its own
 * role is announced as a dialog, titled by its first heading.
 */
export default function Window({ show, onClose, children, maxWidth = 'md', panelClassName = '', presentation = 'details' }) {
    const panelRef = useRef(null);

    useEffect(() => {
        if (!show) {
            return undefined;
        }

        // The page behind stays still while any window is open (app.css); counted so a window over a window keeps it.
        const root = document.documentElement;
        root.dataset.modalOpen = String(Number(root.dataset.modalOpen || 0) + 1);

        const panel = panelRef.current;
        if (panel && !panel.querySelector('[role="dialog"], [role="alertdialog"]')) {
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'true');
            const heading = panel.querySelector('h1, h2, h3');
            if (heading) {
                heading.id ||= `modal-title-${++titleCount}`;
                panel.setAttribute('aria-labelledby', heading.id);
            }
        }

        return () => {
            const left = Number(root.dataset.modalOpen || 1) - 1;
            if (left > 0) {
                root.dataset.modalOpen = String(left);
            } else {
                delete root.dataset.modalOpen;
            }
        };
    }, [show]);

    return (
        <Modal.Backdrop
            isOpen={Boolean(show)}
            onOpenChange={(open) => !open && onClose?.()}
            shouldCloseOnInteractOutside={(element) => !element?.closest?.(FLOATING)}
            data-modal-presentation={presentation}
            className="modal-scroll fixed inset-0 z-50 flex overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
        >
            <div className="modal-scrim animate-modal-backdrop pointer-events-none fixed inset-0" aria-hidden="true" />
            <Modal.Container
                ref={panelRef}
                className={`modal-sheet-panel animate-modal-panel relative m-auto w-full overflow-hidden rounded-panel outline-hidden ${WIDTHS[maxWidth] ?? ''} ${panelClassName}`.trim()}
            >
                {children}
            </Modal.Container>
        </Modal.Backdrop>
    );
}
