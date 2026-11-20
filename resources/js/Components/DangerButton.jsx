import { Button } from '@heroui/react';

/**
 * Destructive actions: HeroUI's Button as a soft red key (components.css
 * `gl-danger`) that fills in on hover, taking a native button's props.
 */
export default function DangerButton({ className = '', disabled, children, type = 'submit', ...props }) {
    return (
        <Button {...props} type={type} variant="danger" isDisabled={disabled} className={`ui-btn-danger gl-btn gl-danger ${className}`}>
            {children}
        </Button>
    );
}
