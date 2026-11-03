import { useId } from 'react';
import BrandLogo from '@/Components/BrandLogo';
import { useBrand } from '@/hooks/useBrand';

/** The bolt inside the Super Power tile (public/images/logo-superpower.svg). */
const BOLT = 'M36 9 16 36h15l-3 19 20-28H34z';

/**
 * The company's logo on the sign-in screen. The default Super Power mark is
 * drawn in (see SuperPowerMark); another company's logo (brand:import)
 * rises into place.
 */
export default function AnimatedLogo({ className = '' }) {
    const brand = useBrand();

    if (!brand.animatedLogo) {
        return <div className={`af-logo af-logo--custom ${className}`}>
            <BrandLogo />
        </div>;
    }

    return <SuperPowerMark className={className} label={`شعار ${brand.name}`} />;
}

/**
 * The Super Power mark, drawn in when it appears: the tile rises in the
 * company's blue, the bolt traces itself and fills, then a glow breathes
 * behind it. Shown finished at once when motion is off (glass.css).
 */
export function SuperPowerMark({ className = '', label }) {
    const gradient = `gl-mark-${useId().replace(/[^\w-]/g, '')}`;

    return (
        <div className={`gl-mark ${className}`} role="img" aria-label={label}>
            <svg viewBox="0 0 64 64" aria-hidden="true">
                <defs>
                    <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" style={{ stopColor: 'rgb(var(--brand-soft))' }} />
                        <stop offset="1" style={{ stopColor: 'rgb(var(--brand-solid))' }} />
                    </linearGradient>
                </defs>
                <rect className="gl-mark-tile" width="64" height="64" rx="18" fill={`url(#${gradient})`} />
                <path className="gl-mark-fill" d={BOLT} />
                <path className="gl-mark-line" d={BOLT} pathLength="1" />
            </svg>
        </div>
    );
}
