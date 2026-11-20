import { Card } from '@heroui/react';

/** One headline figure on a HeroUI card: `tone` colours its mark and number, `dark` puts it on the charcoal. */
export default function Figure({ label, children, hint = null, tone = null, dark = false, ...props }) {
    return (
        <Card className="gl-rp-fig" data-tone={tone ?? undefined} data-dark={dark || undefined} {...props}>
            <small>{tone && <i aria-hidden="true" />}{label}</small>
            <b>{children}</b>
            {hint && <p>{hint}</p>}
        </Card>
    );
}
