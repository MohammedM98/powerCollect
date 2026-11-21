import { Button } from '@heroui/react';

/** The primary look (components.css `gl-btn`), for a link that acts as the screen's main action. */
export const primaryButtonClass = 'ui-btn-primary gl-btn';

/**
 * The main action on a screen: HeroUI's Button in the primary look. It
 * takes a native button's props (`disabled`, `onClick`, `type`, `form`…),
 * so every screen keeps calling it the same way.
 */
export default function PrimaryButton({ className = '', disabled, children, type = 'submit', ...props }) {
    return (
        <Button {...props} type={type} variant="primary" isDisabled={disabled} className={`${primaryButtonClass} ${className}`}>
            {children}
        </Button>
    );
}
