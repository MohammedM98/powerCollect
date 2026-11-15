/**
 * A status pill (components.css `gl-pill`): its label in the
 * status colour over a 15% tint of it, so it never reads by colour alone.
 */
const TONES = {
    green: 'gl-ok',
    gray: '',
    amber: 'gl-warn',
    red: 'gl-bad',
    blue: 'gl-info',
};

export default function StatusPill({ tone = 'gray', label }) {
    return (
        <span data-tone={tone} className={`ui-badge gl-pill ${TONES[tone] ?? ''}`}>
            {label}
        </span>
    );
}
