import { Chip } from '@heroui/react';

/**
 * A status as HeroUI's Chip (components.css `gl-pill`): its label in the
 * status colour over a tint of it, with a dot, so it never reads by colour
 * alone.
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
        <Chip size="sm" variant="soft" data-tone={tone} className={`ui-badge gl-pill ${TONES[tone] ?? ''}`}>
            {label}
        </Chip>
    );
}
