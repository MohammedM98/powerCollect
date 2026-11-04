import { useId } from 'react';

/**
 * The Super Power "S": an angular S whose spine strikes like lightning, one
 * stroke with sharp turns and pointed ends. It is the mark's symbol and the
 * wordmark's first letter (public/images/logo-superpower.svg and
 * logo-superpower-wordmark.svg), drawn on a 40-unit cap height and reaching
 * a little above and below the capitals beside it.
 */
const S_PATH = 'M36 1.5H9.4L2.6 25.5L29.4 14.5L22.6 38.5H-4';

/** Cuts the S's two ends on the slant, so they finish in points. */
const S_CUT = 'M-6 -6H35L27.9 6.2H45V50H-3.6L5.1 33.8H-6Z';

/**
 * The rest of the word, "UPERPOWER", as geometric capitals of one stroke
 * weight: each letter's offset and its strokes, cut to the cap height.
 */
const LETTERS = [
    [41, 'M3.25 -2V25A11.75 11.75 0 0 0 26.75 25V-2'],
    [80, 'M3.25 -2V42M3.25 3.25H14A9.75 9.75 0 0 1 14 22.75H3.25'],
    [116, 'M3.25 -2V42M3.25 3.25H23M3.25 20H20M3.25 36.75H23'],
    [148, 'M3.25 -2V42M3.25 3.25H14A9.75 9.75 0 0 1 14 22.75H3.25M12 22.75L29.5 43'],
    [185, 'M3.25 -2V42M3.25 3.25H14A9.75 9.75 0 0 1 14 22.75H3.25'],
    [221, 'M20 3.25A16.75 16.75 0 1 1 20 36.75A16.75 16.75 0 1 1 20 3.25Z'],
    [270, 'M2.25 -3L13.5 44L25 11L36.5 44L47.75 -3'],
    [329, 'M3.25 -2V42M3.25 3.25H23M3.25 20H20M3.25 36.75H23'],
    [361, 'M3.25 -2V42M3.25 3.25H14A9.75 9.75 0 0 1 14 22.75H3.25M12 22.75L29.5 43'],
];

/** The S, cut to its pointed ends; `className` colours its stroke. */
function StrikeS({ clipId, weight, className, draw = false }) {
    return (
        <>
            <clipPath id={clipId}>
                <path d={S_CUT} />
            </clipPath>
            <path
                clipPath={`url(#${clipId})`}
                className={`${className} ${draw ? 'is-drawing' : ''}`}
                d={S_PATH}
                pathLength="1"
                fill="none"
                strokeWidth={weight}
                strokeMiterlimit="20"
            />
        </>
    );
}

/**
 * The Super Power mark: a rounded square in the company's colour holding the
 * white lightning S. One colour, no gradient or shadow, readable from 16px.
 * `draw` strikes the S in when it appears (still when motion is off).
 */
export function SuperPowerMark({ size = 36, draw = false, label = 'شعار سوبر باور' }) {
    const id = useId();

    return (
        <svg className={`gl-mark ${draw ? 'is-drawing' : ''}`} width={size} height={size} viewBox="0 0 56 56" role="img" aria-label={label}>
            <rect className="gl-mark-tile" width="56" height="56" rx="16" />
            <g transform="translate(28 28) scale(0.7045) translate(-16.8 -20)">
                <StrikeS clipId={`${id}-s`} weight={7.6} className="gl-mark-bolt" draw={draw} />
            </g>
        </svg>
    );
}

/**
 * The Super Power wordmark: SUPERPOWER in geometric capitals, its S the
 * lightning S in the company's colour and the rest in the text colour, so
 * it reads on light and dark. `height` is in pixels (the width follows);
 * `strike` draws the S in once when it appears.
 */
export function SuperPowerWordmark({ height = 20, strike = false, label = 'Super Power', className = '' }) {
    const id = useId();

    return (
        <svg className={`gl-wordmark ${className}`} height={height} viewBox="-4 -3 395 47" role="img" aria-label={label}>
            <StrikeS clipId={`${id}-s`} weight={7} className="gl-wordmark-s" draw={strike} />
            <clipPath id={`${id}-cap`}>
                <rect width="393" height="40" />
            </clipPath>
            <g clipPath={`url(#${id}-cap)`} className="gl-wordmark-letters" fill="none" strokeWidth="6.5" strokeMiterlimit="10">
                {LETTERS.map(([offset, path]) => (
                    <path key={offset} transform={`translate(${offset} 0)`} d={path} />
                ))}
            </g>
        </svg>
    );
}

/** The mark beside the name, with the wordmark under it (the default identity's lockup). */
export function SuperPowerLockup({ size = 36, name, sub = true }) {
    return (
        <span className="gl-lockup">
            <SuperPowerMark size={size} label={`شعار ${name}`} />
            <span className="gl-lockup-name">
                <b dir="auto">{name}</b>
                {sub && <SuperPowerWordmark height={9} className="gl-lockup-wordmark" />}
            </span>
        </span>
    );
}
