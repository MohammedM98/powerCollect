import Icon from '@/Components/UI/Icon';
import SearchableSelect from '@/Components/UI/SearchableSelect';

/**
 * A table's order as the redesign's pills: what it is sorted by, then which way.
 * Each keeps its name as its label for screen readers and tests.
 */
export default function DataTableSortControls({ id, label, sort, direction, options, onChange, sortLabel = 'ترتيب حسب', directionLabel = 'الاتجاه' }) {
    const type = options.find((option) => option.value === sort)?.type;
    const directionOptions = [
        { value: 'asc', label: type === 'name' ? 'من أ إلى ي' : 'تصاعديًا' },
        { value: 'desc', label: type === 'name' ? 'من ي إلى أ' : 'تنازليًا' },
    ];

    return (
        <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${id}-sort`} className="sr-only">{sortLabel}</label>
            <SearchableSelect id={`${id}-sort`} variant="pill" prefix={<span className="gl-filter-name" aria-hidden="true"><Icon name="sort" className="h-[15px] w-[15px]" />{sortLabel}:</span>} className="gl-filter-item" value={sort} onChange={(value) => onChange(value, direction)} options={options} searchable={false} clearable={false} portal />
            <label htmlFor={`${id}-direction`} className="sr-only">{directionLabel}</label>
            <SearchableSelect id={`${id}-direction`} variant="pill" className="gl-filter-item" value={direction} onChange={(value) => onChange(sort, value)} options={directionOptions} searchable={false} clearable={false} portal />
        </div>
    );
}
