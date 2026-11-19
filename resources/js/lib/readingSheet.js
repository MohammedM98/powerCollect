/** Keep the current sheet following the branch's reading day; only history pins a date. */
export function readingWeekParams(week, latestWeek) {
    return week === latestWeek ? {} : { week };
}

export function readingStatusFilters(status) {
    return { entry: status === 'missing' ? 'missing' : '', approval: ['pending', 'approved'].includes(status) ? status : '' };
}

export function activeReadingStatus(filters) {
    if (filters.approval === 'pending' || filters.approval === 'approved') {
        return filters.entry === 'missing' ? null : filters.approval;
    }

    if (filters.entry === 'missing') {
        return 'missing';
    }

    return filters.entry === 'entered' ? null : 'all';
}

/**
 * What the sheet is filtered to, as "label: value" pairs in the filters'
 * order (branch, area, sub-area, meter box…), then the search: what the
 * pinned bar names while the filters are scrolled away.
 *
 * @returns {Array<{ key: string, label: string, value: string }>}
 */
export function activeFilterChips(groups, values, search = '') {
    const chips = (groups ?? [])
        .filter((group) => values?.[group.key])
        .map((group) => {
            const option = group.options.find((candidate) => String(candidate.value) === String(values[group.key]));

            return { key: group.key, label: group.label, value: option?.label ?? String(values[group.key]) };
        });

    return search?.trim() ? [...chips, { key: 'search', label: 'بحث', value: search.trim() }] : chips;
}

/**
 * A number of readings in correct Arabic: 1 قراءة، 2 قراءتان، 3–10
 * قراءات، 11 and on قراءة (and 103–110 قراءات again).
 */
export function countReadings(count) {
    const number = Number(count) || 0;
    const lastTwo = number % 100;
    const noun = number === 2 ? 'قراءتان' : number >= 3 && lastTwo >= 3 && lastTwo <= 10 ? 'قراءات' : 'قراءة';

    return `${number.toLocaleString('en')} ${noun}`;
}
