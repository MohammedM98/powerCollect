import Icon from '@/Components/Icon';
import InfoTip from '@/Components/InfoTip';

const COLUMNS = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

/**
 * One part of a long form as its own card (the component gallery's
 * section card): a tinted icon tile and a title (with an "!" holding what
 * the user must know about it, `info`), then its fields in a grid of
 * `columns` (1, 2 or 3 across on wide screens).
 */
export default function FormSection({ icon, title, info, columns = 3, children, className = '' }) {
    return (
        <section className={`gl-section ${className}`}>
            <div className="mb-4 flex items-center gap-2.5">
                <span className="gl-section-ico" aria-hidden="true">
                    <Icon name={icon} className="h-[17px] w-[17px]" />
                </span>
                <h2 className="text-base font-bold !font-[family-name:var(--gl-head)]">{title}</h2>
                {info && <InfoTip label={`عن ${title}`}>{info}</InfoTip>}
            </div>
            <div className={`grid gap-x-6 gap-y-4 ${COLUMNS[columns]}`}>{children}</div>
        </section>
    );
}
