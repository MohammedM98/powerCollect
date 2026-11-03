import Icon from '@/Components/Icon';
import InfoTip from '@/Components/InfoTip';

const COLUMNS = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

/**
 * One part of a long form as its own card: an icon and a title (with an
 * "!" holding what the user must know about it, `info`), then its fields
 * in a grid of `columns` (1, 2 or 3 across on wide screens).
 */
export default function FormSection({ icon, title, info, columns = 3, children, className = '' }) {
    return (
        <section className={`gl-glass gl-panel ${className}`}>
            <div className="mb-4 flex items-center gap-3">
                <span className="gl-ico" style={{ color: 'rgb(var(--gl-brand))' }}>
                    <Icon name={icon} className="h-[18px] w-[18px]" />
                </span>
                <h4 className="text-base font-bold" style={{ fontFamily: 'var(--gl-head)' }}>{title}</h4>
                {info && <InfoTip label={`عن ${title}`}>{info}</InfoTip>}
            </div>
            <div className={`grid gap-x-6 gap-y-4 ${COLUMNS[columns]}`}>{children}</div>
        </section>
    );
}
