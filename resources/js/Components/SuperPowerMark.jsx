import { useId } from 'react';

/** The logo's S (from the company's logo, on a 1254-unit canvas). */
const LETTER = 'M260 247H1001L843 469H566L1007 798L787 1031H257L434 824H712L260 508Z';

/** The lightning bolt across the S. */
const BOLT = 'M745 400L505 815H655L600 1085L860 690H705Z';

/**
 * The Power Collect mark, cut out with no tile: the S in the text colour
 * (dark on a light page, white on a dark one) and the bolt in the
 * identity's teal, cut through the S with a transparent gap, so it sits on
 * any background. Readable from 16px. `draw` traces the S in when it
 * appears (still when motion is off). An empty `label` marks it decorative,
 * hidden from screen readers, for a mark beside text that already names
 * the company.
 */
export function SuperPowerMark({ size = 36, draw = false, label = 'شعار سوبر باور' }) {
    // useId() may hold characters a url(#…) reference can't, so the id keeps only letters and digits.
    const gap = `pc-mark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

    return (
        <svg className={`gl-mark ${draw ? 'is-drawing' : ''}`} width={size} height={size} viewBox="195 225 875 875" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
            <defs>
                <mask id={gap} maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
                    <rect width="1254" height="1254" fill="#fff" />
                    <path d={BOLT} fill="#000" stroke="#000" strokeWidth="56" strokeLinejoin="round" />
                </mask>
            </defs>
            <path className="gl-mark-letter" d={LETTER} mask={`url(#${gap})`} />
            <path className="gl-mark-bolt" d={BOLT} />
            {draw && <path className="gl-mark-line" d={LETTER} pathLength="1" />}
        </svg>
    );
}

/** The mark beside the name, with the English name under it (the default identity's lockup). */
export function SuperPowerLockup({ size = 36, name, nameEnglish, sub = true }) {
    return (
        <span className="gl-lockup">
            <SuperPowerMark size={size} label={`شعار ${name}`} />
            <span className="gl-lockup-name">
                <b dir="auto">{name}</b>
                {sub && nameEnglish && <small dir="ltr">{nameEnglish.toUpperCase()}</small>}
            </span>
        </span>
    );
}
