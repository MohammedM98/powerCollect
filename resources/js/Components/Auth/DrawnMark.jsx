import { useId } from 'react';
import BrandLogo from '@/Components/BrandLogo';
import { useBrand } from '@/hooks/useBrand';

/** The MA mark in its three parts: the M, the A and the stroke that closes it (public/images/logo-ma.svg). */
const MA_M = 'M0,100l0,-20.275c7.309,0.186 14.642,-0.149 22,-1.005v21.28zM0,0h24l26,52l26,-52l18.78,0l-15.534,51.781c-0.415,0.204 -0.831,0.406 -1.246,0.608v-12.388l-8.081,16.162c-11.385,5.11 -22.591,9.257 -33.617,12.442l-14.302,-28.604l0,32.217c-7.417,1.601 -14.75,2.755 -22,3.46zM58,80h-16l-2.181,-4.363c7.976,-1.829 15.982,-4.264 24.015,-7.305z';
const MA_A = 'M70,100l11.843,-39.477c9.629,-4.703 19.298,-10.268 29.008,-16.694l-3.652,12.172h15.6l-5.061,-16.87c6.497,-4.564 13.013,-9.512 19.547,-14.844l22.714,75.714h-24l-7.2,-24h-27.6l-7.2,24zM100,0h30l5.301,17.67c-6.696,4.827 -13.337,9.358 -19.923,13.591l-0.378,-1.261l-0.558,1.862c-9.805,6.266 -19.487,11.872 -29.046,16.819z';
const MA_STROKE = 'M193,-30c-16.821,19.011 -33.525,35.552 -50.113,49.624l-1.846,-6.154c16.967,-12.601 34.287,-27.091 51.959,-43.47z';

/** Whether the company's logo is the MA mark, which this screen can draw stroke by stroke. */
function isMaMark(brand) {
    return /\/logo-ma(-light)?\.svg$/.test(brand.logos.light ?? brand.logos.main ?? '');
}

/**
 * The company's mark on the sign-in screen. The MA mark draws itself: its
 * outline first, then the fill, the closing stroke last with a spark and a
 * sweep of light. Any other company's logo rises into place.
 */
export default function DrawnMark({ className = '' }) {
    const brand = useBrand();
    const id = useId().replace(/:/g, '');

    if (!isMaMark(brand)) {
        return <BrandLogo onDark className={`gl-auth-logo ${className}`} />;
    }

    return (
        <svg className={`gl-auth-draw ${className}`} viewBox="-8 -38 209 146" role="img" aria-label={`شعار ${brand.name}`}>
            <defs>
                <linearGradient id={`${id}-a`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#FF9A5C" />
                    <stop offset="1" stopColor="#E2642A" />
                </linearGradient>
                <linearGradient id={`${id}-sweep`} x1="0" x2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0" />
                    <stop offset=".5" stopColor="#fff" stopOpacity=".85" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <clipPath id={`${id}-clip`}>
                    <path d={MA_M} />
                    <path d={MA_A} />
                    <path d={MA_STROKE} />
                </clipPath>
            </defs>
            <path className="gl-auth-draw-m" pathLength="1" d={MA_M} />
            <path className="gl-auth-draw-a" pathLength="1" d={MA_A} fill={`url(#${id}-a)`} />
            <path className="gl-auth-draw-stroke" pathLength="1" d={MA_STROKE} />
            <g clipPath={`url(#${id}-clip)`}>
                <rect className="gl-auth-draw-sweep" x="-70" y="-40" width="36" height="150" fill={`url(#${id}-sweep)`} />
            </g>
            <circle className="gl-auth-draw-spark" cx="193" cy="-30" r="4" />
        </svg>
    );
}
