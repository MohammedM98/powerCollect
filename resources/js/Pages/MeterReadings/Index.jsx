import { useEffect, useState, useRef } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ConfirmDialog from '@/Components/ConfirmDialog';
import Icon from '@/Components/Icon';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import SortableTh from '@/Components/DataTable/SortableTh';
import Pagination from '@/Components/DataTable/Pagination';
import SearchableSelect from '@/Components/SearchableSelect';
import { useDataTable } from '@/hooks/useDataTable';
import { formatCurrency } from '@/lib/currency';
import { formatMonthName } from '@/lib/format';
import { activeReadingStatus, readingStatusFilters, readingWeekParams } from '@/lib/readingSheet';
import ReadingContextBar from './ReadingContextBar';
import ReadingApprovalDialog from './ReadingApprovalDialog';
import PrintButton from '@/Components/PrintButton';
import './ReadingEntry.css';
import InfoTip from '@/Components/InfoTip';
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
    const [showHint, setShowHint] = useState(true);
    // The end of the filters and the sheet: the pinned bar shows what the filters are set to while they are scrolled away.
    const filtersRef = useRef(null);
    const sheetRef = useRef(null);
    const activeStatus = activeReadingStatus(filters.filter ?? {});
    const weekIndex = weekOptions.findIndex((option) => option.value === week);
    const entered = statusSummary.pending + statusSummary.approved;
    const percentage = statusSummary.total ? Math.round(entered / statusSummary.total * 100) : 0;

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

    return (
        <AuthenticatedLayout>
            <Head title="القراءات الأسبوعية" />
            <div className="reading-entry" dir="rtl">
                <div className="re-heading">
                    <div className="flex items-center gap-1"><h1>القراءات الأسبوعية</h1><InfoTip label="طريقة الإدخال">أدخل القراءة الحالية بجانب القراءة السابقة، واضغط Enter أو السهم لأسفل للحفظ والانتقال للمشترك التالي، والسهم لأعلى للرجوع.</InfoTip></div>
                    <div className="re-actions items-center">
                        <PrintButton title="القراءات الأسبوعية" selectedIds={[...selectedIds]} selectionPage="/meter-readings" buttonClassName="h-11! rounded-xl! px-3! py-0! text-xs!" />
                        {canSendReadingMessages && statusSummary.approved > 0 && (
                            <Link href={`/messages/create?${new URLSearchParams({ kind: 'weekly_reading', week_start: week, approved_only: '1', branch_id: messageBranchId ?? '', status: filterValues.subscription_status === 'all' ? '' : filterValues.subscription_status || 'active' })}`} aria-label="إرسال رسائل القراءات المعتمدة" title="إرسال رسائل القراءات المعتمدة" className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 shadow-xs transition hover:border-emerald-400 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white"><Icon name="send" className="h-4 w-4" /></span>
                                إرسال القراءات
                            </Link>
                        )}
                        <span className={`re-open ${entryWindow.isOpen ? 'is-open' : ''}`}><i />الإدخال {entryWindow.isOpen ? 'مفتوح' : 'مغلق'}</span>
                        <div className="re-week">
                            <button type="button" aria-label="الأسبوع السابق" disabled={weekIndex < 0 || weekIndex === weekOptions.length - 1} onClick={() => changeWeek(weekOptions[weekIndex + 1].value)}><Icon name="chevron-right" /></button>
                            <div className="re-week-field re-week-year"><label htmlFor="reading-week-year" className="sr-only">السنة</label><SearchableSelect id="reading-week-year" value={currentYear} onChange={changePeriod} options={yearOptions.map((year) => ({ value: year, label: year }))} clearable={false} searchable={false} className="[&>div.absolute]:min-w-0" /></div>
                            <div className="re-week-field re-week-month"><label htmlFor="reading-week-month" className="sr-only">الشهر</label><SearchableSelect id="reading-week-month" value={currentMonth} onChange={changePeriod} options={monthOptions.map((month) => ({ value: month, label: formatMonthName(`${month}-01`) }))} clearable={false} searchable={false} className="[&>div.absolute]:min-w-0" /></div>
                            <div className="re-week-field re-week-range"><label htmlFor="reading-week-range" className="sr-only">أسبوع القراءة</label><SearchableSelect id="reading-week-range" value={week} onChange={changeWeek} options={weeksOfMonth.map((option) => ({ value: option.value, label: `\u202A${fullDate(option.value)} – ${fullDate(option.end)}\u202C` }))} clearable={false} searchable={false} className="[&>div.absolute]:min-w-0" /></div>
                            <button type="button" aria-label="الأسبوع التالي" disabled={weekIndex <= 0} onClick={() => changeWeek(weekOptions[weekIndex - 1].value)}><Icon name="chevron-left" /></button>
                        </div>
                    </div>
                </div>
                {showHint && <div className="re-hint"><Icon name="info" /><p><b>كل قراءات الأسبوع في مكان واحد.</b> بعد حفظ القراءة تظهر في «بانتظار الاعتماد» حتى يراجعها المسؤول ويعتمدها. ويمكنك عرض القراءات المعتمدة بشكل منفصل.</p><button type="button" aria-label="إخفاء التوضيح" onClick={() => setShowHint(false)}>×</button></div>}
                <div className="re-top">
                    <div className="re-tabs" role="group" aria-label="حالة القراءات">
                        {STATUS_TABS.map((tab) => <button type="button" key={tab.value} aria-pressed={activeStatus === tab.value} onClick={() => changeStatus(tab.value)}>{tab.value !== 'all' && <i className={tab.value} />}{tab.label}<span>{statusSummary[tab.count].toLocaleString('en')}</span></button>)}
                    </div>
                    <div className="re-progress">
                        <div><b>{entered.toLocaleString('en')}</b><span>من {statusSummary.total.toLocaleString('en')} قراءة</span><strong>{percentage}%</strong></div>
                        <div className="re-progress-track" role="progressbar" aria-label="القراءات المدخلة" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><i className="approved" style={{ width: `${statusSummary.total ? statusSummary.approved / statusSummary.total * 100 : 0}%` }} /><i className="pending" style={{ width: `${statusSummary.total ? statusSummary.pending / statusSummary.total * 100 : 0}%` }} /></div>
                        <div className="re-legend"><span><i className="approved" />معتمدة {statusSummary.approved}</span><span><i className="pending" />بانتظار الاعتماد {statusSummary.pending}</span><span><i className="missing" />لم تُدخل {statusSummary.missing}</span></div>
                    </div>
                </div>
            <EntryWindowNotice
                entryWindow={entryWindow}
                canRecord={canRecord}
                canApprove={canApprove}
                weekIsViewOnly={weekIsViewOnly}
                onShowLatestWeek={() => changeWeek(weekOptions[0].value)}
            />

            {canApprove && pendingApproval.count === 0 && activeStatus === 'pending' && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">
                    <Icon name="check" className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2} />
                    <p className="font-medium text-emerald-800 dark:text-emerald-300">
                        {isFiltered ? 'لا توجد قراءات بانتظار الاعتماد ضمن البحث والتصفية.' : 'لا توجد قراءات بانتظار الاعتماد لهذا الأسبوع.'}
                    </p>
                </div>
            )}

            {canApprove && pendingApproval.count > 0 && (
                <div className="re-approval">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                            <Icon name="check" strokeWidth={2} />
                        </span>
                        <div>
                            <p className="font-semibold text-gray-900">
                                بانتظار الاعتماد: <span className="tabular-nums">{pendingApproval.count.toLocaleString('en')}</span> قراءة
                                {isFiltered && <span className="font-normal text-gray-500"> (حسب البحث والتصفية)</span>}
                            </p>
                            <p className="text-sm text-gray-500">
                                مجموعها <span className="tabular-nums">{formatCurrency(pendingApproval.amountDue)}</span> — تظهر في المعاملات المالية
                                للمشترك بعد اعتمادها.
                            </p>
                            {unusualCount > 0 && (
                                <p className="re-unusual-note">
                                    منها {unusualCount.toLocaleString('en')} قراءة غير معتادة (استهلاكها أعلى بكثير من المعتاد) لا تدخل في «اعتماد الكل»؛ راجعها
                                    وحدّدها لاعتمادها بعد التأكيد.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={allOnPageSelected}
                                onChange={toggleAllOnPage}
                                disabled={approvableRows.length === 0 || approving}
                            />
                            تحديد قراءات هذه الصفحة
                        </label>
                        <PrimaryButton type="button" onClick={() => setConfirming('all')} disabled={approving || approvableAllCount === 0}>
                            <Icon name="check" className="h-4 w-4" strokeWidth={2} />
                            {isFiltered ? 'اعتماد كل النتائج' : 'اعتماد كل قراءات الأسبوع'} ({approvableAllCount.toLocaleString('en')})
                        </PrimaryButton>
                    </div>
                </div>
            )}

            <section className="re-card" ref={sheetRef}>
            <ReadingContextBar anchorRef={filtersRef} sectionRef={sheetRef} week={week} weekEnd={weekEnd} groups={filterOptions} values={filterValues} search={search} total={rows.total} onChangeFilters={setFilters} />
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
                    />
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
                            <th className="re-rate">سعر الكيلو</th>
                            <th className="re-fee">قيمة القراءة</th>
                            <th className="re-min">الحد الأدنى</th>
                            <SortableTh column="amount_due" label="المطلوب دفعه" sortState={filters} onSort={sort} className="re-due" />
                            <th className="re-status">الحالة</th>
                            {seesWhoRecorded && <th className="re-by">سجّلها</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.length === 0 ? (
                            <tr>
                                <td className="text-gray-500" colSpan={seesWhoRecorded ? 10 : 9}>
                                    لا يوجد مشتركون مطابقون.
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

            <div className="re-footer"><span>مجموع المستحق لهذا الأسبوع <b>{formatCurrency(summary.amountDue)}</b></span><span><Icon name="enter" /> Enter أو ↓ للحفظ والانتقال · ↑ للرجوع · Tab للتنقل</span></div>
            <Pagination meta={rows} filters={filters} baseUrl="/meter-readings" extraParams={weekParams} />
            </section>

            {selectedRows.length > 0 && (
                <div className="re-bulk">
                    <p className="text-sm text-gray-600">
                        <b className="text-gray-900">{selectedRows.length.toLocaleString('en')}</b> قراءة محددة · المجموع{' '}
                        <b className="tabular-nums text-gray-900">{formatCurrency(selectedTotal)}</b>
                    </p>
                    <div className="flex items-center gap-3">
                        <SecondaryButton onClick={() => setSelectedIds(new Set())} disabled={approving}>
                            إلغاء التحديد
                        </SecondaryButton>
                        <PrimaryButton type="button" onClick={() => setConfirming('selected')} disabled={approving}>
                            <Icon name="check" className="h-4 w-4" strokeWidth={2} />
                            اعتماد المحدد
                        </PrimaryButton>
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
                        ? `سيتم اعتماد ${approvableAllCount.toLocaleString('en')} قراءة لهذا الأسبوع${isFiltered ? ' مطابقة للبحث والتصفية الحالية' : ''}، وتُضاف إلى المعاملات المالية للمشتركين.${unusualCount > 0 ? ` وتبقى ${unusualCount.toLocaleString('en')} قراءة غير معتادة بانتظار مراجعتها واعتمادها واحدة واحدة.` : ''} لا يمكن تعديل القراءة بعد اعتمادها.`
                        : `سيتم اعتماد ${selectedRows.length.toLocaleString('en')} قراءة بمجموع ${formatCurrency(selectedTotal)}، وتُضاف إلى المعاملات المالية للمشتركين.${selectedUnusualCount > 0 ? ` منها ${selectedUnusualCount.toLocaleString('en')} قراءة غير معتادة استهلاكها أعلى بكثير من المعتاد، وباعتمادها تؤكد أنك راجعتها وأنها صحيحة.` : ''} لا يمكن تعديل القراءة بعد اعتمادها.`
                }
                confirmLabel="نعم، اعتمد"
                cancelLabel="مراجعة القراءات"
            />
            <ReadingApprovalDialog row={singleApprovalRow} onConfirm={() => approve(singleApprovalRow)} onCancel={() => setSingleApprovalId(null)} />
            </div>
        </AuthenticatedLayout>
    );
}
