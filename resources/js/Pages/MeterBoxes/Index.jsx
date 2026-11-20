import { Fragment, useEffect, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import SettingsLayout from '@/Layouts/SettingsLayout';
import AddButton from '@/Components/AddButton';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import DataTableSortControls from '@/Components/DataTable/DataTableSortControls';
import { BranchFilterBanner, splitBranchFilter } from '@/Components/BranchBanner';
import SortableTh from '@/Components/DataTable/SortableTh';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import RowIdentity from '@/Components/DataTable/RowIdentity';
import Pagination from '@/Components/DataTable/Pagination';
import ActionsTh from '@/Components/DataTable/ActionsTh';
import Icon from '@/Components/Icon';
import { Button, ToggleButton } from '@heroui/react';
import SegmentedChoice from '@/Components/SegmentedChoice';
import { Figure } from '@/Components/UI';
import { formatNumber } from '@/lib/format';
import { useDataTable } from '@/hooks/useDataTable';
import { useDeleteRecord } from '@/hooks/useDeleteRecord';
import { useRowClick } from '@/hooks/useRowClick';
import MeterBoxModal from './MeterBoxModal';
import MeterBoxSubscriptions from './MeterBoxSubscriptions';
import './meter-boxes.css';
import PageHeader from '@/Components/PageHeader';
import SearchableSelect from '@/Components/SearchableSelect';
import { readingPrintUrl } from '@/Components/PrintButton';
import { queryString } from '@/lib/pageUrl';

const SUBSCRIPTION_DIRECTION_KEY = 'meter-box-subscription-direction';
const SUBSCRIPTION_SORT_KEY = 'meter-box-subscription-sort';
const SUBSCRIPTION_ORDERS = [
    { value: 'name:asc', label: 'الاسم: من أ إلى ي' },
    { value: 'name:desc', label: 'الاسم: من ي إلى أ' },
    { value: 'account_number:asc', label: 'رقم الحساب: تصاعدي' },
    { value: 'account_number:desc', label: 'رقم الحساب: تنازلي' },
];
let handledReload = false;

/** The order of the subscribers inside every box, as last chosen in this browser. */
function readSubscriptionOrder() {
    try {
        const sort = localStorage.getItem(SUBSCRIPTION_SORT_KEY) === 'account_number' ? 'account_number' : 'name';
        const direction = localStorage.getItem(SUBSCRIPTION_DIRECTION_KEY) === 'desc' ? 'desc' : 'asc';

        return { sort, direction };
    } catch {
        // Use the default order when browser storage is unavailable.
        return { sort: 'name', direction: 'asc' };
    }
}

/**
 * The boxes in figures (before the quick filter, so each keeps its count):
 * those with subscribers out of all, their subscribers, the empty ones and
 * the areas they sit in.
 */
function MeterBoxSummary({ summary }) {
    const used = summary.total - summary.empty;

    return (
        <div className="gl-rp-figs gl-sub-figs">
            <Figure dark label="الطبلونات المستخدمة" hint={`من ${formatNumber(summary.total)} طبلون ضمن البحث والتصفية`}>{formatNumber(used)}</Figure>
            <Figure tone="clr" label="المشتركون عليها" hint={`${formatNumber(summary.active)} مشترك فعّال`} role="group" aria-label="إحصائية المشتركون الفعّالون">{formatNumber(summary.subscriptions)}</Figure>
            <Figure tone={summary.empty > 0 ? 'warn' : null} label="طبلونات بلا مشتركين" hint="طبلونات لا يرتبط بها أي مشترك" role="group" aria-label="إحصائية طبلونات بلا مشتركين">{formatNumber(summary.empty)}</Figure>
            <Figure tone="disc" label="مناطق الطبلونات" hint={`${formatNumber(summary.located)} طبلون ضمن هذه المناطق${summary.total > summary.located ? `، ${formatNumber(summary.total - summary.located)} بلا منطقة` : ''}`} role="group" aria-label="إحصائية مناطق الطبلونات">{formatNumber(summary.regions)}</Figure>
        </div>
    );
}

/** Which boxes the list shows: those with subscribers, the empty ones, or all, each with its count. */
function OccupancyFilter({ summary, value, onChange }) {
    return (
        <div className="gl-sub-quick">
            <SegmentedChoice
                label="الطبلونات المعروضة"
                value={value ?? ''}
                onChange={onChange}
                options={[
                    { value: '', label: <>الكل <span className="gl-sub-count">{formatNumber(summary.total)}</span></> },
                    { value: 'used', label: <>بها مشتركون <span className="gl-sub-count">{formatNumber(summary.total - summary.empty)}</span></> },
                    { value: 'empty', label: <>فارغة <span className="gl-sub-count">{formatNumber(summary.empty)}</span></> },
                ]}
            />
        </div>
    );
}

export default function Index({
    meterBoxes,
    canCreate,
    branches,
    canChooseBranch,
    canCreateSubArea,
    governorates,
    areas,
    subAreas,
    currentBranchAreaId,
    filters,
    filterOptions,
    branchScope,
    selectedBranch,
    summary,
    groupByRegion,
    canViewSubscriptions,
    canRecordReadings,
    canSendMessages,
}) {
    const [modalMeterBox, setModalMeterBox] = useState(null);
    const [creating, setCreating] = useState(false);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [collapsedIds, setCollapsedIds] = useState(new Set());
    const [expandingAll, setExpandingAll] = useState(false);
    const [subscriptionOrder, setSubscriptionOrder] = useState(readSubscriptionOrder);

    function sortSubscriptions(value) {
        const [sort, direction] = value.split(':');
        setSubscriptionOrder({ sort, direction });
        try {
            localStorage.setItem(SUBSCRIPTION_SORT_KEY, sort);
            localStorage.setItem(SUBSCRIPTION_DIRECTION_KEY, direction);
        } catch {
            // The order still applies to every box during this visit.
        }
    }

    useEffect(() => {
        if (handledReload) return;
        handledReload = true;
        const navigation = performance.getEntriesByType('navigation')[0];
        const current = new URL(window.location.href);
        const tableParams = [...current.searchParams.keys()].some((key) => ['search', 'sort', 'direction', 'per_page', 'page'].includes(key) || key.startsWith('filter['));
        if (navigation?.type === 'reload' && navigation.name === current.href && tableParams && !current.searchParams.has('print') && !current.searchParams.has('excel')) {
            router.get(current.pathname, {}, { replace: true, preserveState: false });
        }
    }, []);
    const rowClick = useRowClick();
    const { requestDelete, deleteDialog } = useDeleteRecord('الطبلون');
    // Grouped by region, the server lists each region's boxes together so a region doesn't split across pages.
    const groupParams = groupByRegion ? { group: 'region' } : {};
    const { search, setSearch, sort, sortBy, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable('/meter-boxes', filters, groupParams);
    const { props: { can }, url: pageUrl } = usePage();
    const canPrint = can?.printAuditReports !== false;
    const subscriptionsPrintHref = () => readingPrintUrl('الطبلونات ومشتركوها', `/meter-boxes/subscriptions-print${queryString(pageUrl)}`, { subscription_sort: subscriptionOrder.sort, subscription_direction: subscriptionOrder.direction });

    function toggleGroupByRegion() {
        router.get('/meter-boxes', { search, sort: filters.sort, direction: filters.direction, per_page: filters.per_page, filter: filterValues, group: groupByRegion ? undefined : 'region' }, { preserveState: true, preserveScroll: true, replace: true });
    }
    // The Super Admin picks the branch in the banner above the list, not among the filters; clearing those keeps it.
    const branchFilter = splitBranchFilter(branchScope, filterOptions, filterValues);
    const isExpanded = (id) => expandingAll ? !collapsedIds.has(id) : expandedIds.has(id);
    const allExpanded = meterBoxes.data.length > 0 && meterBoxes.data.every((box) => isExpanded(box.id));
    const anyExpanded = meterBoxes.data.some((box) => isExpanded(box.id));
    const regionGroups = groupByRegion
        ? [...meterBoxes.data.reduce((groups, box) => {
            const key = box.sub_area_id ?? 'none';
            if (!groups.has(key)) groups.set(key, { id: key, name: box.subAreaName || 'بلا منطقة', boxes: [] });
            groups.get(key).boxes.push(box);
            return groups;
        }, new Map()).values()]
        : [{ id: 'all', boxes: meterBoxes.data }];

    function toggleExpanded(id) {
        const change = (current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        };
        if (expandingAll) setCollapsedIds(change); else setExpandedIds(change);
    }

    function expandAll() {
        setExpandingAll(true);
        setCollapsedIds(new Set());
    }

    function collapseAll() {
        setExpandingAll(false);
        setExpandedIds(new Set());
        setCollapsedIds(new Set());
    }

    return (
        <SettingsLayout
            scope={branchScope?.name ?? null}
            header={
                <PageHeader title="الطبلونات" info={canViewSubscriptions ? 'كل طبلون برقمه ومنطقته. افتح الصف لعرض المشتركين وترتيب أسمائهم.' : null} actions={canCreate && <AddButton onClick={() => setCreating(true)}>طبلون جديد</AddButton>} />
            }
        >
            <Head title="الطبلونات" />
            {branchScope && <BranchFilterBanner scope={selectedBranch ? { ...branchScope, place: null } : branchScope} eyebrow="تعرض الآن طبلونات" group={branchFilter.branch} value={filterValues.branch_id} onChange={(value) => setFilter('branch_id', value)} />}

            {summary && <MeterBoxSummary summary={summary} />}
            {summary && <OccupancyFilter summary={summary} value={filterValues.occupancy} onChange={(value) => setFilter('occupancy', value)} />}

            <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="بحث بالاسم أو رقم الطبلون..."
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={meterBoxes.total}
                filterMenu={
                    <DataTableFilterMenu
                        tableKey="meter_boxes"
                        groups={branchFilter.groups}
                        values={branchFilter.values}
                        onChange={setFilter}
                        onChangeMany={setFilters}
                        onClear={() => branchFilter.clear(setFilters, clearFilters)}
                    >
                        <DataTableSortControls
                            id="meter-boxes"
                            label="ترتيب الطبلونات"
                            sort={filters.sort}
                            direction={filters.direction}
                            onChange={sortBy}
                            options={[
                                { value: 'box_number', label: 'رقم الطبلون' },
                                { value: 'name', label: 'اسم الطبلون', type: 'name' },
                                { value: 'subscriptions_count', label: 'عدد المشتركين' },
                                { value: 'created_at', label: 'تاريخ الإضافة' },
                            ]}
                        />
                        {canViewSubscriptions && <div role="group" aria-label="ترتيب مشتركي جميع الطبلونات">
                            <label htmlFor="all-meter-box-subscriptions-direction" className="sr-only">ترتيب المشتركين</label>
                            <SearchableSelect
                                id="all-meter-box-subscriptions-direction"
                                variant="pill"
                                prefix={<span className="gl-filter-name" aria-hidden="true"><Icon name="users" className="h-[15px] w-[15px]" />ترتيب المشتركين:</span>}
                                className="gl-filter-item"
                                value={`${subscriptionOrder.sort}:${subscriptionOrder.direction}`}
                                onChange={sortSubscriptions}
                                options={SUBSCRIPTION_ORDERS}
                                clearable={false}
                                searchable={false}
                                portal
                            />
                        </div>}
                    </DataTableFilterMenu>
                }
            />

            <div className="mb-3 flex flex-wrap items-center gap-2">
                {canViewSubscriptions && <>
                    <Button variant="secondary" onPress={expandAll} isDisabled={meterBoxes.data.length === 0 || allExpanded}><Icon name="chevron-down" className="h-4 w-4" />توسيع الكل</Button>
                    <Button variant="secondary" onPress={collapseAll} isDisabled={!anyExpanded}><Icon name="chevron-down" className="h-4 w-4 rotate-180" />طي الكل</Button>
                </>}
                <ToggleButton className="gl-sub-debtors gl-box-group" isSelected={groupByRegion} onChange={toggleGroupByRegion}><Icon name="pin" className="h-4 w-4" />تجميع حسب المنطقة</ToggleButton>
                {canViewSubscriptions && canPrint && <a href={subscriptionsPrintHref()} onClick={(event) => { event.currentTarget.href = subscriptionsPrintHref(); }} target="_blank" rel="noopener noreferrer" className="button button--secondary button--md tone-print" title="طباعة كل طبلون تحت منطقته ومشتركوه تحته، بنفس البحث والتصفية وترتيب المشتركين"><Icon name="printer" className="h-4 w-4" />طباعة الطبلونات مع المشتركين</a>}
                {canViewSubscriptions && <span className="text-xs text-gray-500">التوسيع يعرض مشتركي طبلونات الصفحة الحالية، ويستمر عند الانتقال للصفحة التالية.</span>}
            </div>

            <div className="data-table-container">
                <table className="data-table meter-box-table w-full text-sm text-start" aria-label="الطبلونات ومشتركوها">
                    <thead>
                        <tr>
                            <SortableTh column="name" label="الطبلون" sortState={filters} onSort={sort} />
                            <th>{selectedBranch ? 'منطقة الطبلون' : 'الموقع / المنطقة'}</th>
                            <th>الفرع</th>
                            <SortableTh column="subscriptions_count" label="المشتركون" sortState={filters} onSort={sort} />
                            <ActionsTh />
                        </tr>
                    </thead>
                    <tbody>
                        {meterBoxes.data.length === 0 ? (
                            <tr>
                                <td className="text-gray-500" colSpan={5}>
                                    لا توجد نتائج مطابقة.
                                </td>
                            </tr>
                        ) : (
                            regionGroups.map((region) => <Fragment key={region.id}>
                                {groupByRegion && <tr className="meter-box-region-header"><td colSpan={5}>
                                    <div className="flex flex-wrap items-center gap-3 text-sm">
                                        <Icon name="pin" className="h-5 w-5 text-brand-600" />
                                        {region.id === 'none' ? <b>{region.name}</b> : <Button data-raw="" variant="ghost" onClick={() => setFilter('sub_area_id', String(region.id))} className="font-bold text-gray-900 underline-offset-4 hover:text-brand-600 hover:underline" aria-label={`عرض طبلونات ${region.name}`}>{region.name}</Button>}
                                        <span className="rounded-control bg-surface px-2.5 py-1 text-[13.5px] font-semibold text-gray-700">{formatNumber(region.boxes.length)} طبلون في هذه الصفحة</span>
                                    </div>
                                </td></tr>}
                                {region.boxes.map((meterBox) => (
                                <Fragment key={meterBox.id}>
                                <tr className={isExpanded(meterBox.id) ? 'meter-box-expanded' : undefined} {...rowClick(canViewSubscriptions ? () => toggleExpanded(meterBox.id) : meterBox.canUpdate ? () => setModalMeterBox(meterBox) : null)}>
                                    <td data-label="الطبلون">
                                        <RowIdentity icon="table" name={meterBox.display_name || meterBox.box_number} subtitle={meterBox.display_name ? meterBox.box_number : undefined} />
                                    </td>
                                    <td data-label={selectedBranch ? 'منطقة الطبلون' : 'الموقع / المنطقة'}>
                                        <p className="text-sm font-semibold text-gray-700">{selectedBranch ? meterBox.subAreaName || '—' : meterBox.location || meterBox.subAreaName || '—'}</p>
                                        {!selectedBranch && <p className="mt-0.5 text-xs text-gray-500">{[meterBox.governorateName, meterBox.areaName, meterBox.subAreaName].filter(Boolean).join(' / ') || '—'}</p>}
                                        {selectedBranch && meterBox.location && meterBox.location !== meterBox.subAreaName && <p className="mt-0.5 text-xs text-gray-500">{meterBox.location}</p>}
                                    </td>
                                    <td data-label="الفرع" className="text-gray-600">{meterBox.branchName}</td>
                                    <td data-label="المشتركون">
                                        <p className="text-sm font-semibold text-gray-900"><b className="font-display">{formatNumber(meterBox.subscriptionsCount)}</b> مشترك</p>
                                        {meterBox.subscriptionsCount > 0 && <>
                                            <div className="my-1.5 flex h-1.5 w-28 overflow-hidden rounded-full bg-gray-100" aria-hidden="true"><span className="bg-emerald-500" style={{ width: `${meterBox.activeSubscriptionsCount / meterBox.subscriptionsCount * 100}%` }} /></div>
                                            <p className="text-xs text-gray-500">{meterBox.activeSubscriptionsCount} فعّال، {meterBox.subscriptionsCount - meterBox.activeSubscriptionsCount} غير فعّال</p>
                                        </>}
                                    </td>
                                    <td data-actions="" className="text-end">
                                        <div className="flex items-center justify-end gap-2">
                                        {canViewSubscriptions && <Button data-raw="" variant="ghost" className="row-action row-action-quiet" aria-expanded={isExpanded(meterBox.id)} aria-controls={`meter-box-subscriptions-${meterBox.id}`} aria-label={`${isExpanded(meterBox.id) ? 'إخفاء' : 'عرض'} مشتركي ${meterBox.box_number}`} title="المشتركون" onClick={() => toggleExpanded(meterBox.id)}><Icon name="chevron-down" className={`h-4 w-4 transition-transform ${isExpanded(meterBox.id) ? 'rotate-180' : ''}`} /></Button>}
                                        {(meterBox.canUpdate || meterBox.canDelete) && (
                                            <RowActionsMenu>
                                                {meterBox.canDelete && (
                                                    <Button data-raw="" variant="ghost" type="submit" onClick={() => requestDelete(`/meter-boxes/${meterBox.id}`, meterBox.display_name)}>حذف</Button>
                                                )}
                                                {meterBox.canUpdate && <Button data-raw="" variant="ghost" type="submit" onClick={() => setModalMeterBox(meterBox)}>تعديل</Button>}
                                            </RowActionsMenu>
                                        )}
                                        </div>
                                    </td>
                                </tr>
                                {canViewSubscriptions && isExpanded(meterBox.id) && <tr className="meter-box-detail"><td colSpan={5}>
                                    <MeterBoxSubscriptions key={`${meterBox.id}-${meterBox.subscriptionsCount}-${filters.search}-${filters.sort}`} meterBox={meterBox} sort={subscriptionOrder.sort} direction={subscriptionOrder.direction} canRecordReadings={canRecordReadings} canSendMessages={canSendMessages} />
                                </td></tr>}
                                </Fragment>
                            ))}</Fragment>)
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination meta={meterBoxes} filters={filters} baseUrl="/meter-boxes" extraParams={groupParams} />

            <MeterBoxModal
                key={`new-${selectedBranch?.id ?? 'all'}`}
                show={creating}
                onClose={() => setCreating(false)}
                meterBox={null}
                branches={branches}
                canChooseBranch={canChooseBranch && !selectedBranch}
                canCreateSubArea={canCreateSubArea}
                branchId={selectedBranch?.id}
                governorates={governorates}
                areas={areas}
                subAreas={subAreas}
                currentBranchAreaId={selectedBranch?.area_id ?? currentBranchAreaId}
            />

            {/* Keyed by meter box id so switching who's being edited remounts
                the form with fresh initial values — useForm() only captures
                its initial data once, it won't pick up a changed `meterBox`
                prop on an already-mounted instance. */}
            {modalMeterBox && (
                <MeterBoxModal
                    key={modalMeterBox.id}
                    show
                    onClose={() => setModalMeterBox(null)}
                    meterBox={modalMeterBox}
                    branches={branches}
                    canChooseBranch={canChooseBranch && !selectedBranch}
                    canCreateSubArea={canCreateSubArea}
                    branchId={selectedBranch?.id}
                    governorates={governorates}
                    areas={areas}
                    subAreas={subAreas}
                    currentBranchAreaId={selectedBranch?.area_id ?? currentBranchAreaId}
                />
            )}

            {deleteDialog}
        </SettingsLayout>
    );
}
