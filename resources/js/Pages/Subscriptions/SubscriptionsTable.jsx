import { Fragment, useState } from 'react';
import Icon from '@/Components/Icon';
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
    { key: 'tariffLabel', label: 'نوع الاشتراك', default: true, after: 'الطبلون' },
    { key: 'branchName', label: 'الفرع' },
];

/** A subscription's type as one line: its tariff, then its customer category. */
function tariffText(subscription) {
    return [subscription.tariffCategoryLabel, subscription.tariffSegmentName].filter(Boolean).join('، ');
}

/**
 * The subscriptions as a table, in the redesign's seven columns: the
 * sortable heads, a row per subscription with its balance and status, and
 * each row's actions. The subscription's type, category and branch open
 * under the row with its chevron (print and Excel keep the type as a column).
 */
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
    const [openIds, setOpenIds] = useState(() => new Set());
    const columnCount = canSelect ? 10 : 9;

    function toggleDetails(event, id) {
        event.stopPropagation();
        setOpenIds((current) => {
            const next = new Set(current);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    return (
        <table className="data-table w-full text-sm text-start" {...printFieldsProps(PRINT_FIELDS)}>
            <thead>
                <tr>
                    <th data-actions="" className="dt-exp">
                        <span className="sr-only">تفاصيل</span>
                    </th>
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
                    <th>الحد الأدنى</th>
                    <th>الرصيد</th>
                    <SortableTh column="status" label="الحالة" sortState={filters} onSort={sort} />
                    <ActionsTh />
                </tr>
            </thead>
            <tbody>
                {subscriptions.data.length === 0 ? (
                    <tr>
                        <td className="text-gray-500" colSpan={columnCount}>
                            لا توجد نتائج مطابقة.
                        </td>
                    </tr>
                ) : (
                    // The row and name open the statement; «عرض» opens the subscriber's details.
                    subscriptions.data.map((subscription) => {
                        const open = openIds.has(subscription.id);

                        return (
                            <Fragment key={subscription.id}>
                                <tr
                                    {...rowClick(() => openStatement(subscription))}
                                    {...printRowProps(
                                        Object.fromEntries(
                                            PRINT_FIELDS.map((field) => [
                                                field.key,
                                                field.key === 'tariffLabel' ? tariffText(subscription) : subscription[field.key],
                                            ]),
                                        ),
                                    )}
                                    className={
                                        [
                                            allMatching || selectedIds.has(subscription.id) ? 'bg-brand-50' : '',
                                            open ? 'is-open' : '',
                                            isFarBehind(subscription.outstandingBalance, subscription.weeklyMinimumPayment) ? 'is-far-behind' : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ') || undefined
                                    }
                                >
                                    <td className="dt-exp">
                                        <button
                                            type="button"
                                            className="dt-exp-btn"
                                            aria-expanded={open}
                                            aria-controls={`subscription-details-${subscription.id}`}
                                            aria-label={`${open ? 'إخفاء' : 'عرض'} تفاصيل ${subscription.display_name}`}
                                            onClick={(event) => toggleDetails(event, subscription.id)}
                                        >
                                            <Icon name="chevron-down" className="h-4 w-4" />
                                        </button>
                                    </td>
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
                                    <td className="whitespace-nowrap text-gray-600">{formatShekels(subscription.weeklyMinimumPayment)}</td>
                                    <td className="whitespace-nowrap font-semibold">
                                        <Balance value={subscription.outstandingBalance} chip />
                                    </td>
                                    <td>
                                        <StatusPill tone={STATUS_TONES[subscription.status]} label={subscription.statusLabel} />
                                        {subscription.archivedAt && (
                                            <span className="mt-1 block text-xs text-gray-500">
                                                إنهاء الخدمة {formatDate(subscription.serviceEndedOn)}
                                            </span>
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
                                {open && (
                                    <tr id={`subscription-details-${subscription.id}`} className="dt-detail" data-print-skip="">
                                        <td colSpan={columnCount}>
                                            <dl>
                                                <div>
                                                    <dt>نوع الاشتراك</dt>
                                                    <dd>
                                                        <TariffTag category={subscription.tariffCategory} label={subscription.tariffCategoryLabel} />
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt>تصنيف الزبائن</dt>
                                                    <dd>{subscription.tariffSegmentName || '—'}</dd>
                                                </div>
                                                <div>
                                                    <dt>الفرع</dt>
                                                    <dd>{subscription.branchName || '—'}</dd>
                                                </div>
                                                {subscription.subscriber_number && (
                                                    <div>
                                                        <dt>رقم المشترك</dt>
                                                        <dd>
                                                            <bdi dir="ltr">{subscription.subscriber_number}</bdi>
                                                        </dd>
                                                    </div>
                                                )}
                                            </dl>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })
                )}
            </tbody>
        </table>
    );
}
