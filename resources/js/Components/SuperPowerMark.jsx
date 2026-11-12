/** The Super Power bolt, an "S" of two strokes leaning the same way (public/images/logo-superpower.svg). */
const BOLT = 'M37.5 9.5H24.8a2 2 0 0 0-1.86 1.27l-6.1 15.6A1.5 1.5 0 0 0 18.24 28.4H28l-5.3 15.8a.9.9 0 0 0 1.57.83l17.6-21.1A1.5 1.5 0 0 0 40.7 21.5H32.2l6.62-9.7A1.5 1.5 0 0 0 37.5 9.5z';

/**
 * The Super Power mark: a rounded square in the company's colour holding the
 * white bolt and its spark. One colour, no gradient or shadow, readable from
 * 16px. `draw` traces the bolt in when it appears (still when motion is off).
 * An empty `label` marks it decorative, hidden from screen readers, for a
 * mark beside text that already names the company.
 */
export function SuperPowerMark({ size = 36, draw = false, label = 'شعار سوبر باور' }) {
    return (
        <svg className={`gl-mark ${draw ? 'is-drawing' : ''}`} width={size} height={size} viewBox="0 0 56 56" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
            <rect className="gl-mark-tile" width="56" height="56" rx="16" />
            <path className="gl-mark-bolt" d={BOLT} />
            {draw && <path className="gl-mark-line" d={BOLT} pathLength="1" />}
            <circle className="gl-mark-node" cx="40.6" cy="45.2" r="2.6" />
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
