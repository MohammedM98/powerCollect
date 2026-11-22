import { Button } from '@heroui/react';
import Icon from '@/Components/UI/Icon';

/** The small key at the end of a field's label row (FormField `action`): opens a locked field for editing, or closes it again. */
export default function FieldAction({ icon = null, onClick, children }) {
    return (
        <Button data-raw="" variant="ghost" onClick={onClick} className="ma-field-action">
            {icon && <Icon name={icon} className="h-[13px] w-[13px]" />}
            {children}
        </Button>
    );
}
