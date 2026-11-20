import { useEffect, useState, useRef } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ConfirmDialog from '@/Components/ConfirmDialog';
import Icon from '@/Components/Icon';
import { Button, Checkbox } from '@heroui/react';
import SegmentedChoice from '@/Components/SegmentedChoice';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import SortableTh from '@/Components/DataTable/SortableTh';
import Pagination from '@/Components/DataTable/Pagination';
import SearchableSelect from '@/Components/SearchableSelect';
import { useDataTable } from '@/hooks/useDataTable';
import { formatMoney, formatMonthName } from '@/lib/format';
import { activeReadingStatus, countReadings, readingStatusFilters, readingWeekParams } from '@/lib/readingSheet';
import ReadingContextBar from './ReadingContextBar';
import ReadingApprovalDialog from './ReadingApprovalDialog';
import PrintButton from '@/Components/PrintButton';
import './ReadingEntry.css';
import ReadingSummary from './ReadingSummary';
import PageHeader from '@/Components/PageHeader';
import { EntryWindowNotice } from './EntryWindowNotice';
import { PRINT_FIELDS, SheetRow } from './ReadingSheetRow';
import { printFieldsProps } from '@/lib/print';

/**
 * What each sort is by, and how its two directions read: names go أ – ي or
 * ي – أ, kilowatts and amounts from the least or the most, numbers from the
 * smallest or the largest.
 */
const DIRECTION_LABELS = {
    text: { asc: 'أ – ي', desc: 'ي – أ' },
    amount: { asc: 'الأقل أولًا', desc: 'الأكثر أولًا' },
    number: { asc: 'الأصغر أولًا', desc: 'الأكبر أولًا' },
};

const SORT_OPTIONS = [
    { value: 'full_name', label: 'الاسم', type: 'text' },
    { value: 'meter_box', label: 'الطبلون (الاسم ثم الرقم)', type: 'text' },
    { value: 'meter_box_number', label: 'رقم الطبلون', type: 'number' },
    { value: 'last_reading', label: 'القراءة السابقة', type: 'amount' },
    { value: 'current_reading', label: 'القراءة الحالية', type: 'amount' },
    { value: 'consumption', label: 'الفرق (كيلو)', type: 'amount' },
    { value: 'amount_due', label: 'المطلوب دفعه', type: 'amount' },
    { value: 'account_number', label: 'رقم الاشتراك', type: 'number' },
];

const STATUS_TABS = [
    { value: 'all', label: 'الكل', count: 'total' },
    { value: 'missing', label: 'لم تُدخل', count: 'missing' },
    { value: 'pending', label: 'بانتظار الاعتماد', count: 'pending' },
    { value: 'approved', label: 'معتمدة', count: 'approved' },
];

const fullDate = (date) => date.split('-').reverse().join('/');

/**
 * @param {import('@/types/pages').MeterReadingsIndexProps} props
 */
export default function Index({
    rows,
    week,
    weekEnd,
    weekOptions,
    summary,
    statusSummary,
    canRecord,
    canApprove,
    canSendReadingMessages,
    messageBranchId,
    seesWhoRecorded,
    pendingApproval,
    weekIsViewOnly,
    entryWindow,
    filters,
    filterOptions,
}) {
    const weekParams = readingWeekParams(week, weekOptions[0]?.value);
    const { search, setSearch, sort, sortBy, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable('/meter-readings', filters, weekParams, {
        only: ['rows', 'filters', 'filterOptions', 'week', 'weekEnd', 'weekOptions', 'summary', 'statusSummary', 'pendingApproval', 'can', 'canRecord', 'canApprove', 'canSendReadingMessages', 'messageBranchId', 'seesWhoRecorded', 'weekIsViewOnly', 'entryWindow'],
    });
    // The readings ticked for approval, and which approval is waiting on "are you sure?" ('selected' or 'all').
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [confirming, setConfirming] = useState(null);
    const [approving, setApproving] = useState(false);
    const [singleApprovalId, setSingleApprovalId] = useState(null);
    // The end of the filters and the sheet: the pinned bar shows what the filters are set to while they are scrolled away.
    const filtersRef = useRef(null);
    const sheetRef = useRef(null);
    const activeStatus = activeReadingStatus(filters.filter ?? {});
    const weekIndex = weekOptions.findIndex((option) => option.value === week);

    function changeStatus(status) {
        setSelectedIds(new Set());
        setFilters(readingStatusFilters(status));
    }

    // Ticks only apply to rows on screen; drop any that left (approved, another page or week).
    useEffect(() => {
        const approvableIds = new Set(rows.data.filter((row) => row.canApprove).map((row) => row.reading.id));
        setSelectedIds((current) => new Set([...current].filter((id) => approvableIds.has(id))));
    }, [rows.data]);

    const approvableRows = rows.data.filter((row) => row.canApprove);
    const selectedRows = approvableRows.filter((row) => selectedIds.has(row.reading.id));
    const singleApprovalRow = approvableRows.find((row) => row.reading.id === singleApprovalId);
    const selectedTotal = selectedRows.reduce((total, row) => total + Number(row.reading.amountDue), 0);
    // Readings far above the subscription's usual are approved only when ticked and confirmed, never with "approve all".
    const selectedUnusualCount = selectedRows.filter((row) => row.reading.unusual).length;
    const unusualCount = pendingApproval?.unusualCount ?? 0;
    const approvableAllCount = (pendingApproval?.count ?? 0) - unusualCount;
    const allOnPageSelected = approvableRows.length > 0 && selectedRows.length === approvableRows.length;
    const isFiltered = Boolean(search) || Object.values(filterValues).some(Boolean);

    function toggleSelected(readingId) {
        setSelectedIds((current) => {
            const next = new Set(current);
            next.has(readingId) ? next.delete(readingId) : next.add(readingId);
            return next;
        });
    }

    function toggleAllOnPage() {
        setSelectedIds(allOnPageSelected ? new Set() : new Set(approvableRows.map((row) => row.reading.id)));
    }

    function approve(singleRow = null) {
        if (approving) return;
        const payload = singleRow
            ? { reading_ids: [singleRow.reading.id], ...(singleRow.reading.unusual ? { confirm_unusual: true } : {}) }
            : confirming === 'all'
            ? { all: true, week, search, filter: filterValues }
            : { reading_ids: [...selectedIds], ...(selectedUnusualCount > 0 ? { confirm_unusual: true } : {}) };

        setConfirming(null);
        setSingleApprovalId(null);
        setApproving(true);
        router.post('/meter-readings/approve', payload, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setSelectedIds((current) => singleRow ? new Set([...current].filter((id) => id !== singleRow.reading.id)) : new Set()),
            onFinish: () => setApproving(false),
        });
    }

    // The year and the month the week ends in, then that month's weeks: pick the year, the month, then the week.
    const currentYear = weekEnd.slice(0, 4);
    const currentMonth = weekEnd.slice(0, 7);
    const periodOptions = weekOptions.some((option) => option.value === week) ? weekOptions : [...weekOptions, { value: week, end: weekEnd }];
    const yearOptions = [...new Set(periodOptions.map((option) => option.end.slice(0, 4)))];
    const monthOptions = [...new Set(periodOptions.filter((option) => option.end.startsWith(currentYear)).map((option) => option.end.slice(0, 7)))];
    const weeksOfMonth = periodOptions.filter((option) => option.end.startsWith(currentMonth));

    /** Another year or month opens on its latest week. */
    function changePeriod(prefix) {
        const latest = periodOptions.find((option) => option.end.startsWith(prefix));

        if (latest) {
            changeWeek(latest.value);
        }
    }

    function changeWeek(nextWeek) {
        router.get(
            '/meter-readings',
            { ...readingWeekParams(nextWeek, weekOptions[0]?.value), search, sort: filters.sort, direction: filters.direction, per_page: filters.per_page, filter: filterValues },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }

    // The status pills, at the head of the sheet and again on its pinned bar.
    const statusTabs = (
        <SegmentedChoice
            label="حالة القراءات"
            className="re-tabs"
            value={activeStatus}
            onChange={changeStatus}
            options={STATUS_TABS.map((tab) => ({ value: tab.value, label: <>{tab.value !== 'all' && <i className={tab.value} />}{tab.label}<span className="re-tab-count">{statusSummary[tab.count].toLocaleString('en')}</span></> }))}
        />
    );

    // The page's actions, in their row under the section's tabs as in the redesign.
    const headerActions = (
        <div className="re-heading re-actions items-center">
            <PrintButton title="القراءات الأسبوعية" selectedIds={[...selectedIds]} selectionPage="/meter-readings" />
            {canSendReadingMessages && statusSummary.approved > 0 && (
                <Link href={`/messages/create?${new URLSearchParams({ kind: 'weekly_reading', week_start: week, approved_only: '1', branch_id: messageBranchId ?? '', status: filterValues.subscription_status === 'all' ? '' : filterValues.subscription_status || 'active' })}`} aria-label="إرسال رسائل القراءات المعتمدة" title="إرسال رسائل القراءات المعتمدة" className="gl-btn gl-sec re-send">
                    <Icon name="send" className="h-4 w-4" />
                    إرسال القراءات
                </Link>
            )}
            <div className="re-week" role="group" aria-label="أسبوع القراءة">
                <Button data-raw="" variant="ghost" aria-label="الأسبوع السابق" isDisabled={weekIndex < 0 || weekIndex === weekOptions.length - 1} onClick={() => changeWeek(weekOptions[weekIndex + 1].value)}><Icon name="chevron-right" /></Button>
                <div className="re-week-field re-week-year"><label htmlFor="reading-week-year" className="sr-only">السنة</label><SearchableSelect id="reading-week-year" variant="pill" value={currentYear} onChange={changePeriod} options={yearOptions.map((year) => ({ value: year, label: year }))} clearable={false} searchable={false} className="[&>div.absolute]:min-w-0" /></div>
                <div className="re-week-field re-week-month"><label htmlFor="reading-week-month" className="sr-only">الشهر</label><SearchableSelect id="reading-week-month" variant="pill" value={currentMonth} onChange={changePeriod} options={monthOptions.map((month) => ({ value: month, label: formatMonthName(`${month}-01`) }))} clearable={false} searchable={false} className="[&>div.absolute]:min-w-0" /></div>
                <div className="re-week-field re-week-range"><label htmlFor="reading-week-range" className="sr-only">أسبوع القراءة</label><SearchableSelect id="reading-week-range" variant="pill" value={week} onChange={changeWeek} options={weeksOfMonth.map((option) => ({ value: option.value, label: `\u202A${fullDate(option.value)} – ${fullDate(option.end)}\u202C` }))} clearable={false} searchable={false} className="[&>div.absolute]:min-w-0" /></div>
                <Button data-raw="" variant="ghost" aria-label="الأسبوع التالي" isDisabled={weekIndex <= 0} onClick={() => changeWeek(weekOptions[weekIndex - 1].value)}><Icon name="chevron-left" /></Button>
            </div>
            <span role="status" className={`re-open ${entryWindow.isOpen ? 'is-open' : ''}`}><i />الإدخال {entryWindow.isOpen ? 'مفتوح' : 'مغلق'}</span>
        </div>
    );

    return (
        <AuthenticatedLayout header={<PageHeader title="القراءات الأسبوعية" info="قراءات العدادات لهذه الدورة." actions={headerActions} />}>
            <Head title="القراءات الأسبوعية" />
            <div className="reading-entry" dir="rtl">
                <ReadingSummary
                    statusSummary={statusSummary}
                    amountDue={summary.amountDue}
                    pendingApproval={pendingApproval}
                    canApprove={canApprove}
                    approvableAllCount={approvableAllCount}
                    isFiltered={isFiltered}
                    approving={approving}
                    onApproveAll={() => setConfirming('all')}
                />
            <EntryWindowNotice
                entryWindow={entryWindow}
                canRecord={canRecord}
                canApprove={canApprove}
                weekIsViewOnly={weekIsViewOnly}
                onShowLatestWeek={() => changeWeek(weekOptions[0].value)}
            />

            <section className="re-card" ref={sheetRef}>
            <ReadingContextBar anchorRef={filtersRef} sectionRef={sheetRef} week={week} weekEnd={weekEnd} groups={filterOptions} values={filterValues} search={search} total={rows.total} onChangeFilters={setFilters} status={statusTabs} />
            <div className="re-sheet-head">
                {statusTabs}
                {canApprove && approvableRows.length > 0 && (
                    <Checkbox className="re-select-page" isSelected={allOnPageSelected} onChange={toggleAllOnPage} isDisabled={approving}>
                        <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>تحديد قراءات هذه الصفحة</Checkbox.Content>
                    </Checkbox>
                )}
            </div>
            <DataTableToolbar
                printable={false}
                search={search}
                onSearchChange={setSearch}
                placeholder="بحث بالاسم أو رقم الاشتراك أو الهاتف..."
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={rows.total}
                filterMenu={
                    <DataTableFilterMenu
                        tableKey="meter-readings"
                        groups={filterOptions}
                        values={filterValues}
                        onChange={setFilter}
                        onChangeMany={setFilters}
                        onClear={clearFilters}
                    >
                        <div className="re-sort" role="group" aria-label="ترتيب القراءات">
                            <label htmlFor="sheet-sort" className="sr-only">ترتيب حسب</label>
                            <SearchableSelect
                                id="sheet-sort"
                                variant="pill"
                                prefix={<span className="gl-filter-name" aria-hidden="true"><Icon name="sort" className="h-[15px] w-[15px]" />ترتيب حسب:</span>}
                                className="gl-filter-item"
                                value={filters.sort}
                                onChange={(value) => sortBy(value, filters.direction)}
                                options={SORT_OPTIONS}
                                searchPlaceholder="بحث في الترتيب..."
                                clearable={false}
                            />
                            <label htmlFor="sheet-direction" className="sr-only">الاتجاه</label>
                            <SearchableSelect
                                id="sheet-direction"
                                variant="pill"
                                className="gl-filter-item"
                                value={filters.direction}
                                onChange={(value) => sortBy(filters.sort, value)}
                                options={['asc', 'desc'].map((direction) => ({
                                    value: direction,
                                    label: DIRECTION_LABELS[(SORT_OPTIONS.find((option) => option.value === filters.sort) ?? SORT_OPTIONS[0]).type][direction],
                                }))}
                                clearable={false}
                                searchable={false}
                            />
                        </div>
                    </DataTableFilterMenu>
                }
            />
            <div ref={filtersRef} aria-hidden="true" />

            <div className="re-table-wrap">
                {/* While a last reading can be edited, its column keeps the editor's width, so opening it moves nothing. */}
                <table data-excel-source="custom" className={`re-table w-full text-sm text-start ${rows.data.some((row) => row.lastReading?.canEdit || row.initialReading?.canEdit) ? 'has-last-edit' : ''}`} {...printFieldsProps(PRINT_FIELDS)}>
                    <thead>
                        <tr>
                            <SortableTh column="full_name" label="المشترك" sortState={filters} onSort={sort} className="re-sub" />
                            <SortableTh column="last_reading" label="القراءة السابقة" sortState={filters} onSort={sort} className="re-last" />
                            <SortableTh column="current_reading" label="القراءة الحالية" sortState={filters} onSort={sort} className="re-input-cell" />
                            <SortableTh column="consumption" label="الفرق (كيلو)" sortState={filters} onSort={sort} className="re-diff" />
                            <SortableTh column="amount_due" label="المطلوب دفعه" sortState={filters} onSort={sort} className="re-due" />
                            <th className="re-status">الحالة</th>
                            {seesWhoRecorded && <th className="re-by">سجّلها</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.length === 0 ? (
                            <tr>
                                <td className="re-empty" colSpan={seesWhoRecorded ? 7 : 6}>
                                    {isFiltered ? (
                                        <>
                                            <b>لا يوجد مشتركون مطابقون للبحث والتصفية.</b>
                                            <Button data-raw="" variant="ghost" className="gl-btn gl-sec gl-sm" onClick={() => { setSearch(''); clearFilters(); }}>مسح البحث والفلاتر</Button>
                                        </>
                                    ) : (
                                        <b>لا يوجد مشتركون بقراءات في هذا الأسبوع.</b>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            rows.data.map((row) => (
                                <SheetRow
                                    key={`${week}-${row.id}`}
                                    row={row}
                                    week={week}
                                    approvable={canApprove}
                                    showRecorder={seesWhoRecorded}
                                    selected={row.canApprove && selectedIds.has(row.reading.id)}
                                    onToggleSelected={() => toggleSelected(row.reading.id)}
                                    onApprove={setSingleApprovalId}
                                    approving={approving}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="re-footer"><span>مجموع المستحق لهذا الأسبوع <b>{formatMoney(summary.amountDue)} شيكل</b></span><span><Icon name="enter" /> Enter أو ↓ للحفظ والانتقال، ↑ للرجوع، Tab للتنقل</span></div>
            <Pagination meta={rows} filters={filters} baseUrl="/meter-readings" extraParams={weekParams} />
            </section>

            {selectedRows.length > 0 && (
                <div className="re-bulk">
                    <p className="text-sm text-gray-600">
                        <b className="text-gray-900">{countReadings(selectedRows.length)}</b> محددة، مجموعها{' '}
                        <b className="tabular-nums text-gray-900">{formatMoney(selectedTotal)} شيكل</b>
                    </p>
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" onPress={() => setSelectedIds(new Set())} isDisabled={approving}>
                            إلغاء التحديد
                        </Button>
                        <Button className="re-approve-selected" onPress={() => setConfirming('selected')} isDisabled={approving}>
                            <Icon name="check" className="h-4 w-4" strokeWidth={2} />
                            اعتماد المحدد
                        </Button>
                    </div>
                </div>
            )}

            <ConfirmDialog
                show={confirming !== null}
                onConfirm={() => approve()}
                onCancel={() => setConfirming(null)}
                title={confirming === 'all' ? 'اعتماد كل القراءات؟' : 'اعتماد القراءات المحددة؟'}
                message={
                    confirming === 'all'
                        ? `سيتم اعتماد ${countReadings(approvableAllCount)} لهذا الأسبوع${isFiltered ? ' مطابقة للبحث والتصفية الحالية' : ''}، وتُضاف إلى المعاملات المالية للمشتركين.${unusualCount > 0 ? ` وتبقى ${countReadings(unusualCount)} غير معتادة بانتظار مراجعتها واعتمادها واحدة واحدة.` : ''} لا يمكن تعديل القراءة بعد اعتمادها.`
                        : `سيتم اعتماد ${countReadings(selectedRows.length)} مجموعها ${formatMoney(selectedTotal)} شيكل، وتُضاف إلى المعاملات المالية للمشتركين.${selectedUnusualCount > 0 ? ` منها ${countReadings(selectedUnusualCount)} غير معتادة استهلاكها أعلى بكثير من المعتاد، وباعتمادها تؤكد أنك راجعتها وأنها صحيحة.` : ''} لا يمكن تعديل القراءة بعد اعتمادها.`
                }
                confirmLabel="نعم، اعتمد"
                cancelLabel="مراجعة القراءات"
            />
            <ReadingApprovalDialog row={singleApprovalRow} onConfirm={() => approve(singleApprovalRow)} onCancel={() => setSingleApprovalId(null)} />
            </div>
        </AuthenticatedLayout>
    );
}
