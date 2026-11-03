import BrandLogo from '@/Components/BrandLogo';
import { SuperPowerMark } from '@/Components/SuperPowerMark';
import { useBrand } from '@/hooks/useBrand';

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

    return <div className={`gl-halo ${className}`}><SuperPowerMark size={76} draw label={`شعار ${brand.name}`} /></div>;
}
