import { Button } from '@heroui/react';
import { useSurface } from '@/hooks/useSurface';
import Icon from '@/Components/Icon';

/**
 * Solid or glass surfaces, as a two-part switch in the account menu:
 * the chosen look white on the grey track. Remembered in this browser.
 */
export default function SurfaceToggle({ className = '' }) {
    const { surface, changeSurface } = useSurface();
    const options = [
        { value: 'solid', label: 'مصمت', icon: 'rows-compact' },
        { value: 'glass', label: 'زجاجي', icon: 'layers' },
    ];

    return (
        <div role="group" aria-label="شكل الأسطح" className={`gl-seg tn-surface ${className}`}>
            {options.map((option) => (
                <Button key={option.value} aria-pressed={surface === option.value} onClick={() => changeSurface(option.value)}>
                    <Icon name={option.icon} className="h-[15px] w-[15px]" />
                    {option.label}
                </Button>
            ))}
        </div>
    );
}
