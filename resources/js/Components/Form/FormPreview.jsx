import Icon from '@/Components/Icon';

/**
 * The record a form is filling in, as it will look in the lists: its
 * avatar in the company's colour, its name as it is being typed in, a line
 * under it and a few chips, and a small pill counting the required fields
 * already filled. `avatar` is the text or icon in the badge, `dotClass`
 * colours a status dot on it, and `subtitleDir="ltr"` keeps a number (a
 * phone, say) in its own direction. With `aside` it stands in its own
 * column beside the fields, under "هكذا سيظهر في القوائم", with `note`
 * under it.
 */
export default function FormPreview({ avatar, dotClass = null, title, subtitle = null, subtitleDir = undefined, chips = [], filled, total, aside = false, note = null }) {
    const complete = total > 0 && filled >= total;
    const card = (
        <div className="gl-record">
            <span className="gl-record-avatar" aria-hidden="true">
                {avatar}
                {dotClass && <i className={dotClass} />}
            </span>
            <div className="min-w-0 flex-1">
                <p dir="auto" className="gl-record-title">{title}</p>
                {subtitle && (
                    <p className="gl-record-sub" dir={subtitleDir} style={subtitleDir === 'ltr' ? { textAlign: 'right' } : undefined}>
                        {subtitle}
                    </p>
                )}
                {chips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {chips.map((chip) => (
                            <span key={chip} className="gl-pill">{chip}</span>
                        ))}
                    </div>
                )}
            </div>
            {total > 0 && (
                <span className="gl-pill gl-record-count" aria-live="polite" style={{ '--gl-c': complete ? 'var(--gl-ok)' : 'var(--gl-warn)' }}>
                    الحقول المطلوبة <b className="gl-num" dir="ltr">{filled}/{total}</b>
                </span>
            )}
        </div>
    );

    if (!aside) {
        return card;
    }

    return (
        <aside className="gl-preview-aside" aria-live="polite">
            <p>هكذا سيظهر في القوائم</p>
            {card}
            {note && <p className="gl-preview-note"><Icon name="info" />{note}</p>}
        </aside>
    );
}

/** How many of a form's required fields have a value. */
export function countFilled(data, requiredFields) {
    return requiredFields.filter((field) => String(data[field] ?? '').trim() !== '').length;
}
