import InfoTip from '@/Components/InfoTip';

/**
 * An on/off switch with a visible label
 * (components.css `gl-switch`), in the company's colour when on, its knob
 * sliding toward the end (left in Arabic). `ariaLabel` gives
 * screen readers the full name when the visible label is short, e.g.
 * "المشتركون: عرض" for a switch labelled "عرض". `hint` is what turning it
 * off or on means, kept behind an "!" beside the label.
 */
export default function Switch({ checked, onChange, label, ariaLabel, hint = null, disabled = false }) {
    const control = (
        <label
            className={`inline-flex select-none items-center gap-2.5 text-sm font-semibold ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
            style={{ color: 'var(--gl-ink)' }}
        >
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={ariaLabel}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className="ui-switch gl-switch"
                data-on={checked || undefined}
            >
                <span
                    aria-hidden="true"
                    className="ui-switch-knob gl-switch-knob"
                />
            </button>
            {label}
        </label>
    );

    return hint ? (
        <span className="inline-flex items-center gap-1">
            {control}
            <InfoTip label={`عن ${ariaLabel ?? label}`}>{hint}</InfoTip>
        </span>
    ) : (
        control
    );
}
