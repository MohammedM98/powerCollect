/** The logo's S (traced from the company's logo, on a 1254-unit canvas), with its notch for the bolt. */
const LETTER = 'M260 247H1001L843 469H566L1007 798L787 1031H257L434 824H642V772H539L566 722L260 508Z';

/** The lightning bolt cut through the S, in the tile's blue. */
const BOLT = 'M700 455L515 795H645L605 1045L820 725H683Z';

/**
 * The Power Collect mark: a blue rounded tile holding the white S with a
 * lightning bolt cut through it in the tile's blue, in both themes. Flat,
 * readable from 16px. `draw`
 * traces the S in when it appears (still when motion is off). An empty
 * `label` marks it decorative, hidden from screen readers, for a mark beside
 * text that already names the company.
 */
export function SuperPowerMark({ size = 36, draw = false, label = 'شعار سوبر باور' }) {
    return (
        <svg className={`gl-mark ${draw ? 'is-drawing' : ''}`} width={size} height={size} viewBox="127 127 1000 1000" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
            <rect className="gl-mark-tile" x="127" y="127" width="1000" height="1000" rx="270" />
            <path className="gl-mark-letter" d={LETTER} />
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
