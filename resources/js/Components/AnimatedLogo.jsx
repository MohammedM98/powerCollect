import BrandLogo from '@/Components/BrandLogo';

/** The company's logo on the sign-in screen, rising into place. */
export default function AnimatedLogo({ className = '' }) {
    return <div className={`af-logo af-logo--custom ${className}`}>
        <BrandLogo />
    </div>;
}
