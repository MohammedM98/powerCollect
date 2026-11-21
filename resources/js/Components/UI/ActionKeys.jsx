import { Button } from '@heroui/react';
import Icon from '@/Components/UI/Icon';

/**
 * The row keys, defined once so every table shows them alike: the same
 * 36px HeroUI key, its icon, its word as the tooltip and screen-reader
 * name, and its tone (app.css `row-action`): blue to edit, red to delete,
 * blue-grey to print, Excel green for Excel. Each takes `onPress` (or
 * `onClick`), `label` to name it otherwise, and `isDisabled`.
 */
function RowKey({ icon, tone = '', label, onPress, onClick, isDisabled = false, ...props }) {
    return (
        <Button {...props} data-raw="" variant="ghost" className={`row-action ${tone}`.trim()} aria-label={label} title={label} onPress={onPress} onClick={onClick} isDisabled={isDisabled}>
            <Icon name={icon} className="h-[18px] w-[18px]" />
        </Button>
    );
}

export function EditKey({ label = 'تعديل', ...props }) {
    return <RowKey icon="pencil" tone="row-action-edit" label={label} {...props} />;
}

export function DeleteKey({ label = 'حذف', ...props }) {
    return <RowKey icon="trash" tone="row-action-delete" label={label} {...props} />;
}

export function PrintKey({ label = 'طباعة', ...props }) {
    return <RowKey icon="printer" tone="row-action-print" label={label} {...props} />;
}

export function ExcelKey({ label = 'Excel', ...props }) {
    return <RowKey icon="excel" tone="row-action-excel" label={label} {...props} />;
}

/** More actions: the ⋯ key; `colored` makes it burgundy, for a row whose actions are its business. */
export function MenuKey({ label = 'إجراءات أخرى', colored = false, ...props }) {
    return <RowKey icon="dots" tone={colored ? 'row-action-menu' : ''} label={label} aria-haspopup="menu" {...props} />;
}

/** Any other row action by its icon and word, in the same size. */
export function RowActionKey({ icon = 'dots', label, tone = '', ...props }) {
    return <RowKey icon={icon} tone={tone} label={label} {...props} />;
}

/**
 * The row's main key: «عرض», white with a blue eye, always showing; with
 * `onMenu`, split with an arrow that opens the row's menu.
 */
export function ViewKey({ label = 'عرض', icon = 'eye', onPress, onClick, onMenu = null, menuProps = {} }) {
    return (
        <span className="row-action-view">
            <Button data-raw="" variant="ghost" onPress={onPress} onClick={onClick}>
                <Icon name={icon} className="h-4 w-4" />
                {label}
            </Button>
            {onMenu && (
                <Button data-raw="" variant="ghost" aria-label="إجراءات أخرى" title="إجراءات أخرى" aria-haspopup="menu" onClick={onMenu} {...menuProps}>
                    <Icon name="chevron-down" className="h-4 w-4" strokeWidth={2} />
                </Button>
            )}
        </span>
    );
}
