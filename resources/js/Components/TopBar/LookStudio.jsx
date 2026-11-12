import { lazy, Suspense } from 'react';
import Icon from '@/Components/Icon';
import { usePopover } from './usePopover';

const LookStudioPanel = lazy(() => import('./LookStudioPanel'));

/**
 * The top bar's appearance panel (the component gallery's look studio):
 * light or dark, the dark background, how see-through and blurred the
 * glass is, the main colour (a ready one or any other) and motion. Every
 * change shows at once and is kept in this browser for this person only;
 * "شكل الشركة" puts the company's look back.
 */
export default function LookStudio({ open, onToggle, onClose }) {
    const { anchorRef, popoverRef, place } = usePopover(open, onClose);

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                className="tn-tool"
                onClick={onToggle}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label="المظهر: الوضع والألوان والشفافية"
                title="المظهر"
            >
                <Icon name="swatch" />
            </button>
            {open && (
                <Suspense fallback={null}>
                    <LookStudioPanel popoverRef={popoverRef} onShown={place} />
                </Suspense>
            )}
        </>
    );
}
