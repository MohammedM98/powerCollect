import { createContext, use, useEffect, useRef } from 'react';
import { Button, Table } from '@heroui/react';
import { TableStateContext } from 'react-aria-components';

/** The table's sort, read by its columns: `{ sort, direction }` as the page's filters hold it. */
const SortContext = createContext({ sort: null, onSort: null });

/**
 * The app's list table, built on HeroUI's Table (React Aria underneath) in
 * the MA look: the soft header on `--ma-tile`, `--ma-line` between rows and
 * phone cards from the `data-table` styles (app.css). The page keeps its own
 * container, toolbar and pagination around it.
 *
 *     <ListTable aria-label="المستخدمون" sort={filters} onSort={sort}>
 *         <ListHeader>
 *             <ListColumn id="name" sortable isRowHeader>الاسم</ListColumn>
 *             <ListColumn actions />
 *         </ListHeader>
 *         <ListBody empty="لا توجد نتائج مطابقة.">
 *             {rows.map((row) => <ListRow key={row.id} onOpen={() => open(row)}>…</ListRow>)}
 *         </ListBody>
 *     </ListTable>
 *
 * `sort` and `onSort(column)` drive the sortable columns (HeroUI's sorting;
 * the server does the ordering). Keys work as on a plain table (PageKeys).
 */
export default function ListTable({ sort = null, onSort, className = 'data-table w-full text-sm text-start', children, ...props }) {
    const descriptor = sort?.sort ? { column: sort.sort, direction: sort.direction === 'desc' ? 'descending' : 'ascending' } : undefined;

    return (
        <SortContext value={{ sort, onSort }}>
            <Table.Content
                {...props}
                className={className}
                sortDescriptor={descriptor}
                onSortChange={onSort ? (next) => onSort(String(next.column)) : undefined}
            >
                {children}
            </Table.Content>
        </SortContext>
    );
}

/** The header row: holds the table's `ListColumn`s. */
export function ListHeader({ className, children, ...props }) {
    return (
        <Table.Header {...props} className={className}>
            {children}
        </Table.Header>
    );
}

/**
 * Keys behave as on a plain page table: Tab walks through the keys and fields
 * in every row, and every key typed in a field reaches the window and the page
 * (Escape closes a window, shortcuts and activity keep working). React Aria's
 * grid would otherwise make the table one Tab stop and keep keys inside cells.
 */
function PageKeys() {
    const state = use(TableStateContext);

    useEffect(() => {
        state?.setKeyboardNavigationDisabled(true);
    }, [state]);

    return null;
}

/** The two sort arrows, the sorted direction in the brand colour. */
function SortArrows({ direction }) {
    return (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10l4-4 4 4" className={direction === 'ascending' ? 'text-brand-500' : direction ? 'opacity-30' : 'opacity-50'} />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 14l4 4 4-4" className={direction === 'descending' ? 'text-brand-500' : direction ? 'opacity-30' : 'opacity-50'} />
        </svg>
    );
}

/**
 * One column. `sortable` lets the header sort the table by `id`;
 * `isRowHeader` marks the column that names each row (one per table);
 * `actions` is the column over the row keys: no visible title, named
 * «الإجراءات» for screen readers, and left out of printouts and phone-card
 * titles (`data-actions`).
 */
export function ListColumn({ id, sortable = false, actions = false, className = '', children, ...props }) {
    const { sort, onSort: onSortColumn } = use(SortContext);

    if (actions) {
        return (
            <Table.Column {...props} id={id ?? 'actions'} data-actions="" className={className}>
                <PageKeys />
                <span className="sr-only">الإجراءات</span>
            </Table.Column>
        );
    }

    return (
        <Table.Column {...props} id={id} allowsSorting={sortable} data-sortable={sortable ? '' : undefined} className={className}>
            {({ sortDirection }) => (
                <>
                    <PageKeys />
                    {sortable ? (
                        // A real key, so the keyboard reaches and sorts the column as before.
                        <Button
                            data-raw=""
                            variant="ghost"
                            onPress={() => onSortColumn?.(id)}
                            className={`-mx-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-gray-900 ${sort?.sort === id ? 'text-gray-900' : 'hover:bg-gray-900/5 hover:text-gray-900'}`}
                        >
                            <Table.SortableColumnHeader sortDirection={sortDirection} showIndicator={false} className="inline-flex items-center gap-1.5">
                                {children}
                                <SortArrows direction={sortDirection} />
                            </Table.SortableColumnHeader>
                        </Button>
                    ) : (
                        children
                    )}
                </>
            )}
        </Table.Column>
    );
}

/** The rows. `empty` is shown across the whole table when there are none. */
export function ListBody({ empty = null, className, children, ...props }) {
    return (
        <Table.Body {...props} className={className} renderEmptyState={empty === null ? undefined : () => empty}>
            {children}
        </Table.Body>
    );
}

/** What already does its own thing when clicked inside a row. */
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="menu"], [role="button"], [role="checkbox"], [contenteditable="true"]';

/** How far the pointer may move between press and release and still open the row, not select its text. */
const CLICK_SLOP = 5;

/**
 * One row. `onOpen` opens the record when the row is clicked, as the page
 * tables always have: the row's own keys, links and fields keep their own
 * behaviour, and dragging to select text doesn't open it. Keys typed in the
 * row's fields stay with the fields. Without `onOpen` the row is plain.
 */
export function ListRow({ onOpen = null, className, children, ...props }) {
    const pressedAt = useRef(null);

    return (
        <Table.Row
            {...props}
            className={className}
            data-clickable={onOpen ? '' : undefined}
            onPointerDown={
                onOpen
                    ? (event) => {
                          pressedAt.current = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
                      }
                    : undefined
            }
            onPointerUp={
                onOpen
                    ? (event) => {
                          const start = pressedAt.current;
                          pressedAt.current = null;
                          const dragged = !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP;
                          // React passes events up from portals too (a row's menu, a window): only the row's own cells count.
                          const outsideRow = !event.currentTarget.contains(event.target);

                          if (dragged || outsideRow || event.target.closest(INTERACTIVE) || window.getSelection()?.toString()) {
                              return;
                          }

                          onOpen();
                      }
                    : undefined
            }
        >
            {children}
        </Table.Row>
    );
}

/** One cell. */
export function ListCell({ className, children, ...props }) {
    return (
        <Table.Cell {...props} className={className}>
            {children}
        </Table.Cell>
    );
}

/**
 * A row across the whole table: a band over a group (an area, a day, a
 * month), a record's opened details, or a note under a row. `columns` is the
 * table's column count.
 */
export function BandRow({ columns, className = 'data-table-group', cellClassName, children, ...props }) {
    return (
        <Table.Row {...props} className={className}>
            <Table.Cell colSpan={columns} className={cellClassName}>
                {children}
            </Table.Cell>
        </Table.Row>
    );
}
