import { Button } from '@heroui/react';
import Icon from '@/Components/UI/Icon';
import { useTableDensity } from '@/hooks/useTableDensity';

const DENSITIES = [
    { value: 'comfortable', icon: 'rows-comfortable', label: 'صفوف مريحة' },
    { value: 'compact', icon: 'rows-compact', label: 'صفوف مضغوطة' },
];

/**
 * Switches every table between comfortable rows (floating cards) and
 * compact rows (about twice as many on screen); the choice is remembered.
 */
export default function DensityToggle() {
    const [density, setDensity] = useTableDensity();

    return (
        <div role="group" aria-label="كثافة الصفوف" className="inline-flex gap-1 rounded-control border border-(--ma-line) bg-(--ma-tile) p-1">
            {DENSITIES.map((option) => (
                <Button data-raw="" variant="ghost"
                    key={option.value}
                    aria-pressed={density === option.value}
                    aria-label={option.label}
                    title={option.label}
                    onClick={() => setDensity(option.value)}
                    className={`flex h-7 w-8 items-center justify-center rounded-lg transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--ma-ink) ${
                        density === option.value ? 'bg-(--ma-solid) text-(--ma-ink) shadow-xs' : 'text-(--ma-faint) hover:text-(--ma-ink)'
                    }`}
                >
                    <Icon name={option.icon} className="h-4 w-4" />
                </Button>
            ))}
        </div>
    );
}
