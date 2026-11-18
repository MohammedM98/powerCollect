import { useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AddButton from '@/Components/AddButton';
import { BranchFilterBanner, splitBranchFilter } from '@/Components/BranchBanner';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import Pagination from '@/Components/DataTable/Pagination';
import { useDataTable } from '@/hooks/useDataTable';
import { useDeleteRecord } from '@/hooks/useDeleteRecord';
import { useRowClick } from '@/hooks/useRowClick';
import { useStatementWindow } from '@/hooks/useStatementWindow';
import { hasLatestWeekReading, weekOptionsFor } from '@/lib/readings';
import { openQuickMessage } from '@/lib/quickMessage';
import BulkActionBar from './BulkActionBar';
import BulkActionsMenu from './BulkActionsMenu';
import BalanceFilter from './BalanceFilter';
import { BALANCE_FILTER_KEYS, balanceFilterLabel, subscriptionFilterKey } from '@/lib/subscriptionBalance';
import UnderlineTabs from '@/Components/UnderlineTabs';
import PageHeader from '@/Components/PageHeader';
import InfoTip from '@/Components/InfoTip';
import SubscriptionWindows from './SubscriptionWindows';
import SubscriptionsTable from './SubscriptionsTable';
import { useSubscriptionSelection } from './useSubscriptionSelection';
import { needsPermission } from '@/lib/permissions';
import { statementHeader } from '@/lib/accountStatement';

/**
 * @param {import('@/types/pages').SubscriptionsIndexProps} props
 */
export default function Index({
    subscriptions,
    canCreate,
    canViewArchived,
    showArchived = false,
    archiveToday,
    canRecordReadings,
    branches,
    tariffs,
    segments,
    circuitBreakers,
    subAreas,
    canChooseBranch,
    currentBranchAreaId,
    currentBranchAreaName,
    canEditMinimumCharge,
    canEditKilowattPrice,
    filters,
    filterOptions,
    branchScope,
    readingWeekOptions,
    statement,
    bulkActions,
    statusOptions,
}) {
    const { can, errors = {} } = usePage().props;
    const [modalSubscription, setModalSubscription] = useState(null);
    const [viewingSubscriptionId, setViewingSubscriptionId] = useState(null);
    // Looked up from the current page props (not kept as a copy) so the
    // statement refreshes after a reading is saved from inside it.
    const viewingSubscription = subscriptions.data.find((subscription) => subscription.id === viewingSubscriptionId) ?? null;
    const [creating, setCreating] = useState(false);
    const [subscriptionSource, setSubscriptionSource] = useState(null);
    const [personalDetailsSubscription, setPersonalDetailsSubscription] = useState(null);
    const [readingSubscription, setReadingSubscription] = useState(null);
    const [historySubscriptionId, setHistorySubscriptionId] = useState(null);
    const [messageSubscription, setMessageSubscription] = useState(null);
    const [archiveSubscription, setArchiveSubscription] = useState(null);
    const historySubscription = subscriptions.data.find((subscription) => subscription.id === historySubscriptionId) ?? null;
    const { search, setSearch, sort, setPage, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable('/subscriptions', filters, {}, {
        only: ['subscriptions', 'filters', 'filterOptions', 'branchScope', 'can', 'canCreate', 'canViewArchived', 'showArchived', 'archiveToday', 'canRecordReadings', 'bulkActions', 'canEditMinimumCharge', 'canEditKilowattPrice', 'readingWeekOptions'],
    });
    const rowClick = useRowClick();
    const localFilterKey = subscriptionFilterKey(filterValues);
    const serverFilterKey = subscriptionFilterKey(filters.filter);
    const filtersKey = JSON.stringify([search.trim(), localFilterKey, filters.search, serverFilterKey]);
    const filtersPending = search.trim() !== (filters.search ?? '') || localFilterKey !== serverFilterKey;
    const balanceLabel = balanceFilterLabel(filters.filter);
    const standardFilterValues = Object.fromEntries(Object.entries(filterValues).filter(([key]) => key !== 'archived' && !BALANCE_FILTER_KEYS.includes(key)));
    // Whoever sees every branch picks the branch in the banner above the table, not among the other filters; clearing those keeps it.
    const branchFilter = splitBranchFilter(branchScope, filterOptions, standardFilterValues);
    const keptOnClear = [...(showArchived ? ['archived'] : []), ...branchFilter.kept];
    const canSelect = !showArchived && (bulkActions.minimumCharge || bulkActions.status || bulkActions.message || bulkActions.meterBox);
    const {
        selectedIds,
        allMatching,
        setAllMatching,
        bulkField,
        setBulkField,
        pendingAction,
        pageIds,
        pageSelectedCount,
        selectionCount,
        selection,
        headerCheckbox,
        toggleSubscription,
        togglePage,
        selectAllMatching,
        clearSelection,
        continueBulkAction,
        chooseBulkAction,
    } = useSubscriptionSelection(subscriptions, filters, filtersKey, filtersPending);

    const { requestDelete, deleteDialog } = useDeleteRecord('المشترك');

    const statementWindow = useStatementWindow(statement);
    const viewingIndex = subscriptions.data.findIndex((subscription) => subscription.id === viewingSubscriptionId);

    function closeProfile() {
        setViewingSubscriptionId(null);
        if (statementWindow.subscription) {
            statementWindow.close();
        }
    }

    function switchProfile(offset) {
        if (statementWindow.subscription) {
            statementWindow.close();
        }
        setViewingSubscriptionId(subscriptions.data[viewingIndex + offset].id);
    }

    /** Show a subscription's financial history; `form` also opens its payment, charge or discount form. */
    function openStatement(subscription, form = null) {
        statementWindow.open(statementHeader(subscription), form);
    }

    /** The row's "more" menu: the subscription's details, the account's forms, entering this week's reading and the past readings. */
    function rowMenu(subscription) {
        const readingItem = { label: 'إدخال قراءة', icon: 'gauge', tone: 'teal', shortcut: 'R', onSelect: () => setReadingSubscription(subscription) };

        if (!canRecordReadings) {
            readingItem.lockedReason = needsPermission('تسجيل القراءات');
        } else if (subscription.status !== 'active') {
            Object.assign(readingItem, { disabled: true, hint: 'المشترك غير نشط' });
        } else if (hasLatestWeekReading(subscription, weekOptionsFor(subscription, readingWeekOptions))) {
            Object.assign(readingItem, { disabled: true, hint: 'مُدخلة هذا الأسبوع' });
        }

        return {
            title: subscription.display_name,
            subtitle: subscription.contact_phone,
            groups: [
                {
                    label: 'المشترك',
                    items: [
                        { label: 'بيانات المشترك', icon: 'user', tone: 'graphite', shortcut: 'I', onSelect: () => setViewingSubscriptionId(subscription.id) },
                        {
                            label: 'تعديل البيانات الشخصية',
                            icon: 'pencil',
                            tone: 'blue',
                            shortcut: 'E',
                            onSelect: () => setPersonalDetailsSubscription(subscription),
                            lockedReason: subscription.canUpdate ? null : needsPermission('تعديل المشتركين'),
                        },
                        ...(canCreate ? [{ label: 'إضافة اشتراك', icon: 'document-plus', tone: 'indigo', onSelect: () => setSubscriptionSource(subscription) }] : []),
                        {
                            label: 'إرسال رسالة',
                            icon: 'send',
                            tone: 'sky',
                            shortcut: 'M',
                            onSelect: () => openQuickMessage([subscription.id]),
                            lockedReason: can?.sendMessages ? null : needsPermission('إرسال الرسائل'),
                        },
                        {
                            label: 'سجل الرسائل',
                            icon: 'messages',
                            tone: 'sky',
                            onSelect: () => setMessageSubscription(subscription),
                            lockedReason: can?.viewMessages ? null : needsPermission('عرض الرسائل'),
                        },
                    ],
                },
                {
                    label: 'الحساب المالي',
                    items: [
                        {
                            label: 'تسجيل دفعة',
                            icon: 'banknotes',
                            tone: 'emerald',
                            shortcut: 'P',
                            onSelect: () => openStatement(subscription, 'payment'),
                            lockedReason: subscription.canRecordPayment ? null : needsPermission('تسجيل التحصيلات'),
                        },
                        {
                            label: 'تسجيل دفعة مقسّمة',
                            icon: 'layers',
                            tone: 'brand',
                            onSelect: () => openStatement(subscription, 'split_payment'),
                            lockedReason: subscription.canRecordSplitPayment ? null : needsPermission('تسجيل دفعة بتحويل بنكي'),
                        },
                        {
                            label: 'تحميل حركة',
                            icon: 'document-plus',
                            tone: 'amber',
                            onSelect: () => openStatement(subscription, 'charge'),
                            lockedReason: subscription.canAddCharge ? null : needsPermission('إضافة تحميل'),
                        },
                        {
                            label: 'إضافة خصم',
                            icon: 'discount',
                            tone: 'violet',
                            onSelect: () => openStatement(subscription, 'discount'),
                            lockedReason: subscription.canAddDiscount ? null : needsPermission('إضافة خصم'),
                        },
                        {
                            label: 'مقاصة',
                            icon: 'scale',
                            tone: 'teal',
                            onSelect: () => openStatement(subscription, 'clearing'),
                            lockedReason: subscription.canAddClearing ? null : needsPermission('إضافة مقاصة'),
                        },
                    ],
                },
                {
                    label: 'القراءات',
                    items: [
                        readingItem,
                        {
                            label: 'سجل القراءات',
                            icon: 'chart',
                            tone: 'graphite',
                            shortcut: 'H',
                            hint: subscription.meterReadings.length ? `${subscription.meterReadings.length} قراءة` : 'لا توجد بعد',
                            onSelect: () => setHistorySubscriptionId(subscription.id),
                        },
                    ],
                },
                {
                    label: 'إنهاء الخدمة والأرشفة',
                    items: subscription.archivedAt ? [{ label: 'استعادة الاشتراك من الأرشيف', icon: 'history', tone: 'graphite', onSelect: () => setArchiveSubscription(subscription), lockedReason: subscription.canRestore ? null : needsPermission('استعادة الاشتراكات المؤرشفة') }] : [{ label: 'أرشفة الاشتراك المنتهي', icon: 'folder', tone: 'brand', onSelect: () => setArchiveSubscription(subscription), lockedReason: subscription.canArchive ? null : needsPermission('أرشفة الاشتراكات المنتهية'), disabled: Boolean(subscription.archiveBlocker), hint: subscription.archiveBlocker }],
                },
            ],
        };
    }

    const modalProps = {
        branches,
        tariffs,
        segments,
        circuitBreakers,
        subAreas,
        canChooseBranch,
        currentBranchAreaId,
        currentBranchAreaName,
        canEditMinimumCharge,
    canEditKilowattPrice,
    };

    return (
        <AuthenticatedLayout
            scope={branchScope?.name ?? null}
            header={
                <PageHeader
                    title="المشتركون"
                    actions={
                        <>
                            {!showArchived && <BulkActionsMenu abilities={bulkActions} onChoose={chooseBulkAction} />}
                            {canCreate && <AddButton onClick={() => setCreating(true)}>مشترك جديد</AddButton>}
                        </>
                    }
                />
            }
        >
            <Head title="المشتركون" />

            {branchScope && <BranchFilterBanner scope={branchScope} eyebrow="تعرض الآن مشتركي" group={branchFilter.branch} value={filterValues.branch_id} onChange={(value) => setFilter('branch_id', value)} />}

            {canViewArchived && <div className="mb-5 flex flex-wrap items-end gap-2"><UnderlineTabs label="قائمة الاشتراكات" value={showArchived ? 'archived' : 'current'} options={[{ value: 'current', label: 'الاشتراكات الحالية' }, { value: 'archived', label: 'الاشتراكات المؤرشفة' }]} onChange={(value) => setFilter('archived', value === 'archived' ? '1' : '')} /><InfoTip label="عن الأرشيف">{showArchived ? 'ملفات محفوظة بعد إنهاء الخدمة؛ الأرصدة والحركات السابقة باقية.' : 'أرشفة الاشتراك المنتهي متاحة من قائمة إجراءاته حسب الصلاحية.'}</InfoTip></div>}

            <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="بحث بالاسم أو رقم الهاتف أو رقم المشترك أو الاشتراك..."
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={subscriptions.total}
                filterMenu={
                    <DataTableFilterMenu
                        tableKey="subscriptions"
                        groups={branchFilter.groups}
                        values={branchFilter.values}
                        onChange={setFilter}
                        onChangeMany={setFilters}
                        onClear={() => keptOnClear.length ? setFilters(Object.fromEntries(Object.keys(filterValues).filter((key) => !keptOnClear.includes(key)).map((key) => [key, '']))) : clearFilters()}
                    >
                        <BalanceFilter values={filterValues} onChange={setFilters} errors={errors} />
                    </DataTableFilterMenu>
                }
            />

            {balanceLabel && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-x border-gray-100 bg-brand-500/5 px-5 py-3 text-sm text-gray-700">
                    <span><b className="font-display text-gray-900">{subscriptions.total.toLocaleString('en')}</b> اشتراكًا · {balanceLabel}{filtersPending && ' · جارٍ تحديث النتائج…'}</span>
                    {canSelect && subscriptions.total > 0 && !allMatching && <button type="button" disabled={filtersPending} onClick={selectAllMatching} className="rounded-control border border-brand-500/20 bg-surface px-3 py-2 font-semibold text-brand-600 transition hover:bg-brand-500/10 disabled:opacity-40">تحديد جميع النتائج ({subscriptions.total.toLocaleString('en')})</button>}
                </div>
            )}

            {canSelect && !allMatching && pageIds.length > 0 && pageSelectedCount === pageIds.length && subscriptions.total > pageIds.length && (
                <div role="status" className="flex flex-wrap items-center justify-center gap-2 border-x border-gray-100 bg-brand-500/5 px-4 py-2.5 text-sm text-gray-700">
                    تم تحديد {pageIds.length.toLocaleString('en')} مشترك في هذه الصفحة.
                    <button
                        type="button"
                        onClick={() => setAllMatching(true)}
                        className="rounded font-semibold text-brand-600 hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                    >
                        تحديد كل النتائج المطابقة ({subscriptions.total.toLocaleString('en')})
                    </button>
                </div>
            )}

            <div className="data-table-container">
                <SubscriptionsTable
                    allMatching={allMatching}
                    canSelect={canSelect}
                    filters={filters}
                    headerCheckbox={headerCheckbox}
                    openStatement={openStatement}
                    pageIds={pageIds}
                    pageSelectedCount={pageSelectedCount}
                    requestDelete={requestDelete}
                    rowClick={rowClick}
                    rowMenu={rowMenu}
                    selectedIds={selectedIds}
                    setModalSubscription={setModalSubscription}
                    setViewingSubscriptionId={setViewingSubscriptionId}
                    sort={sort}
                    subscriptions={subscriptions}
                    togglePage={togglePage}
                    toggleSubscription={toggleSubscription}
                />
            </div>

            <Pagination meta={subscriptions} onPageChange={setPage} />

            {canSelect && (selectionCount > 0 || pendingAction) && !filtersPending && (
                <>
                    {/* Room at the end of the page, so the bar never hides the last rows. */}
                    <div className="h-52 sm:h-24" aria-hidden="true" />
                    <BulkActionBar
                        count={selectionCount}
                        selection={selection}
                        abilities={bulkActions}
                        onAction={setBulkField}
                        onClear={clearSelection}
                        pendingAction={pendingAction}
                        onContinue={() => continueBulkAction()}
                    />
                </>
            )}

            <SubscriptionWindows
                archiveSubscription={archiveSubscription}
                archiveToday={archiveToday}
                balanceLabel={balanceLabel}
                bulkField={bulkField}
                can={can}
                clearSelection={clearSelection}
                closeProfile={closeProfile}
                creating={creating}
                deleteDialog={deleteDialog}
                historySubscription={historySubscription}
                messageSubscription={messageSubscription}
                modalProps={modalProps}
                modalSubscription={modalSubscription}
                openStatement={openStatement}
                personalDetailsSubscription={personalDetailsSubscription}
                readingSubscription={readingSubscription}
                readingWeekOptions={readingWeekOptions}
                selection={selection}
                selectionCount={selectionCount}
                setArchiveSubscription={setArchiveSubscription}
                setBulkField={setBulkField}
                setCreating={setCreating}
                setHistorySubscriptionId={setHistorySubscriptionId}
                setMessageSubscription={setMessageSubscription}
                setModalSubscription={setModalSubscription}
                setPersonalDetailsSubscription={setPersonalDetailsSubscription}
                setReadingSubscription={setReadingSubscription}
                setSubscriptionSource={setSubscriptionSource}
                setViewingSubscriptionId={setViewingSubscriptionId}
                statementWindow={statementWindow}
                statusOptions={statusOptions}
                subscriptionSource={subscriptionSource}
                subscriptions={subscriptions}
                switchProfile={switchProfile}
                viewingIndex={viewingIndex}
                viewingSubscription={viewingSubscription}
                viewingSubscriptionId={viewingSubscriptionId}
            />
        </AuthenticatedLayout>
    );
}
