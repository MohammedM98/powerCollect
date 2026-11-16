import MaMark from '@/Components/MaMark';
import { SuperPowerMark } from '@/Components/SuperPowerMark';
import { useBrand } from '@/hooks/useBrand';

/**
 * The company's logo. The default identity draws the Super Power mark
 * inline in the company's colour (`markSize` in pixels); a company with a
 * logo of its own shows it, and one with a logo for dark backgrounds shows
 * that one in the dark theme (app.css hides the other).
 */
export default function BrandLogo({ className = '', alt, markSize = 36, ...props }) {
    const brand = useBrand();
    const { main, light } = brand.logos;
    const label = alt ?? `شعار ${brand.name}`;

    if (main === '/images/logo-ma.svg') {
        return <MaMark className={className} size={markSize} label={label} />;
    }

    if (main === '/images/logo-superpower.svg') {
        return <SuperPowerMark size={markSize} label={label} />;
    }

    if (light === main) {
        return <img src={main} alt={label} className={className} {...props} />;
    }

    return <>
        <img src={main} alt={label} className={`brand-logo-on-light ${className}`} {...props} />
        <img src={light} alt={label} className={`brand-logo-on-dark ${className}`} {...props} />
    </>;
}
