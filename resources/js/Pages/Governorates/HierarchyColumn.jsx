import { Button, Input } from '@heroui/react';
import { useState } from 'react';
import Icon from '@/Components/UI/Icon';
import InlineNameEditor from './InlineNameEditor';

/** Lists longer than this get their own search box. */
const SEARCHABLE_FROM = 6;

/**
 * One column of the governorates → areas → sub-areas browser: a header
 * with the count and "إضافة", an optional search box, then the rows. A
 * row is picked by click or Enter (`onPick`); the pencil renames it in
 * place and the bin asks to delete it. Adding also happens in place, at
 * the top of the list.
 *
 * `items` is null while the column above has nothing picked; `waiting`
 * ({ title, text }) then says what to do. `search`/`onSearchChange` hand the search box to
 * the caller (a server-side search); without them the rows are filtered
 * here. On narrow screens only the `active` column shows, with `onBack`
 * leading to the one before it.
 */
export default function HierarchyColumn({
    title,
    noun,
    items,
    total,
    waiting,
    selectedId = null,
    onPick,
    subtitle,
    canAdd = false,
    createRequest,
    updateRequest,
    onMore,
    onDelete,
    search,
    onSearchChange,
    emptyText,
    active,
    onBack,
    footer,
}) {
    const [localSearch, setLocalSearch] = useState('');
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const searchesOnServer = onSearchChange !== undefined;
    const query = (searchesOnServer ? search : localSearch).trim();
    const visible = items && !searchesOnServer && query ? items.filter((item) => item.name.includes(query)) : items;
    const count = total ?? items?.length ?? 0;

    return (
        <section className={`min-w-0 flex-col border-(--ma-line) lg:flex lg:border-s lg:first:border-s-0 ${active ? 'flex' : 'hidden'}`}>
            <div className="flex items-center gap-3 px-4 pb-2 pt-3">
                {onBack && (
                    <Button data-raw="" variant="ghost"
                        onClick={onBack}
                        aria-label="رجوع"
                        className="grid h-9 w-9 place-items-center rounded-lg border border-(--ma-line) bg-(--ma-solid) text-(--ma-ink) lg:hidden"
                    >
                        <Icon name="chevron-right" className="h-4 w-4" strokeWidth={2} />
                    </Button>
                )}
                <h2 className="font-luxe text-lg font-bold text-(--ma-ink)">{title}</h2>
                {items && <small className="font-display text-[13.5px] font-semibold text-(--ma-ink)">{count}</small>}
                {items && canAdd && (
                    <Button data-raw="" variant="ghost"
                        onClick={() => {
                            setAdding(true);
                            setEditingId(null);
                        }}
                        className="ms-auto inline-flex h-9 items-center gap-2 rounded-lg border border-(--ma-split) bg-(--ma-split-s) px-3 text-xs font-bold text-(--ma-split) transition hover:brightness-95"
                    >
                        <Icon name="plus" className="h-4 w-4" strokeWidth={2} />
                        إضافة
                    </Button>
                )}
            </div>

            {!items ? (
                <Empty title={waiting.title} text={waiting.text} />
            ) : (
                <>
                    {(count > SEARCHABLE_FROM || query) && (
                        <div className="px-3 pb-2">
                            <Input
                                type="search"
                                value={searchesOnServer ? search : localSearch}
                                onChange={(event) => (searchesOnServer ? onSearchChange : setLocalSearch)(event.target.value)}
                                placeholder="بحث"
                                aria-label={`بحث في ${title}`}
                                className="h-10 w-full rounded-control border-(--ma-line) bg-(--ma-tile) px-3 text-sm focus:border-(--ma-brand) focus:bg-(--ma-solid) focus:ring-0"
                            />
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto px-2 pb-2 pt-1 lg:max-h-136">
                        {adding && <InlineNameEditor placeholder={`اسم ${noun}`} request={createRequest} onDone={() => setAdding(false)} />}

                        {visible.map((item) =>
                            editingId === item.id ? (
                                <InlineNameEditor
                                    key={item.id}
                                    initialName={item.name}
                                    placeholder={`اسم ${noun}`}
                                    request={updateRequest(item)}
                                    onDone={() => setEditingId(null)}
                                    onMore={
                                        onMore &&
                                        (() => {
                                            setEditingId(null);
                                            onMore(item);
                                        })
                                    }
                                />
                            ) : (
                                <Row
                                    key={item.id}
                                    item={item}
                                    selected={selectedId === item.id}
                                    onPick={onPick}
                                    subtitle={subtitle?.(item)}
                                    onEdit={() => {
                                        setEditingId(item.id);
                                        setAdding(false);
                                    }}
                                    onDelete={onDelete}
                                />
                            ),
                        )}

                        {visible.length === 0 && !adding && (
                            <Empty title={query ? 'لا توجد نتائج' : emptyText} text={query ? null : canAdd ? 'اضغط «إضافة» في الأعلى.' : null} />
                        )}
                    </div>

                    {footer}
                </>
            )}
        </section>
    );
}

/**
 * One place in the column. The name is the button that opens it, stretched
 * across the row, so the edit and delete buttons sit beside it rather than
 * inside it.
 */
function Row({ item, selected, onPick, subtitle, onEdit, onDelete }) {
    const pickable = Boolean(onPick);
    const pick = () => onPick?.(item);
    const name = (
        <>
            <b className={`block truncate text-sm font-bold ${selected ? 'text-(--ma-brand)' : 'text-(--ma-ink)'} ${pickable ? 'group-hover:text-(--ma-brand)' : ''}`}>{item.name}</b>
            {subtitle && <small className="block text-xs text-(--ma-muted)">{subtitle}</small>}
        </>
    );

    return (
        <div
            className={`group flex w-full items-center gap-3 rounded-control border px-3 py-2 text-start transition ${
                selected
                    ? 'border-(--ma-brand) bg-(--ma-brand-soft) shadow-[inset_-3px_0_0_rgb(var(--brand-500))]'
                    : `border-transparent ${pickable ? 'cursor-pointer hover:border-(--ma-brand) hover:bg-(--ma-brand-soft)' : ''}`
            }`}
        >
            {pickable ? (
                <Button data-raw="" variant="ghost"
                    aria-pressed={selected}
                    onClick={pick}
                    className="min-w-0 flex-1 self-stretch rounded text-start focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ma-brand)"
                >
                    {name}
                </Button>
            ) : (
                <span className="min-w-0">{name}</span>
            )}
            <span className="ms-auto flex items-center gap-1">
                {item.canUpdate && <RowIconButton label={`تعديل ${item.name}`} icon="pencil" visible={selected} onClick={onEdit} />}
                {item.canDelete && onDelete && (
                    <RowIconButton label={`حذف ${item.name}`} icon="trash" visible={selected} onClick={() => onDelete(item)} />
                )}
                {pickable && (
                    <Icon
                        name="chevron-left"
                        className={`h-4 w-4 ${selected ? 'text-(--ma-brand)' : 'text-(--ma-faint) group-hover:text-(--ma-brand)'}`}
                        strokeWidth={2}
                    />
                )}
            </span>
        </div>
    );
}

/** The pencil / bin on a row: shown on hover, focus and on the picked row — always on touch screens. */
function RowIconButton({ label, icon, visible, onClick }) {
    return (
        <Button data-raw="" variant="ghost"
            aria-label={label}
            title={label}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
            className={`grid h-8 w-8 place-items-center rounded-lg text-(--ma-muted) transition hover:bg-(--ma-solid) hover:text-(--ma-brand) focus:opacity-100 group-hover:opacity-100 max-lg:opacity-100 ${
                visible ? 'opacity-100' : 'opacity-0'
            }`}
        >
            <Icon name={icon} className="h-4 w-4" />
        </Button>
    );
}

function Empty({ title, text }) {
    return (
        <div className="px-4 py-8 text-center text-sm text-(--ma-muted)">
            <b className="mb-1 block text-(--ma-ink)">{title}</b>
            {text}
        </div>
    );
}
