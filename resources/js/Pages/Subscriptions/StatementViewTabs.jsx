import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import Icon from '@/Components/UI/Icon';
import { STATEMENT_VIEWS } from '@/lib/accountStatement';

/** The statement's views as HeroUI's ToggleButtonGroup, drawn as the redesign's segmented control (components.css `gl-seg-group`). */
export default function StatementViewTabs({ value, onChange }) {
    return (
        <ToggleButtonGroup
            aria-label="طريقة العرض"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[value]}
            onSelectionChange={(keys) => {
                const [next] = keys;

                if (next) {
                    onChange(next);
                }
            }}
            className="gl-seg-group"
        >
            {STATEMENT_VIEWS.map((option) => (
                <ToggleButton key={option.value} id={option.value} aria-description={option.hint} className="gl-seg-item">
                    <Icon name={option.value === 'compact' ? 'layers' : 'list'} className="h-4 w-4" />
                    {option.label}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
