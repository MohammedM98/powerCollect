import { Button } from '@heroui/react';
import Icon from '@/Components/Icon';

/** Recording a payment: the payment's green key, the same on every page. Takes HeroUI Button's props. */
export default function PayKey({ children = 'تسجيل دفعة', className = '', ...props }) {
    return (
        <Button {...props} variant="primary" className={`gl-btn gl-pay ${className}`.trim()}>
            <Icon name="banknotes" className="h-4 w-4" />
            {children}
        </Button>
    );
}
