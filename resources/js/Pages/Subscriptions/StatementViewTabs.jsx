import Icon from '@/Components/Icon';
import { STATEMENT_VIEWS } from '@/lib/accountStatement';

/** The statement's views as HeroUI's segmented control (components.css `gl-seg`): a grey track, the chosen view white on it. */
export default function StatementViewTabs({ value, onChange }) {
    return (
        <div role="group" aria-label="طريقة العرض" className="gl-seg">
            {STATEMENT_VIEWS.map((option) => {
                const active = option.value === value;

                return (
                    <button key={option.value} type="button" aria-pressed={active} title={option.hint} onClick={() => onChange(option.value)}>
                        <Icon name={option.value === 'compact' ? 'layers' : 'list'} className="h-4 w-4" />
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
