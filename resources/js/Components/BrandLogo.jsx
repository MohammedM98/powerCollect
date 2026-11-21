import { useBrand } from '@/hooks/useBrand';
import { useTheme } from '@/hooks/useTheme';

/**
 * The company's logo. A company with a logo for dark backgrounds shows that
 * one in the dark theme. `onDark` always shows the one for dark backgrounds,
 * for a logo on a dark card. Only the theme's own logo is drawn, so the
 * browser doesn't download the other one too (app.css still hides a logo
 * that is not the theme's while the theme changes).
 */
export default function BrandLogo({ className = '', alt, onDark = false, ...props }) {
    const brand = useBrand();
    const { dark } = useTheme();
    const { main, light } = brand.logos;
    const label = alt ?? `شعار ${brand.name}`;

    if (onDark) {
        return <img src={light ?? main} alt={label} className={className} {...props} />;
    }

    if (light === main) {
        return <img src={main} alt={label} className={className} {...props} />;
    }

    return dark
        ? <img src={light} alt={label} className={`brand-logo-on-dark ${className}`} {...props} />
        : <img src={main} alt={label} className={`brand-logo-on-light ${className}`} {...props} />;
}
