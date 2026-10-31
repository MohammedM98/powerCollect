import { useBrand } from '@/hooks/useBrand';

/**
 * The company's logo. A company with a logo of its own for dark
 * backgrounds shows that one in the dark theme (app.css hides the other).
 */
export default function BrandLogo({ className = '', alt, ...props }) {
    const brand = useBrand();
    const { main, light } = brand.logos;
    const label = alt ?? `شعار ${brand.name}`;

    if (light === main) {
        return <img src={main} alt={label} className={className} {...props} />;
    }

    return <>
        <img src={main} alt={label} className={`brand-logo-on-light ${className}`} {...props} />
        <img src={light} alt={label} className={`brand-logo-on-dark ${className}`} {...props} />
    </>;
}
