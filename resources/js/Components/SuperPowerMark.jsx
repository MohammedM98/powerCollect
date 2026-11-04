import { useId } from 'react';

/**
 * The Super Power symbol, on a 100-unit square: a disc split by the
 * lightning S into two equal halves that interlock (a half turn takes one
 * onto the other), the S left as light between them. One half is in the
 * company's colour, the other in its deeper shade (public/images/
 * logo-superpower.svg). `CHANNEL` is the S's line, its ends run out past
 * the disc so it cuts the disc in two.
 */
const CHANNEL = 'M110 24.1L40.76 24.1L31.24 57.7L68.76 42.3L59.24 75.9L-10 75.9';
const UPPER_SIDE = `${CHANNEL}L-10 -10L110 -10Z`;
const LOWER_SIDE = `${CHANNEL}L-10 110L110 110Z`;

/**
 * The wordmark's S: the same lightning S as one stroke with sharp turns,
 * its ends cut on the slant into points, on a 40-unit cap height.
 */
const S_PATH = 'M36 0.9H9.4L2.6 25.5L29.4 14.5L22.6 39.1H-4';
const S_CUT = 'M-6 -6H35L28.6 4H45V50H-3.6L4.6 36H-6Z';

/** The rest of the word, "UPERPOWER": geometric capitals of one light stroke, widely spaced. */
const LETTERS = [
    [43.5, 'M2.6 -2V25A12.4 12.4 0 0 0 27.4 25V-2'],
    [85, 'M2.6 -2V42M2.6 2.6H14A10.4 10.4 0 0 1 14 23.4H2.6'],
    [123.5, 'M2.6 -2V42M2.6 2.6H23M2.6 20H20M2.6 37.4H23'],
    [158, 'M2.6 -2V42M2.6 2.6H14A10.4 10.4 0 0 1 14 23.4H2.6M12 23.4L29.5 43'],
    [197.5, 'M2.6 -2V42M2.6 2.6H14A10.4 10.4 0 0 1 14 23.4H2.6'],
    [236, 'M20 2.6A17.4 17.4 0 1 1 20 37.4A17.4 17.4 0 1 1 20 2.6Z'],
    [287.5, 'M1.6 -3L13.5 44L25 11L36.5 44L48.4 -3'],
    [349, 'M2.6 -2V42M2.6 2.6H23M2.6 20H20M2.6 37.4H23'],
    [383.5, 'M2.6 -2V42M2.6 2.6H14A10.4 10.4 0 0 1 14 23.4H2.6M12 23.4L29.5 43'],
];

/**
 * The Super Power symbol (see CHANNEL). Two flat colours, no gradient or
 * shadow, readable from 16px. `draw` brings the two halves together when
 * it appears (already joined when motion is off).
 */
export function SuperPowerMark({ size = 36, draw = false, label = 'شعار سوبر باور' }) {
    const id = useId();

    return (
        <svg className={`gl-mark ${draw ? 'is-drawing' : ''}`} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
            <defs>
                <mask id={`${id}-gap`}>
                    <rect width="100" height="100" fill="#fff" />
                    <path d={CHANNEL} fill="none" stroke="#000" strokeWidth="6.8" strokeMiterlimit="20" />
                </mask>
                <clipPath id={`${id}-upper`}>
                    <path d={UPPER_SIDE} />
                </clipPath>
                <clipPath id={`${id}-lower`}>
                    <path d={LOWER_SIDE} />
                </clipPath>
            </defs>
            <g mask={`url(#${id}-gap)`}>
                <g className="gl-mark-half gl-mark-upper">
                    <circle cx="50" cy="50" r="46" clipPath={`url(#${id}-upper)`} />
                </g>
                <g className="gl-mark-half gl-mark-lower">
                    <circle cx="50" cy="50" r="46" clipPath={`url(#${id}-lower)`} />
                </g>
            </g>
        </svg>
    );
}

/**
 * The Super Power wordmark: SUPERPOWER in light, widely spaced geometric
 * capitals, its S the lightning S in the company's colour and the rest in
 * the text colour, so it reads on light and dark. `height` is in pixels
 * (the width follows); `strike` draws the S in once when it appears.
 */
export function SuperPowerWordmark({ height = 20, strike = false, label = 'Super Power', className = '' }) {
    const id = useId();

    return (
        <svg className={`gl-wordmark ${className}`} height={height} viewBox="-4 -3 418 47" role="img" aria-label={label}>
            <clipPath id={`${id}-s`}>
                <path d={S_CUT} />
            </clipPath>
            <path
                clipPath={`url(#${id}-s)`}
                className={`gl-wordmark-s ${strike ? 'is-drawing' : ''}`}
                d={S_PATH}
                pathLength="1"
                fill="none"
                strokeWidth="5.8"
                strokeMiterlimit="20"
            />
            <clipPath id={`${id}-cap`}>
                <rect width="416" height="40" />
            </clipPath>
            <g clipPath={`url(#${id}-cap)`} className="gl-wordmark-letters" fill="none" strokeWidth="5.2" strokeMiterlimit="10">
                {LETTERS.map(([offset, path]) => (
                    <path key={offset} transform={`translate(${offset} 0)`} d={path} />
                ))}
            </g>
        </svg>
    );
}

/** The symbol beside the name, with the wordmark under it (the default identity's lockup). */
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
