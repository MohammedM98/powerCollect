import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { router } from '@inertiajs/react';

// Drives a server-backed data table: debounces the search box into a
// request, and issues immediate requests for sort/page-size/filter
// changes. `filters` is the page's current filter state as echoed back by
// the controller (see App\Http\Concerns\FiltersDataTable), so sort/
// direction/filter always reflect what the last response actually applied.
// `extraParams` are merged into every request unchanged — e.g. a `selected`
// id another part of the same page depends on, so it survives search/sort/
// page-size/filter changes instead of being dropped.
const NO_FILTER = {};

export function useDataTable(url, filters, extraParams = {}, visitOptions = {}) {
    const serverFilter = filters.filter ?? NO_FILTER;
    const [search, setSearch] = useState(filters.search ?? '');
    const [filterValues, setFilterValues] = useState(serverFilter);
    const [appliedFilter, setAppliedFilter] = useState(serverFilter);
    const isFirstRun = useRef(true);

    // Each response's filter replaces the one picked while it loaded.
    if (appliedFilter !== serverFilter) {
        setAppliedFilter(serverFilter);
        setFilterValues(serverFilter);
    }

    const visitWithSearch = useEffectEvent((typed) => visit({ search: typed }));

    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }

        const timeout = setTimeout(() => visitWithSearch(search), 350);

        return () => clearTimeout(timeout);
    }, [search]);

    function visit(overrides = {}) {
        router.get(
            url,
            {
                ...extraParams,
                search,
                sort: filters.sort,
                direction: filters.direction,
                per_page: filters.per_page,
                filter: filterValues,
                ...overrides,
            },
            { preserveState: true, preserveScroll: true, replace: true, ...visitOptions },
        );
    }

    function sort(column) {
        const direction = filters.sort === column && filters.direction === 'asc' ? 'desc' : 'asc';
        visit({ sort: column, direction });
    }

    function sortBy(column, direction = 'asc') {
        visit({ sort: column, direction });
    }

    function setPerPage(perPage) {
        visit({ per_page: perPage });
    }

    function setPage(page) {
        visit({ page });
    }

    function setFilter(key, value) {
        setFilters({ [key]: value });
    }

    function setFilters(updates) {
        const next = { ...filterValues, ...updates };
        setFilterValues(next);
        visit({ filter: next });
    }

    function clearFilters() {
        setFilterValues({});
        visit({ filter: {} });
    }

    return { search, setSearch, sort, sortBy, setPage, setPerPage, filterValues, setFilter, setFilters, clearFilters };
}
