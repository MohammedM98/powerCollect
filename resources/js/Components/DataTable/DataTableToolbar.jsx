import { useEffect, useRef } from 'react';
import { usePage } from '@inertiajs/react';
import { Button, Input } from '@heroui/react';
import Icon from '@/Components/UI/Icon';
import DensityToggle from './DensityToggle';
import TableExportActions from './TableExportActions';

export const PAGE_SIZES = [15, 25, 50, 100];

/**
 * The top of a table card, as in the redesign: search (press / to jump to
 * it, Esc to clear) with the table's tools at the line's end (the result
 * count, the row-density switch, the page-size switch and the print
 * button), and the filter pills on the line under them. Print opens the print
 * designer in a new tab with the table's search, sort and filters;
 * `printable={false}` hides the button.
 */
export default function DataTableToolbar({
    search,
    onSearchChange,
    placeholder = 'بحث...',
    perPage,
    onPerPageChange,
    total,
    showSearch = true,
    filterMenu,
    printable = true,
    actions,
}) {
    const searchRef = useRef(null);
    const canPrint = usePage().props.can?.printAuditReports !== false;

    useEffect(() => {
        if (!showSearch) {
            return;
        }

        function onKeyDown(event) {
            const typing = event.target.closest?.('input, textarea, select, [contenteditable="true"]');

            if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                searchRef.current?.focus();
            }
        }

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [showSearch]);

    return (
        <div className="data-table-toolbar flex flex-wrap items-center justify-between gap-3">
            {showSearch && (
                <div className="data-table-search relative w-full sm:w-auto sm:max-w-sm sm:flex-[1_1_240px]">
                    <Icon name="search" className="pointer-events-none absolute inset-y-0 inset-s-3.5 my-auto h-[18px] w-[18px] text-(--ma-faint)" />
                    <Input
                        ref={searchRef}
                        type="text"
                        aria-label={placeholder}
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape' && search) {
                                onSearchChange('');
                            }
                        }}
                        placeholder={placeholder}
                        className="block w-full py-2 field-room-end field-room-start text-sm"
                    />
                    <span className="kbd pointer-events-none absolute inset-y-0 inset-e-3 my-auto h-fit">/</span>
                </div>
            )}

            <div className="data-table-tools flex flex-wrap items-center gap-2">
                {typeof total === 'number' && (
                    <span className="inline-flex items-center gap-2 rounded-control border border-(--ma-line) bg-(--ma-tile) px-3 py-2 text-sm text-(--ma-muted)">
                        <b className="font-display font-bold text-(--ma-ink)">{total.toLocaleString('en')}</b>
                        نتيجة
                    </span>
                )}
                <DensityToggle />
                <div
                    role="group"
                    aria-label="عدد الصفوف في الصفحة"
                    className="inline-flex gap-1 rounded-control border border-(--ma-line) bg-(--ma-tile) p-1"
                >
                    {PAGE_SIZES.map((size) => (
                        <Button
                            key={size}
                            variant="ghost"
                            size="sm"
                            aria-pressed={perPage === size}
                            onPress={() => onPerPageChange(size)}
                            className={`rounded-lg px-3 py-1 font-display text-xs font-semibold transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--ma-ink) ${
                                perPage === size ? 'bg-(--ma-solid) text-(--ma-ink) shadow-xs' : 'text-(--ma-muted) hover:text-(--ma-ink)'
                            }`}
                        >
                            {size}
                        </Button>
                    ))}
                </div>
                <div data-table-export-slot className="ms-auto flex items-center empty:hidden">
                    {actions !== undefined ? actions : printable && canPrint && <TableExportActions />}
                </div>
            </div>

            {filterMenu}
        </div>
    );
}
