import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';

/** The add look (components.css `gl-add`): teal, so adding is told apart from the screen's main action. */
export const addButtonClass = 'ui-btn-primary gl-btn gl-add';

/**
 * A "+ Add …" button. Renders a link when given `href`, otherwise a button
 * that calls `onClick`.
 */
export default function AddButton({ href, onClick, children }) {
    const content = (
        <>
            <Icon name="plus" className="h-4 w-4" strokeWidth={2} />
            {children}
        </>
    );

    return href ? (
        <Link href={href} prefetch className={addButtonClass}>
            {content}
        </Link>
    ) : (
        <button type="button" onClick={onClick} className={addButtonClass}>
            {content}
        </button>
    );
}
