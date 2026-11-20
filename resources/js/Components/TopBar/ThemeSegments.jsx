import { Button } from '@heroui/react';
import Icon from '@/Components/Icon';
import { useTheme } from '@/hooks/useTheme';

const OPTIONS = [
    ['light', 'sun', 'فاتح'],
    ['dark', 'moon', 'داكن'],
    ['auto', 'theme-auto', 'تلقائي'],
];

/** Light, dark, or following the device: remembered in this browser. */
export default function ThemeSegments({ className = '' }) {
    const { preference, changePreference } = useTheme();

    return (
        <div role="group" aria-label="المظهر" className={`tn-segments grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 ${className}`}>
            {OPTIONS.map(([value, icon, label]) => (
                <Button data-raw="" variant="ghost" key={value} aria-pressed={preference === value} onClick={() => changePreference(value)}>
                    <Icon name={icon} />
                    {label}
                </Button>
            ))}
        </div>
    );
}
