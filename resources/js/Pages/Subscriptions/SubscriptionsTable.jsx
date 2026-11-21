import { useState } from 'react';
import { Button, Checkbox } from '@heroui/react';
import Icon from '@/Components/Icon';
import AreaChip from '@/Components/DataTable/AreaChip';
import MeterBoxCell from '@/Components/DataTable/MeterBoxCell';
import TariffTag from '@/Components/DataTable/TariffTag';
import { isFarBehind } from '@/lib/balance';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import RowIdentity from '@/Components/DataTable/RowIdentity';
import { printFieldsProps, printRowProps } from '@/lib/print';
import { formatShekels } from '@/lib/currency';
import PhoneQuickEdit from './PhoneQuickEdit';
import Balance from '@/Components/Balance';
import { formatDate } from '@/lib/format';
import { BandRow, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, StatusPill } from '@/Components/UI';

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
    openStatement,
    pageIds,
    pageSelectedCount,
    requestDelete,
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

    function toggleDetails(id) {
        setOpenIds((current) => {
            const next = new Set(current);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    return (
        <ListTable aria-label="الاشتراكات" sort={filters} onSort={sort} {...printFieldsProps(PRINT_FIELDS)}>
            <ListHeader>
                <ListColumn id="expand" data-actions="" className="dt-exp">
                    <span className="sr-only">تفاصيل</span>
                </ListColumn>
                {canSelect && (
                    <ListColumn id="select" data-actions="" className="w-10">
                        <Checkbox
                            slot={null}
                            isSelected={allMatching || (pageIds.length > 0 && pageSelectedCount === pageIds.length)}
                            isIndeterminate={!allMatching && pageSelectedCount > 0 && pageSelectedCount < pageIds.length}
                            onChange={togglePage}
                            aria-label="تحديد كل مشتركي هذه الصفحة"
                        >
                            <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
                        </Checkbox>
                    </ListColumn>
                )}
                <ListColumn id="account_number" sortable>رقم الاشتراك</ListColumn>
                <ListColumn id="display_name" sortable isRowHeader>اسم الاشتراك</ListColumn>
                <ListColumn id="sub_area">منطقة 2</ListColumn>
                <ListColumn id="meter_box">الطبلون</ListColumn>
                <ListColumn id="minimum">الحد الأدنى</ListColumn>
                <ListColumn id="balance">الرصيد</ListColumn>
                <ListColumn id="status" sortable>الحالة</ListColumn>
                <ListColumn actions />
            </ListHeader>
            {/* The row and name open the statement; «عرض» opens the subscriber's details. */}
            <ListBody empty={<span className="text-gray-500">لا توجد نتائج مطابقة.</span>}>
                {subscriptions.data.flatMap((subscription) => {
                    const open = openIds.has(subscription.id);

                    return [
                        <ListRow
                            key={subscription.id}
                            id={subscription.id}
                            onOpen={() => openStatement(subscription)}
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
                            <ListCell className="dt-exp">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="ghost"
                                    className="dt-exp-btn"
                                    aria-expanded={open}
                                    aria-controls={`subscription-details-${subscription.id}`}
                                    aria-label={`${open ? 'إخفاء' : 'عرض'} تفاصيل ${subscription.display_name}`}
                                    onPress={() => toggleDetails(subscription.id)}
                                >
                                    <Icon name="chevron-down" className="h-4 w-4" />
                                </Button>
                            </ListCell>
                            {canSelect && (
                                <ListCell>
                                    <Checkbox
                                        isSelected={allMatching || selectedIds.has(subscription.id)}
                                        onChange={() => toggleSubscription(subscription.id)}
                                        aria-label={`تحديد ${subscription.display_name}`}
                                    >
                                        <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
                                    </Checkbox>
                                </ListCell>
                            )}
                            <ListCell className="text-gray-600">
                                <span dir="ltr">{subscription.account_number}</span>
                                {subscription.subscriber_number && (
                                    <span className="mt-1 block text-xs text-gray-400">
                                        رقم المشترك <bdi dir="ltr">{subscription.subscriber_number}</bdi>
                                    </span>
                                )}
                            </ListCell>
                            <ListCell data-print-value={subscription.display_name}>
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
                            </ListCell>
                            <ListCell>
                                <AreaChip id={subscription.subAreaId} name={subscription.subAreaName} />
                            </ListCell>
                            <ListCell className="text-gray-600">
                                <MeterBoxCell name={subscription.meterBoxName} number={subscription.meterBoxNumber} />
                            </ListCell>
                            <ListCell className="whitespace-nowrap text-gray-600">{formatShekels(subscription.weeklyMinimumPayment)}</ListCell>
                            <ListCell className="whitespace-nowrap font-semibold">
                                <Balance value={subscription.outstandingBalance} chip className="font-extrabold" />
                            </ListCell>
                            <ListCell>
                                <StatusPill tone={STATUS_TONES[subscription.status]} label={subscription.statusLabel} />
                                {subscription.archivedAt && (
                                    <span className="mt-1 block text-xs text-gray-500">
                                        إنهاء الخدمة {formatDate(subscription.serviceEndedOn)}
                                    </span>
                                )}
                            </ListCell>
                            <ListCell className="text-end">
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
                            </ListCell>
                        </ListRow>,
                        ...(open ? [
                            <BandRow key={`detail-${subscription.id}`} id={`detail-${subscription.id}`} columns={columnCount} className="dt-detail" data-print-skip="">
                                <dl id={`subscription-details-${subscription.id}`}>
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
                            </BandRow>,
                        ] : []),
                    ];
                })}
            </ListBody>
        </ListTable>
    );
}
