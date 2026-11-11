import { router } from '@inertiajs/react';
import Icon from '@/Components/Icon';

function pageNumbers(current, last) {
    const delta = 1;
    const range = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(last - 1, current + delta); i++) {
        range.push(i);
    }

    if (current - delta > 2) {
        range.unshift('…');
    }
    if (current + delta < last - 1) {
        range.push('…');
    }

    range.unshift(1);
    if (last > 1) {
        range.push(last);
    }

    return [...new Set(range)];
}

/**
 * "Showing 1–15 of 63" and the page switch. The current page is burgundy.
 * `pageParam` names the page in the address, for a second table on the
 * same page. A table whose rows are all in the page already pages itself
 * with `onPageChange` instead of a visit. On a phone the previous/next
 * buttons show only their arrows, so the switch stays on one line.
 */
export default function Pagination({ meta, filters, baseUrl, extraParams = {}, pageParam = 'page', onPageChange }) {
    const { current_page: current, last_page: last, from, to, total } = meta;

    if (total === 0) {
        return null;
    }

    function goTo(page) {
        if (onPageChange) {
            onPageChange(page);

            return;
        }
        router.get(baseUrl, { ...extraParams, ...filters, [pageParam]: page }, { preserveState: true, preserveScroll: true, replace: true });
    }

    const stepClass = 'disabled:cursor-not-allowed disabled:opacity-40';

    return (
        <div className="data-table-pagination flex flex-wrap items-center justify-between gap-3">
            <p className="gl-sub !m-0 !text-[13px]">
                عرض{' '}
                <b className="gl-num font-bold !text-[color:var(--gl-ink)]">
                    {from}–{to}
                </b>{' '}
                من <b className="gl-num font-bold !text-[color:var(--gl-ink)]">{total}</b>
            </p>

            {last > 1 && (
                <nav aria-label="صفحات الجدول" className="gl-seg gl-pager">
                    <button type="button" disabled={current === 1} onClick={() => goTo(current - 1)} className={stepClass}>
                        <Icon name="chevron-right" className="h-3.5 w-3.5" strokeWidth={2} />
                        <span className="max-sm:sr-only">السابق</span>
                    </button>

                    {pageNumbers(current, last).map((page, index) =>
                        page === '…' ? (
                            <span key={`ellipsis-${index}`} className="px-1.5 text-sm !text-[color:var(--gl-faint)]">
                                …
                            </span>
                        ) : (
                            <button
                                type="button"
                                key={page}
                                aria-current={page === current ? 'page' : undefined}
                                onClick={() => goTo(page)}
                                aria-pressed={page === current}
                                className="gl-num min-w-[2rem] justify-center"
                            >
                                {page}
                            </button>
                        ),
                    )}

                    <button type="button" disabled={current === last} onClick={() => goTo(current + 1)} className={stepClass}>
                        <span className="max-sm:sr-only">التالي</span>
                        <Icon name="chevron-left" className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                </nav>
            )}
        </div>
    );
}
