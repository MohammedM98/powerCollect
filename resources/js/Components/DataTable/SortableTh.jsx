/**
 * A column header that sorts the table. The sorted column is highlighted.
 */
export default function SortableTh({ column, label, sortState, onSort, className = '' }) {
    const { sort, direction } = sortState;
    const active = sort === column;

    return (
        <th aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
            <button
                type="button"
                onClick={() => onSort(column)}
                className={`-mx-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-gray-900 ${
                    active ? 'text-gray-900' : 'hover:bg-gray-900/5 hover:text-gray-900'
                }`}
            >
                {label}
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 10l4-4 4 4"
                        className={active && direction === 'asc' ? 'text-brand-500' : active ? 'opacity-30' : 'opacity-50'}
                    />
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 14l4 4 4-4"
                        className={active && direction === 'desc' ? 'text-brand-500' : active ? 'opacity-30' : 'opacity-50'}
                    />
                </svg>
            </button>
        </th>
    );
}
