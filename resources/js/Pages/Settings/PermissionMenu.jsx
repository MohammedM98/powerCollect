import { Dropdown } from '@heroui/react';
import Icon from '@/Components/Icon';

/**
 * A small menu under a button: HeroUI's Dropdown on the frosted pop
 * surface, closed by a click outside it or Esc. `items` are
 * { id, title, subtitle?, leading?, trailing?, onSelect }; with none,
 * `empty` says why the list is empty.
 */
export function MenuButton({ icon, label, items, empty = null, className = '' }) {
    return (
        <Dropdown>
            <Dropdown.Trigger className={`gl-menu-trigger ${className}`}>
                <Icon name={icon} className="h-4 w-4" />
                {label}
                <Icon name="chevron-down" className="gl-menu-chevron h-4 w-4 transition-transform" />
            </Dropdown.Trigger>
            <Dropdown.Popover className="gl-pop pm-menu-pop" placement="bottom end">
                <Dropdown.Menu
                    aria-label={label}
                    className="max-h-80 overflow-y-auto"
                    onAction={(key) => items.find((item) => String(item.id) === String(key))?.onSelect()}
                    renderEmptyState={() => <p className="px-3 py-4 text-center text-sm text-gray-500">{empty}</p>}
                >
                    {items.map((item) => (
                        <Dropdown.Item key={item.id} id={String(item.id)} textValue={item.title} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm">
                            {item.leading}
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold text-gray-900">{item.title}</span>
                                {item.subtitle && <span className="block truncate text-xs text-gray-500">{item.subtitle}</span>}
                            </span>
                            {item.trailing}
                        </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
