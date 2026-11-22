import { Button } from '@heroui/react';
import DangerButton from '@/Components/UI/DangerButton';
import Icon from '@/Components/UI/Icon';
import PrimaryButton from '@/Components/UI/PrimaryButton';
import SecondaryButton from '@/Components/UI/SecondaryButton';

const KEYS = { danger: DangerButton, primary: PrimaryButton };

/**
 * One action on the selection bar: a soft key by default, `tone="danger"`
 * for what cannot be undone, `tone="primary"` for the bar's one main action
 * and `tone="print"` for printing. A disabled key says why in `hint`.
 */
export function SelectionBarKey({ icon, label, onClick, disabled = false, hint, tone }) {
    const Key = KEYS[tone] ?? SecondaryButton;

    return (
        <Key type="button" onClick={onClick} disabled={disabled} title={disabled ? hint : label} className={tone === 'print' ? 'tone-print' : ''}>
            <Icon name={icon} className="h-4 w-4" />
            {label}
        </Key>
    );
}

/**
 * The bar that floats at the foot of a table while rows are chosen: how
 * many (`count`, with `caption` after it), the actions as `SelectionBarKey`
 * children, and the key that clears the choice. It is a frosted floating
 * surface (ma-forms.css `ma-selection`), and leaves room under the page so
 * the last rows are never hidden behind it (`room={false}` when the page
 * already leaves that room). `label` names the region.
 */
export default function SelectionBar({ label, count, caption, onClear, narrow = false, room = true, children }) {
    return (
        <>
            {room && <div className="ma-selection-room" aria-hidden="true" />}
            <div role="region" aria-label={label} className="ma-selection" data-narrow={narrow ? '' : undefined}>
                <span className="ma-selection-count" aria-live="polite">
                    <bdi dir="ltr">{count.toLocaleString('en')}</bdi>
                    {caption}
                </span>
                <div className="ma-selection-keys">{children}</div>
                <Button data-raw="" variant="ghost" onClick={onClear} aria-label="إلغاء التحديد" title="إلغاء التحديد" className="gl-ib">
                    <Icon name="close" className="h-4 w-4" />
                </Button>
            </div>
        </>
    );
}
