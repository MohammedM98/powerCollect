import { useTheme } from '@/hooks/useTheme';
import Icon from '@/Components/Icon';

/**
 * Switches between the light and dark themes. The choice is
 * remembered in this browser; app.blade.php applies it before the page
 * paints so there is no flash.
 */
export default function ThemeToggle({ className = '' }) {
    const { dark, changePreference } = useTheme();

    function toggle(event) {
        const change = () => changePreference(dark ? 'light' : 'dark');
        const root = document.documentElement;
        if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            change();
            return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        const x = event.detail ? event.clientX : bounds.x + bounds.width / 2;
        const y = event.detail ? event.clientY : bounds.y + bounds.height / 2;
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        root.classList.add('gl-theme-reveal');
        const transition = document.startViewTransition(change);
        transition.ready.then(() => root.animate(
            { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
            { duration: 420, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
        )).catch(() => {});
        transition.finished.finally(() => root.classList.remove('gl-theme-reveal')).catch(() => {});
    }

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الغامق'}
            title={dark ? 'الوضع الفاتح' : 'الوضع الغامق'}
            className={`gl-ib ${className}`}
        >
            <Icon name={dark ? 'sun' : 'moon'} className="h-[18px] w-[18px]" />
        </button>
    );
}
