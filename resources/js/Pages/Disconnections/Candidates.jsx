import { Button, TextArea } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import RowIdentity from '@/Components/DataTable/RowIdentity';
import Pagination from '@/Components/DataTable/Pagination';
import DialogFrame from '@/Components/UI/DialogFrame';
import FormField from '@/Components/Form/FormField';
import ChoiceChips from '@/Components/UI/ChoiceChips';
import InputError from '@/Components/UI/InputError';
import Icon from '@/Components/UI/Icon';
import Balance from '@/Components/Finance/Balance';
import { useDataTable } from '@/hooks/useDataTable';
import ResultReport from './ResultReport';
import PageHeader from '@/Components/PageHeader';
import DateInput from '@/Components/UI/DateInput';
import { CheckBox, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, Notice, PrimaryKey, SecondaryKey, StatusPill } from '@/Components/UI';

/** The reason, note and date for the chosen subscribers, after saying how many. */
function AddModal({ list, selection, count, reasonOptions, today, onClose, onDone }) {
    const { errors } = usePage().props;
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(today);
    const [saving, setSaving] = useState(false);

    function submit(event) {
        event.preventDefault();
        setSaving(true);
        router.post(`/disconnection-lists/${list.id}/items`, { ...selection, reason, note, scheduled_for: date }, { preserveScroll: true, onSuccess: onDone, onError: (found) => found.ids && onDone(), onFinish: () => setSaving(false) });
    }

    const footer = (
        <>
            <SecondaryKey onClick={onClose}>إلغاء</SecondaryKey>
            <PrimaryKey type="submit" form="add-form" disabled={saving || !reason || !date}>{saving ? 'جارٍ الإضافة…' : `إضافة ${count.toLocaleString('en')} مشترك`}</PrimaryKey>
        </>
    );

    return (
        <DialogFrame
            show
            onClose={onClose}
            title={`إضافة إلى «${list.title}»`}
            description={<><b className="text-(--ma-ink)"><bdi dir="ltr">{count.toLocaleString('en')}</bdi></b> مشترك{selection.all ? ' (كل النتائج المطابقة للفلاتر في كل الصفحات)' : ' محدد'}. من لا يمكن إدراجه (مدرج في قائمة أخرى أو خدمته غير فعّالة) يُستثنى ويظهر في التقرير.</>}
            icon="plus"
            maxWidth="lg"
            busy={saving}
            footer={footer}
        >
            <form id="add-form" onSubmit={submit} className="space-y-4">
                <div>
                    <ChoiceChips options={reasonOptions} value={reason} onChange={setReason} label="سبب القطع" required name="reason" />
                    <InputError message={errors.reason} className="mt-1" />
                </div>
                <FormField id="add-note" label={`ملاحظة ${reason === 'other' ? '(يُفضّل توضيح السبب)' : '(اختياري)'}`} error={errors.note}>
                    <TextArea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="block w-full text-sm" maxLength={1000} />
                </FormField>
                <FormField id="add-date" label="موعد القطع المخطط" required error={errors.scheduled_for} hint="الموعد للتخطيط فقط: لا يُقطع أحد ولا تُرسل رسائل تلقائيًا.">
                    <DateInput name="scheduled_for" min={today} value={date} onChange={setDate} required />
                </FormField>
            </form>
        </DialogFrame>
    );
}

/**
 * The branch's active subscribers to pick from for a disconnection list,
 * found by name, area, meter box or what they owe. Debt helps find them but
 * never decides: anyone may be listed with a reason.
 */
export default function Candidates({ list, subscriptions, reasonOptions, today, filters, filterOptions }) {
    const { flash } = usePage();
    const { search, setSearch, sort, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable(`/disconnection-lists/${list.id}/candidates`, filters);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [allMatching, setAllMatching] = useState(false);
    const [adding, setAdding] = useState(false);
    const [result, setResult] = useState(null);
    const headerCheckbox = useRef(null);
    const pageIds = subscriptions.data.filter((row) => !row.waitingOn).map((row) => row.id);
    const pageSelectedCount = pageIds.filter((id) => selectedIds.has(id)).length;
    const selectionCount = allMatching ? subscriptions.total : selectedIds.size;
    const selection = allMatching ? { all: true, search: filters.search, filter: filters.filter } : { ids: [...selectedIds] };
    const filtersKey = JSON.stringify([filters.search, filters.filter]);

    useEffect(() => {
        if (flash?.disconnectionResult) {
            setResult(flash.disconnectionResult);
        }
    }, [flash]);

    useEffect(() => {
        setSelectedIds(new Set());
        setAllMatching(false);
    }, [filtersKey]);

    useEffect(() => {
        if (headerCheckbox.current) {
            headerCheckbox.current.indeterminate = !allMatching && pageSelectedCount > 0 && pageSelectedCount < pageIds.length;
        }
    });

    function toggle(id) {
        setAllMatching(false);
        setSelectedIds((current) => {
            const next = new Set(current);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function togglePage() {
        setAllMatching(false);
        setSelectedIds((current) => {
            const next = new Set(current);
            const everyChosen = pageIds.every((id) => next.has(id));
            pageIds.forEach((id) => (everyChosen ? next.delete(id) : next.add(id)));
            return next;
        });
    }

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    eyebrow={<><Link href="/disconnection-lists" className="hover:underline">قوائم القطع</Link> / <Link href={`/disconnection-lists/${list.id}`} className="hover:underline">{list.title}</Link></>}
                    title="إضافة مشتركين إلى القائمة"
                    info={`مشتركو ${list.branchName} الفعّالون. اختر واحدًا أو أكثر، أو كل النتائج المطابقة للفلاتر.`}
                />
            }
        >
            <Head title={`إضافة مشتركين — ${list.title}`} />

            {result && <ResultReport result={result} onClose={() => setResult(null)} />}
            {list.isClosed && <Notice tone="warn" className="mb-4">القائمة مغلقة؛ أعد فتحها لإضافة مشتركين.</Notice>}

            <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="بحث بالاسم أو رقم الاشتراك أو الطبلون..."
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={subscriptions.total}
                printable={false}
                filterMenu={<DataTableFilterMenu tableKey="disconnection_candidates" groups={filterOptions} values={filterValues} onChange={setFilter} onChangeMany={setFilters} onClear={clearFilters} />}
            />

            {!allMatching && pageIds.length > 0 && pageSelectedCount === pageIds.length && subscriptions.total > pageIds.length && (
                <div role="status" className="flex flex-wrap items-center justify-center gap-2 bg-(--ma-brand-soft) px-4 py-2 text-sm text-(--ma-ink)">
                    تم تحديد <bdi dir="ltr">{pageIds.length.toLocaleString('en')}</bdi> مشترك في هذه الصفحة.
                    <Button data-raw="" variant="ghost" onClick={() => setAllMatching(true)} className="rounded font-semibold text-(--ma-brand) hover:underline">
                        تحديد كل النتائج المطابقة (<bdi dir="ltr">{subscriptions.total.toLocaleString('en')}</bdi>)
                    </Button>
                </div>
            )}

            <div className="data-table-container">
                <ListTable aria-label="المشتركون المتاحون للإضافة" sort={filters} onSort={sort}>
                    <ListHeader>
                        <ListColumn id="select" data-actions="" className="w-10">
                            <CheckBox slot={null} checked={allMatching || (pageIds.length > 0 && pageSelectedCount === pageIds.length)} indeterminate={!allMatching && pageSelectedCount > 0 && pageSelectedCount < pageIds.length} onChange={togglePage} aria-label="تحديد كل مشتركي هذه الصفحة" />
                        </ListColumn>
                        <ListColumn id="display_name" sortable isRowHeader>المشترك</ListColumn>
                        <ListColumn id="meter_box">الطبلون</ListColumn>
                        <ListColumn id="sub_area">منطقة 2</ListColumn>
                        <ListColumn id="balance" sortable>الرصيد</ListColumn>
                        <ListColumn id="lists">قوائم القطع</ListColumn>
                    </ListHeader>
                    <ListBody empty={<span className="text-(--ma-muted)">لا توجد نتائج مطابقة.</span>}>
                        {subscriptions.data.map((row) => (
                            <ListRow key={row.id} id={row.id} className={allMatching || selectedIds.has(row.id) ? 'bg-(--ma-brand-soft)' : undefined}>
                                <ListCell>
                                    <CheckBox slot={null} disabled={Boolean(row.waitingOn)} checked={!row.waitingOn && (allMatching || selectedIds.has(row.id))} onChange={() => toggle(row.id)} aria-label={`تحديد ${row.name}`} />
                                </ListCell>
                                <ListCell data-label="المشترك"><RowIdentity name={row.name} subtitle={row.accountNumber} subtitleDir="ltr" /></ListCell>
                                <ListCell data-label="الطبلون" className="text-(--ma-muted)">{row.meterBoxNumber ? <span className="data-chip">{row.meterBoxNumber}</span> : '—'}</ListCell>
                                <ListCell data-label="منطقة 2" className="text-(--ma-muted)">{row.subAreaName ?? '—'}</ListCell>
                                <ListCell data-label="الرصيد" className="whitespace-nowrap font-semibold"><Balance value={row.balance} /></ListCell>
                                <ListCell data-label="قوائم القطع">
                                    {row.waitingOn ? <StatusPill tone="amber" label={row.waitingOn.isThisList ? 'في هذه القائمة' : `في «${row.waitingOn.title}»`} /> : <span className="text-(--ma-faint)">—</span>}
                                </ListCell>
                            </ListRow>
                        ))}
                    </ListBody>
                </ListTable>
            </div>

            <Pagination meta={subscriptions} filters={filters} baseUrl={`/disconnection-lists/${list.id}/candidates`} />

            {selectionCount > 0 && !list.isClosed && (
                <>
                    <div className="h-24" aria-hidden="true" />
                    <div role="region" aria-label="إضافة المحددين" className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-2xl flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-gradient px-4 py-3 text-white shadow-lift">
                        <span className="text-sm" aria-live="polite">
                            <b className="font-display">{selectionCount.toLocaleString('en')}</b> {allMatching ? 'مشترك (كل النتائج المطابقة)' : 'مشترك محدد'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button data-raw="" variant="ghost" onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-control bg-white px-4 py-2 text-sm font-bold text-gray-900">
                                <Icon name="plus" className="h-4 w-4" />
                                إضافة إلى القائمة
                            </Button>
                            <Button data-raw="" variant="ghost" onClick={() => { setSelectedIds(new Set()); setAllMatching(false); }} aria-label="إلغاء التحديد" className="flex h-9 w-9 items-center justify-center rounded-control text-white/80 hover:bg-white/10">
                                <Icon name="close" className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </>
            )}

            {adding && (
                <AddModal
                    list={list}
                    selection={selection}
                    count={selectionCount}
                    reasonOptions={reasonOptions}
                    today={today}
                    onClose={() => setAdding(false)}
                    onDone={() => {
                        setAdding(false);
                        setSelectedIds(new Set());
                        setAllMatching(false);
                    }}
                />
            )}
        </AuthenticatedLayout>
    );
}
