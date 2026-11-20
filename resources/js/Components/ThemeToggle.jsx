import { Button } from '@heroui/react';
import { useTheme } from '@/hooks/useTheme';
import Icon from '@/Components/Icon';

/**
 * Switches between the light (default) and dark theme. The choice is
 * remembered in this browser; app.blade.php applies it before the page
 * paints so there is no flash.
 */
export default function ThemeToggle({ className = '' }) {
    const { dark, changePreference } = useTheme();

    function toggle() {
        changePreference(dark ? 'light' : 'dark');
    }

    return (
        <Button
            onClick={toggle}
            aria-label={dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الغامق'}
            title={dark ? 'الوضع الفاتح' : 'الوضع الغامق'}
            className={`gl-ib ${className}`}
        >
            <Icon name={dark ? 'sun' : 'moon'} className="h-[18px] w-[18px]" />
        </Button>
    );
}
