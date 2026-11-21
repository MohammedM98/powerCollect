import { Button } from '@heroui/react';
import { useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import AreaChip from '@/Components/DataTable/AreaChip';
import MeterBoxCell from '@/Components/DataTable/MeterBoxCell';
import Pagination from '@/Components/DataTable/Pagination';
import RowIdentity from '@/Components/DataTable/RowIdentity';
import Icon from '@/Components/Icon';
import { useDataTable } from '@/hooks/useDataTable';
import { useStatementWindow } from '@/hooks/useStatementWindow';
import { describeBalance } from '@/lib/accountStatement';
import { isFarBehind } from '@/lib/balance';
import { balanceText, BALANCE_CHIPS } from '@/Pages/Subscriptions/AccountFormParts';
import ChargeModal from '@/Pages/Subscriptions/ChargeModal';
import ClearingModal from '@/Pages/Subscriptions/ClearingModal';
import DiscountModal from '@/Pages/Subscriptions/DiscountModal';
import PaymentModal from '@/Pages/Subscriptions/PaymentModal';
import StatementModal from '@/Pages/Subscriptions/LazyStatementModal';
import SplitPaymentModal from './SplitPaymentModal';
import PageHeader from '@/Components/PageHeader';
import { needsPermission } from '@/lib/permissions';
import { ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, StatusPill } from '@/Components/UI';

const STATUS_TONES = { active: 'green', suspended: 'amber', disconnected: 'gray' };

/** Why a menu action is locked: the permission it needs and who grants it. */

/**
 * The quick payments page: the subscribers in a table to search and filter, each with a button to record
 * their payment and a menu for the account's other lines (a split transfer,
 * a charge, a discount, a clearing), and a main button for one bank transfer
 * shared between several subscribers.
 */
export default function Index({
    subscriptions,
    scopeLabel,
    filters,
    filterOptions,
    pendingCount,
    paymentMethods,
    canSplitPayments,
    transferBanks,
    senderBanks,
    chargeTypes,
    discountMethods,
    discountSegments,
    statement,
}) {
    const { can } = usePage().props;
    const { search, setSearch, sort, setPage, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable('/payments', filters, {}, {
        only: ['subscriptions', 'filters', 'filterOptions', 'pendingCount', 'can', 'paymentMethods', 'canSplitPayments'],
    });
    const statementWindow = useStatementWindow(statement);
    const [paying, setPaying] = useState(null);
    // The split transfer form, open: `{ subscription }` starts it with that subscriber, `{}` empty.
    const [splitting, setSplitting] = useState(null);
    // The account form open over the table: `{ form: 'charge' | 'discount' | 'clearing', subscription }`.
    const [adjusting, setAdjusting] = useState(null);

    /** A subscriber's statement over the list, for whoever may read subscriber accounts. */
    function openStatement(subscription) {
        statementWindow.open({
            id: subscription.id,
            fullName: subscription.fullName,
            accountNumber: subscription.accountNumber,
            status: subscription.status,
            statusLabel: subscription.statusLabel,
            branchName: subscription.branchName,
        });
    }

    /** The row's ⋯ menu: the account's other lines, besides the payment button beside it. */
    function rowMenu(subscription) {
        const splitLock = canSplitPayments ? null : needsPermission('الدفع بتحويل بنكي');

        return {
            title: subscription.fullName,
            subtitle: subscription.phone,
            groups: [
                {
                    label: 'الحساب المالي',
                    items: [
                        ...(can?.viewSubscriptions ? [{ label: 'كشف الحساب', icon: 'ledger', tone: 'graphite', shortcut: 'S', onSelect: () => openStatement(subscription) }] : []),
                        { label: 'دفعة مقسّمة', icon: 'layers', tone: 'brand', hint: 'تحويل واحد لعدة مشتركين', onSelect: () => setSplitting({ subscription }), lockedReason: splitLock },
                        { label: 'تحميل حركة', icon: 'document-plus', tone: 'amber', hint: 'غرامة أو رسوم', onSelect: () => setAdjusting({ form: 'charge', subscription }), lockedReason: subscription.canAddCharge ? null : needsPermission('إضافة تحميل') },
                        { label: 'إضافة خصم', icon: 'discount', tone: 'violet', onSelect: () => setAdjusting({ form: 'discount', subscription }), lockedReason: subscription.canAddDiscount ? null : needsPermission('إضافة خصم') },
                        { label: 'مقاصة', icon: 'scale', tone: 'teal', onSelect: () => setAdjusting({ form: 'clearing', subscription }), lockedReason: subscription.canAddClearing ? null : needsPermission('إضافة مقاصة') },
                    ].filter((item) => !item.lockedReason),
                },
            ],
        };
    }

    return (
        <AuthenticatedLayout
            badges={{ '/payments/summary': pendingCount }}
            header={
                <PageHeader
                    title="تسجيل الدفعات"
                    info={`استلم دفعة من مشترك واطبع وصلها${scopeLabel && scopeLabel !== '—' ? `، في ${scopeLabel}` : ''}.`}
                    actions={
                        canSplitPayments && (
                            // A split payment in its own colour, as every split is across the site (the redesign's money tones).
                            <Button data-raw="" variant="ghost" className="gl-act is-solid" data-tone="split" onClick={() => setSplitting({})}>
                                <Icon name="layers" className="h-4 w-4" />
                                دفعة مقسّمة على عدة مشتركين
                            </Button>
                        )
                    }
                />
            }
        >
            <Head title="تسجيل الدفعات" />

            <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="بحث بالاسم أو رقم الحساب أو الجوال أو رقم الطبلون..."
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={subscriptions.total}
                filterMenu={
                    <DataTableFilterMenu
                        tableKey="payments"
                        groups={filterOptions}
                        values={filterValues}
                        onChange={setFilter}
                        onChangeMany={setFilters}
                        onClear={clearFilters}
                    />
                }
            />

            <div className="data-table-container">
                <ListTable aria-label="الدفعات" sort={filters} onSort={sort}>
                    <ListHeader>
                        <ListColumn id="account_number" sortable>رقم الاشتراك</ListColumn>
                        <ListColumn id="display_name" sortable isRowHeader>اسم الاشتراك</ListColumn>
                        <ListColumn id="sub_area">منطقة 2</ListColumn>
                        <ListColumn id="meter_box">الطبلون</ListColumn>
                        <ListColumn id="outstanding_balance" sortable>الرصيد</ListColumn>
                        <ListColumn id="status" sortable>الحالة</ListColumn>
                        <ListColumn actions />
                    </ListHeader>
                    <ListBody empty={<span className="text-gray-500">لا توجد نتائج مطابقة.</span>}>
                        {subscriptions.data.map((subscription) => {
                            const described = describeBalance(subscription.balance);

                            return (
                                // The row opens the subscriber's statement; «تسجيل دفعة» takes a payment.
                                <ListRow
                                    key={subscription.id}
                                    id={subscription.id}
                                    onOpen={can?.viewSubscriptions ? () => openStatement(subscription) : null}
                                    className={isFarBehind(subscription.balance, subscription.weeklyMinimumPayment) ? 'is-far-behind' : undefined}
                                >
                                    <ListCell className="text-gray-600">
                                        <span dir="ltr">{subscription.accountNumber}</span>
                                        {subscription.subscriberNumber && (
                                            <span className="mt-1 block text-xs text-gray-400">
                                                رقم المشترك <bdi dir="ltr">{subscription.subscriberNumber}</bdi>
                                            </span>
                                        )}
                                    </ListCell>
                                    <ListCell>
                                        <RowIdentity
                                            name={subscription.fullName}
                                            subtitle={subscription.phone}
                                            subtitleDir="ltr"
                                            status={STATUS_TONES[subscription.status]}
                                            onNameClick={can?.viewSubscriptions ? () => openStatement(subscription) : undefined}
                                            nameTitle="كشف الحساب"
                                        />
                                    </ListCell>
                                    <ListCell>
                                        <AreaChip id={subscription.subAreaId} name={subscription.subAreaName} />
                                    </ListCell>
                                    <ListCell className="text-gray-600">
                                        <MeterBoxCell name={subscription.meterBoxName} number={subscription.meterBoxNumber} />
                                    </ListCell>
                                    <ListCell>
                                        <span className={`inline-block whitespace-nowrap rounded-[10px] px-3 py-1 font-display text-[14.5px] font-bold ${BALANCE_CHIPS[described.tone]}`}>
                                            {balanceText(described)}
                                        </span>
                                    </ListCell>
                                    <ListCell>
                                        <StatusPill tone={STATUS_TONES[subscription.status]} label={subscription.statusLabel} />
                                    </ListCell>
                                    <ListCell className="text-end">
                                        <RowActionsMenu
                                            onView={() => setPaying(subscription)}
                                            viewLabel="تسجيل دفعة"
                                            viewIcon="banknotes"
                                            menu={can?.viewSubscriptions || canSplitPayments || subscription.canAddCharge || subscription.canAddDiscount || subscription.canAddClearing ? rowMenu(subscription) : null}
                                        />
                                    </ListCell>
                                </ListRow>
                            );
                        })}
                    </ListBody>
                </ListTable>
            </div>

            <Pagination meta={subscriptions} onPageChange={setPage} />

            {paying && (
                <PaymentModal
                    key={paying.id}
                    show
                    onClose={() => setPaying(null)}
                    subscription={paying}
                    balance={paying.balance}
                    paymentMethods={paymentMethods}
                    transferBanks={transferBanks}
                    senderBanks={senderBanks}
                />
            )}

            {adjusting?.form === 'charge' && (
                <ChargeModal key={`charge-${adjusting.subscription.id}`} show onClose={() => setAdjusting(null)} subscription={adjusting.subscription} balance={adjusting.subscription.balance} chargeTypes={chargeTypes} />
            )}

            {adjusting?.form === 'discount' && (
                <DiscountModal
                    key={`discount-${adjusting.subscription.id}`}
                    show
                    onClose={() => setAdjusting(null)}
                    subscription={adjusting.subscription}
                    balance={adjusting.subscription.balance}
                    discountMethods={discountMethods}
                    discountSegments={discountSegments}
                />
            )}

            {adjusting?.form === 'clearing' && (
                <ClearingModal key={`clearing-${adjusting.subscription.id}`} show onClose={() => setAdjusting(null)} subscription={adjusting.subscription} balance={adjusting.subscription.balance} />
            )}

            {splitting && (
                <SplitPaymentModal
                    key={splitting.subscription?.id ?? 'split'}
                    onClose={() => setSplitting(null)}
                    transferBanks={transferBanks}
                    senderBanks={senderBanks}
                    initialSubscription={splitting.subscription ?? null}
                />
            )}
            {statementWindow.subscription && (
                <StatementModal
                    key={statementWindow.subscription.id}
                    subscription={statementWindow.subscription}
                    statement={statementWindow.statement}
                    initialForm={statementWindow.form}
                    onSwitch={(header) => statementWindow.open(header)}
                    onClose={statementWindow.close}
                />
            )}
        </AuthenticatedLayout>
    );
}
