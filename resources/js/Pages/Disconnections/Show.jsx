import { Button } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import RowIdentity from '@/Components/DataTable/RowIdentity';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import Pagination from '@/Components/DataTable/Pagination';
import Icon from '@/Components/UI/Icon';
import Balance from '@/Components/Finance/Balance';
import { useDataTable } from '@/hooks/useDataTable';
import { printFieldsProps, printRowProps } from '@/lib/print';
import { formatMoney, formatNumber, formatDate } from '@/lib/format';
import { itemTone } from '@/lib/disconnections';
import ActionModal from './ActionModal';
import HistoryModal from './HistoryModal';
import ResultReport from './ResultReport';
import PageHeader from '@/Components/PageHeader';
import { urlWithout } from '@/lib/pageUrl';
import { AddKey, CheckBox, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, SelectionBar, SelectionBarKey, StatusPill, secondaryButtonClass } from '@/Components/UI';


const PRINT_FIELDS = [
    { key: 'name', label: 'المشترك' },
    { key: 'accountNumber', label: 'رقم الاشتراك' },
    { key: 'meterBoxNumber', label: 'الطبلون' },
    { key: 'reasonLabel', label: 'السبب' },
    { key: 'scheduledFor', label: 'موعد القطع' },
    { key: 'balance', label: 'الرصيد' },
    { key: 'statusLabel', label: 'الحالة' },
];

function Stat({ label, value, tone = 'text-(--ma-ink)', hint }) {
    return (
        <div className="rounded-[18px] bg-(--ma-panel) px-4 py-3 shadow-(--ma-depth) [backdrop-filter:var(--ma-blur)]">
            <p className="text-[13.5px] font-semibold text-(--ma-muted)">{label}</p>
            <p className={`mt-1 font-display text-2xl font-bold ${tone}`}>{value}</p>
            {hint && <p className="mt-1 text-xs text-(--ma-muted)">{hint}</p>}
        </div>
    );
}

/**
 * One disconnection list: its subscribers with their reason, date, balance
 * now and warnings. Any of them — one, the ticked ones, or every match of
 * the filters across pages — can be given a new date, warned, removed, or
 * confirmed as disconnected, each action listing exactly whom it reaches
 * first and reporting how it went for each.
 */
export default function Show({ list, items, summary, abilities, reasonOptions, channelOptions, smsDeliversMessages, warningTemplates, defaultWarning, placeholders, today, usualFee, filters, filterOptions, history }) {
    const { flash, url: pageUrl } = usePage();
    const { search, setSearch, sort, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable(`/disconnection-lists/${list.id}`, filters);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [allMatching, setAllMatching] = useState(false);
    const [action, setAction] = useState(null);
    const [result, setResult] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(null);
    const headerCheckbox = useRef(null);
    const pageIds = items.data.map((item) => item.id);
    const pageSelectedCount = pageIds.filter((id) => selectedIds.has(id)).length;
    const selectionCount = allMatching ? items.total : selectedIds.size;
    const selection = allMatching ? { all: true, search: filters.search, filter: filters.filter } : { ids: [...selectedIds] };
    const canSelect = abilities.manage || abilities.warn || abilities.execute;
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

    function clearSelection() {
        setSelectedIds(new Set());
        setAllMatching(false);
    }

    /** An action on one row only. */
    function single(item, name) {
        setAllMatching(false);
        setSelectedIds(new Set([item.id]));
        setAction(name);
    }

    function openHistory(item) {
        setHistoryLoading(item.id);
        router.reload({ only: ['history'], data: { history: item.id }, onFinish: () => setHistoryLoading(null) });
    }

    function closeHistory() {
        setHistoryLoading(null);
        router.replace({ url: urlWithout(pageUrl, 'history'), props: (props) => ({ ...props, history: null }), preserveScroll: true, preserveState: true });
    }

    function toggleClosed() {
        router.patch(`/disconnection-lists/${list.id}`, { closed: !list.isClosed }, { preserveScroll: true });
    }

    function rowMenu(item) {
        const waiting = item.status === 'scheduled';

        return {
            title: item.name,
            subtitle: item.accountNumber,
            groups: [
                {
                    label: 'القائمة',
                    items: [
                        { label: 'سجل المشترك في القائمة', icon: 'history', tone: 'graphite', onSelect: () => openHistory(item) },
                        ...(abilities.manage && waiting ? [{ label: 'تغيير موعد القطع', icon: 'calendar', tone: 'blue', onSelect: () => single(item, 'reschedule') }] : []),
                        ...(abilities.warn && waiting ? [{ label: 'إرسال إنذار', icon: 'send', tone: 'sky', onSelect: () => single(item, 'warn') }] : []),
                        ...(abilities.execute && waiting ? [{ label: 'تأكيد تنفيذ القطع', icon: 'power', tone: 'red', onSelect: () => single(item, 'confirm') }] : []),
                        ...(abilities.manage && waiting ? [{ label: 'إزالة من القائمة', icon: 'undo', tone: 'amber', onSelect: () => single(item, 'remove') }] : []),
                    ],
                },
            ],
        };
    }

    return (
        <AuthenticatedLayout
            header={
                <>
                    <PageHeader
                        eyebrow={<><Link href="/disconnection-lists" className="hover:underline">قوائم القطع</Link> / {list.branchName}</>}
                        title={list.title}
                        titleAddon={list.isClosed && <StatusPill tone="gray" label="مغلقة" />}
                        meta={list.notes}
                    />
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {abilities.manageList && (
                            <Button data-raw="" variant="ghost" onClick={toggleClosed} className={secondaryButtonClass}>
                                <Icon name={list.isClosed ? 'unlock' : 'lock'} className="h-4 w-4" />
                                {list.isClosed ? 'إعادة فتح القائمة' : 'إغلاق القائمة'}
                            </Button>
                        )}
                        {abilities.manage && <AddKey href={`/disconnection-lists/${list.id}/candidates`}>إضافة مشتركين</AddKey>}
                    </div>
                </>
            }
        >
            <Head title={list.title} />

            {result && <ResultReport result={result} onClose={() => setResult(null)} />}

            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <Stat label="بانتظار القطع" value={formatNumber(summary.scheduled)} tone="text-(--ma-warn)" hint={`موعدهم اليوم: ${formatNumber(summary.dueToday)}`} />
                <Stat label="متأخر — بانتظار إجراء" value={formatNumber(summary.overdue)} tone="text-(--ma-owe)" hint="لا يُقطع أحد تلقائيًا" />
                <Stat label="تم قطعهم" value={formatNumber(summary.disconnected)} />
                <Stat label="أُزيلوا" value={formatNumber(summary.removed)} />
                <Stat label="إنذارات، تمديدات" value={`${formatNumber(summary.warnings)}، ${formatNumber(summary.extensions)}`} />
                <Stat label="رسوم القطع المحمّلة" value={`${formatMoney(summary.feesTotal)} ₪`} />
            </div>

            <div className="mb-6 flex flex-wrap gap-2 text-xs">
                {summary.reasons.map((reason) => (
                    <Button data-raw="" variant="ghost" key={reason.value} onClick={() => setFilter('reason', filterValues.reason === reason.value ? '' : reason.value)} aria-pressed={filterValues.reason === reason.value} className={`rounded-full border px-3 py-1 font-semibold ${filterValues.reason === reason.value ? 'border-(--ma-act) bg-(--ma-act) text-white' : 'border-(--ma-line) text-(--ma-muted) hover:bg-(--ma-tile)'}`}>
                        {reason.label} <b className="font-display">{formatNumber(reason.count)}</b>
                    </Button>
                ))}
            </div>

            <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="بحث بالاسم أو رقم الاشتراك أو الطبلون..."
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={items.total}
                filterMenu={
                    <div className="flex w-full flex-wrap items-center gap-2">
                        <DataTableFilterMenu tableKey="disconnection_items" groups={filterOptions} values={filterValues} onChange={setFilter} onChangeMany={setFilters} onClear={clearFilters} />
                    </div>
                }
            />

            {canSelect && !allMatching && pageIds.length > 0 && pageSelectedCount === pageIds.length && items.total > pageIds.length && (
                <div role="status" className="flex flex-wrap items-center justify-center gap-2 bg-(--ma-brand-soft) px-4 py-2 text-sm text-(--ma-ink)">
                    تم تحديد {pageIds.length.toLocaleString('en')} مشترك في هذه الصفحة.
                    <Button data-raw="" variant="ghost" onClick={() => setAllMatching(true)} className="rounded font-semibold text-(--ma-brand) hover:underline">
                        تحديد كل النتائج المطابقة ({items.total.toLocaleString('en')})
                    </Button>
                </div>
            )}

            <div className="data-table-container">
                <ListTable aria-label="مشتركو القائمة" sort={filters} onSort={sort} {...printFieldsProps(PRINT_FIELDS)}>
                    <ListHeader>
                        {canSelect && (
                            <ListColumn id="select" data-actions="" className="w-10">
                                <CheckBox slot={null} checked={allMatching || (pageIds.length > 0 && pageSelectedCount === pageIds.length)} indeterminate={!allMatching && pageSelectedCount > 0 && pageSelectedCount < pageIds.length} onChange={togglePage} aria-label="تحديد كل مشتركي هذه الصفحة" />
                            </ListColumn>
                        )}
                        <ListColumn id="name" isRowHeader>المشترك</ListColumn>
                        <ListColumn id="reason">السبب</ListColumn>
                        <ListColumn id="scheduled_for" sortable>موعد القطع</ListColumn>
                        <ListColumn id="balance" sortable>الرصيد</ListColumn>
                        <ListColumn id="warnings_count" sortable>الإنذارات</ListColumn>
                        <ListColumn id="status" sortable>الحالة</ListColumn>
                        <ListColumn actions />
                    </ListHeader>
                    <ListBody empty={<span className="text-(--ma-muted)">لا يوجد مشتركون مطابقون في هذه القائمة.</span>}>
                        {items.data.map((item) => (
                            <ListRow key={item.id} id={item.id} className={allMatching || selectedIds.has(item.id) ? 'bg-(--ma-brand-soft)' : undefined} {...printRowProps(Object.fromEntries(PRINT_FIELDS.map((field) => [field.key, item[field.key]])))}>
                                {canSelect && (
                                    <ListCell>
                                        <CheckBox checked={allMatching || selectedIds.has(item.id)} onChange={() => toggle(item.id)} aria-label={`تحديد ${item.name}`} />
                                    </ListCell>
                                )}
                                <ListCell data-label="المشترك">
                                    <RowIdentity name={item.name} subtitle={[item.accountNumber, item.meterBoxNumber && `طبلون ${item.meterBoxNumber}`].filter(Boolean).join('، ')} />
                                </ListCell>
                                <ListCell data-label="السبب" className="text-(--ma-ink)">
                                    {item.reasonLabel}
                                    {item.note && <span className="block max-w-[16rem] truncate text-xs text-(--ma-muted)" title={item.note}>{item.note}</span>}
                                </ListCell>
                                <ListCell data-label="موعد القطع" className="whitespace-nowrap">
                                    <span dir="ltr" className={item.isOverdue ? 'font-semibold text-(--ma-owe)' : 'text-(--ma-ink)'}>{formatDate(item.scheduledFor)}</span>
                                    {item.extensionsCount > 0 && <span className="block text-xs text-(--ma-muted)">مُدّد {formatNumber(item.extensionsCount)} مرة</span>}
                                </ListCell>
                                <ListCell data-label="الرصيد" className="whitespace-nowrap">
                                    <Balance value={item.balance} className="font-bold" />
                                    {item.isPaid && item.status === 'scheduled' ? (
                                        <span className="block"><StatusPill tone="green" label="سدّد — تحديث الرصيد" /></span>
                                    ) : item.balanceReduced ? (
                                        <span className="block text-xs text-(--ma-muted)">كان <Balance value={item.balanceWhenAdded} colored={false} /></span>
                                    ) : null}
                                </ListCell>
                                <ListCell data-label="الإنذارات" className="text-(--ma-ink)">
                                    {item.warningsCount > 0 ? (
                                        <>
                                            <b className="font-display">{formatNumber(item.warningsCount)}</b>
                                            <span className="block text-xs text-(--ma-muted)" dir="ltr">{item.lastWarnedAt}</span>
                                        </>
                                    ) : (
                                        <span className="text-(--ma-faint)">—</span>
                                    )}
                                </ListCell>
                                <ListCell data-label="الحالة">
                                    <StatusPill tone={itemTone(item)} label={item.isOverdue ? 'متأخر — بانتظار إجراء' : item.statusLabel} />
                                    {item.status === 'disconnected' && <span className="block text-xs text-(--ma-muted)">{item.disconnectedBy}، {formatMoney(item.fee)} ₪</span>}
                                    {item.status === 'removed' && item.removalReason && <span className="block text-xs text-(--ma-muted)">{item.removalReason}</span>}
                                    {item.status === 'scheduled' && !item.serviceIsActive && <span className="block text-xs text-(--ma-warn)">الخدمة: {item.serviceStatusLabel}</span>}
                                </ListCell>
                                <ListCell data-actions="" className="text-end">
                                    <RowActionsMenu onView={() => openHistory(item)} menu={rowMenu(item)} />
                                </ListCell>
                            </ListRow>
                        ))}
                    </ListBody>
                </ListTable>
            </div>

            <Pagination meta={items} filters={filters} baseUrl={`/disconnection-lists/${list.id}`} />

            {canSelect && selectionCount > 0 && !action && (
                <SelectionBar label="إجراءات على المشتركين المحددين" count={selectionCount} caption={allMatching ? 'مشترك (كل النتائج المطابقة)' : 'مشترك محدد'} onClear={clearSelection}>
                    {abilities.manage && <SelectionBarKey icon="calendar" label="تمديد / تغيير الموعد" onClick={() => setAction('reschedule')} />}
                    {abilities.warn && <SelectionBarKey icon="send" label="إنذار" onClick={() => setAction('warn')} />}
                    {abilities.execute && <SelectionBarKey icon="power" label="تأكيد القطع" tone="danger" onClick={() => setAction('confirm')} />}
                    {abilities.manage && <SelectionBarKey icon="undo" label="إزالة" onClick={() => setAction('remove')} />}
                </SelectionBar>
            )}

            {action && (
                <ActionModal
                    action={action}
                    list={list}
                    selection={selection}
                    count={selectionCount}
                    reasonOptions={reasonOptions}
                    channelOptions={channelOptions}
                    smsDeliversMessages={smsDeliversMessages}
                    warningTemplates={warningTemplates}
                    defaultWarning={defaultWarning}
                    placeholders={placeholders}
                    today={today}
                    usualFee={usualFee}
                    canChangeFee={abilities.changeFee}
                    onClose={() => setAction(null)}
                    onDone={() => {
                        setAction(null);
                        clearSelection();
                    }}
                />
            )}

            {(historyLoading || history) && <HistoryModal history={history} loading={historyLoading !== null && history?.id !== historyLoading} reasonOptions={reasonOptions} onClose={closeHistory} />}
        </AuthenticatedLayout>
    );
}
