import AreaChip from '@/Components/DataTable/AreaChip';
import MeterBoxCell from '@/Components/DataTable/MeterBoxCell';
import SortableTh from '@/Components/DataTable/SortableTh';
import TariffTag from '@/Components/DataTable/TariffTag';
import { isFarBehind } from '@/lib/balance';
import StatusPill from '@/Components/DataTable/StatusPill';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import RowIdentity from '@/Components/DataTable/RowIdentity';
import ActionsTh from '@/Components/DataTable/ActionsTh';
import { printFieldsProps, printRowProps } from '@/lib/print';
import { formatShekels } from '@/lib/currency';
import PhoneQuickEdit from './PhoneQuickEdit';
import Balance from '@/Components/Balance';
import { formatDate } from '@/lib/format';

const STATUS_TONES = {
    active: 'green',
    suspended: 'amber',
    disconnected: 'gray',
};

/** Why a menu action is locked: the permission it needs and who grants it. */
/** The details printing can show as columns of their own (see printFieldsProps). */
const PRINT_FIELDS = [
    { key: 'display_name', label: 'اسم المشترك' },
    { key: 'contact_phone', label: 'رقم الهاتف', default: true, after: 'اسم الاشتراك' },
    { key: 'account_number', label: 'رقم الاشتراك' },
    { key: 'subscriber_number', label: 'رقم المشترك' },
    { key: 'meterBoxName', label: 'اسم الطبلون' },
    { key: 'meterBoxNumber', label: 'رقم الطبلون' },
    { key: 'subAreaName', label: 'منطقة 2' },
    { key: 'branchName', label: 'الفرع' },
];

/** The subscriptions as a table: the sortable heads, a row per subscription with its balance and status, and each row's actions. */
export default function SubscriptionsTable({
    allMatching,
    canSelect,
    filters,
    headerCheckbox,
    openStatement,
    pageIds,
    pageSelectedCount,
    requestDelete,
    rowClick,
    rowMenu,
    selectedIds,
    setModalSubscription,
    setViewingSubscriptionId,
    sort,
    subscriptions,
    togglePage,
    toggleSubscription,
}) {
    return (
        <table className="data-table w-full text-sm text-start" {...printFieldsProps(PRINT_FIELDS)}>
            <thead>
                <tr>
                    {canSelect && (
                        <th data-actions="" className="w-10">
                            <input
                                ref={headerCheckbox}
                                type="checkbox"
                                checked={allMatching || (pageIds.length > 0 && pageSelectedCount === pageIds.length)}
                                onChange={togglePage}
                                aria-label="تحديد كل مشتركي هذه الصفحة"
                                title="تحديد كل مشتركي هذه الصفحة"
                                className="rounded border-gray-300 text-brand-600"
                            />
                        </th>
                    )}
                    <SortableTh column="account_number" label="رقم الاشتراك" sortState={filters} onSort={sort} />
                    <SortableTh column="display_name" label="اسم الاشتراك" sortState={filters} onSort={sort} />
                    <th>منطقة 2</th>
                    <th>الطبلون</th>
                    <th>نوع الاشتراك</th>
                    <th>الحد الأدنى</th>
                    <th>الرصيد</th>
                    <SortableTh column="status" label="الحالة" sortState={filters} onSort={sort} />
                    <ActionsTh />
                </tr>
            </thead>
            <tbody>
                {subscriptions.data.length === 0 ? (
                    <tr>
                        <td className="text-gray-500" colSpan={canSelect ? 10 : 9}>
                            لا توجد نتائج مطابقة.
                        </td>
                    </tr>
                ) : (
                    // The row and name open the statement; «عرض» opens the subscriber's details.
                    subscriptions.data.map((subscription) => (
                        <tr
                            key={subscription.id}
                            {...rowClick(() => openStatement(subscription))}
                            {...printRowProps(Object.fromEntries(PRINT_FIELDS.map((field) => [field.key, subscription[field.key]])))}
                            className={
                                [
                                    allMatching || selectedIds.has(subscription.id) ? 'bg-brand-50' : '',
                                    isFarBehind(subscription.outstandingBalance, subscription.weeklyMinimumPayment) ? 'is-far-behind' : '',
                                ]
                                    .filter(Boolean)
                                    .join(' ') || undefined
                            }
                        >
                            {canSelect && (
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={allMatching || selectedIds.has(subscription.id)}
                                        onChange={() => toggleSubscription(subscription.id)}
                                        aria-label={`تحديد ${subscription.display_name}`}
                                        className="rounded border-gray-300 text-brand-600"
                                    />
                                </td>
                            )}
                            <td className="text-gray-600">
                                <span dir="ltr">{subscription.account_number}</span>
                                {subscription.subscriber_number && (
                                    <span className="mt-1 block text-xs text-gray-400">
                                        رقم المشترك <bdi dir="ltr">{subscription.subscriber_number}</bdi>
                                    </span>
                                )}
                            </td>
                            <td data-print-value={subscription.display_name}>
                                <RowIdentity
                                    name={subscription.display_name}
                                    onNameClick={() => openStatement(subscription)}
                                    nameTitle="كشف الحساب"
                                    subtitle={<PhoneQuickEdit subscription={subscription} />}
                                    status={STATUS_TONES[subscription.status]}
                                />
                                {subscription.subscriptionCount > 1 && (
                                    <span className="mt-1 block text-xs text-gray-500">{subscription.subscriptionCount} اشتراكات</span>
                                )}
                            </td>
                            <td>
                                <AreaChip id={subscription.subAreaId} name={subscription.subAreaName} />
                            </td>
                            <td className="text-gray-600">
                                <MeterBoxCell name={subscription.meterBoxName} number={subscription.meterBoxNumber} />
                            </td>
                            <td className="text-gray-600">
                                <TariffTag category={subscription.tariffCategory} label={subscription.tariffCategoryLabel} />
                                {subscription.tariffSegmentName && <div className="text-xs text-gray-400">{subscription.tariffSegmentName}</div>}
                            </td>
                            <td className="whitespace-nowrap text-gray-600">{formatShekels(subscription.weeklyMinimumPayment)}</td>
                            <td className="whitespace-nowrap font-semibold">
                                <Balance value={subscription.outstandingBalance} chip />
                            </td>
                            <td>
                                <StatusPill tone={STATUS_TONES[subscription.status]} label={subscription.statusLabel} />
                                {subscription.archivedAt && (
                                    <span className="mt-1 block text-xs text-gray-500">إنهاء الخدمة {formatDate(subscription.serviceEndedOn)}</span>
                                )}
                            </td>
                            <td className="text-end">
                                <RowActionsMenu
                                    onView={() => setViewingSubscriptionId(subscription.id)}
                                    onEdit={subscription.canUpdate ? () => setModalSubscription(subscription) : undefined}
                                    onDelete={
                                        subscription.canDelete
                                            ? () => requestDelete(`/subscriptions/${subscription.id}`, subscription.display_name)
                                            : undefined
                                    }
                                    menu={rowMenu(subscription)}
                                />
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );
}
