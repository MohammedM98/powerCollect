import { Button } from '@heroui/react';

/** The secondary look (components.css `gl-btn gl-sec`), for a link that sits beside the main action (back, open, export…). */
export const secondaryButtonClass = 'ui-btn-secondary gl-btn gl-sec';

/**
 * Cancel and side actions: HeroUI's Button in the secondary look, taking a
 * native button's props (`disabled`, `onClick`, `type`…).
 */
export default function SecondaryButton({ className = '', disabled, children, type = 'button', ...props }) {
    return (
        <Button {...props} type={type} variant="secondary" isDisabled={disabled} className={`${secondaryButtonClass} ${className}`}>
            {children}
        </Button>
    );
}
