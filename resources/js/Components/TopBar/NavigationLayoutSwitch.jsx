import Icon from '@/Components/Icon';

const OPTIONS = [
    ['sidebar', 'layout-side', 'جانبي'],
    ['topbar', 'layout-top', 'علوي'],
];

/**
 * The side menu or the top bar, for this browser (hooks/useNavigationLayout.js).
 * `layout` is the one shown ('rail' counts as the side menu).
 */
export default function NavigationLayoutSwitch({ layout, onChange, className = '' }) {
    const current = layout === 'topbar' ? 'topbar' : 'sidebar';

    return (
        <div role="group" aria-label="شكل التنقل" className={`tn-segments tn-layout-switch inline-grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 ${className}`}>
            {OPTIONS.map(([value, icon, label]) => (
                <button key={value} type="button" aria-pressed={current === value} onClick={() => onChange(value)}>
                    <Icon name={icon} />
                    {label}
                </button>
            ))}
        </div>
    );
}
