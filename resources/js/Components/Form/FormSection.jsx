import Icon from '@/Components/UI/Icon';
import InfoTip from '@/Components/UI/InfoTip';

const COLUMNS = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

/**
 * One group of a form: a small quiet name above it (with its icon, and an
 * "!" holding what the user must know about it, `info`), then its fields on
 * a grey tile, white on the tile, in a grid of `columns` (1, 2 or 3 across
 * on wide screens). `description` is a line under the name on what the
 * group holds.
 */
export default function FormSection({ icon, title, description = null, info, columns = 3, children, className = '' }) {
    return (
        <section className={`gl-section ${className}`}>
            <h2 className="gl-group-name">
                <span className="gl-group-icon"><Icon name={icon} /></span>
                <span className="gl-group-text">
                    <span>{title}</span>
                    {description && <small>{description}</small>}
                </span>
                {info && <InfoTip label={`عن ${title}`}>{info}</InfoTip>}
            </h2>
            <div className={`gl-tile grid gap-x-4 gap-y-4 ${COLUMNS[columns]}`}>{children}</div>
        </section>
    );
}
