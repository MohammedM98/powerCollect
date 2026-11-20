import { Label, Switch as HeroSwitch } from '@heroui/react';
import InfoTip from '@/Components/InfoTip';

/**
 * An on/off switch with a visible label: HeroUI's Switch (its thumb slides
 * toward the end, left in Arabic). `ariaLabel` gives screen readers the
 * full name when the visible label is short, e.g. "المشتركون: عرض" for a
 * switch labelled "عرض". `hint` is what turning it off or on means, kept
 * behind an "!" beside the label.
 */
export default function Switch({ checked, onChange, label, ariaLabel, hint = null, disabled = false }) {
    const control = (
        <HeroSwitch isSelected={Boolean(checked)} onChange={onChange} isDisabled={disabled} aria-label={ariaLabel} className="gl-set-switch gl-switch-row">
            <HeroSwitch.Content>
                <HeroSwitch.Control><HeroSwitch.Thumb /></HeroSwitch.Control>
                {label && <Label>{label}</Label>}
            </HeroSwitch.Content>
        </HeroSwitch>
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
