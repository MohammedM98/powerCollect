import { Fragment } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import Pagination from '@/Components/DataTable/Pagination';
import RowIdentity from '@/Components/DataTable/RowIdentity';
import Icon from '@/Components/Icon';
import { Chip } from '@heroui/react';
import { Figure } from '@/Components/UI';
import PeriodTabs, { periodCaption } from '@/Components/PeriodTabs';
import { useDataTable } from '@/hooks/useDataTable';
import { useRowClick } from '@/hooks/useRowClick';
import { useStatementWindow } from '@/hooks/useStatementWindow';
import { formatClock, formatDayLabel, formatMoney, formatNumber } from '@/lib/format';
import StatementModal from '@/Pages/Subscriptions/StatementModal';
import PageHeader from '@/Components/PageHeader';

const STATUS_DOTS = { active: 'green', suspended: 'amber', disconnected: 'gray' };

/** Each kind of change as a HeroUI chip in its MA tone: blue to edit, violet to correct, green to refund, amber to cancel, red to delete for good. */
const KIND_STYLES = {
    amendment: { icon: 'pencil', tone: 'clr' },
    cancellation: { icon: 'close', tone: 'warn' },
    correction: { icon: 'repeat', tone: 'disc' },
    refund: { icon: 'undo', tone: 'pay' },
    deletion: { icon: 'trash', tone: 'owe' },
};

/** What a change moved the subscriber's balance by: owed more (red, +), owed less (green, −), or nothing. */
function Impact({ value }) {
    const amount = Number(value ?? 0);
    if (amount === 0) {
        return <span className="gl-au-zero">0</span>;
    }

    return (
        <span className="gl-au-impact" data-tone={amount > 0 ? 'owe' : 'pay'}>
            <bdi dir="ltr">{amount > 0 ? '+' : '−'}{formatMoney(Math.abs(amount))}</bdi>
            <small>{amount > 0 ? 'على المشترك' : 'لصالح المشترك'}</small>
        </span>
    );
}

/** The value before and after the change: an edited field's old and new value, or the amount reversed and the corrected one. */
function BeforeAfter({ event, side }) {
    if (event.changes.length > 0) {
        return (
            <span className="gl-au-values">
                {event.changes.map((change) => (
                    <span key={change.label}>
                        <small>{change.label}</small>
                        {(side === 'before' ? change.from : change.to) === null || (side === 'before' ? change.from : change.to) === '' ? <Dash /> : <bdi className={side === 'before' ? 'gl-au-was' : 'gl-au-now'}>{valueText(side === 'before' ? change.from : change.to)}</bdi>}
                    </span>
                ))}
            </span>
        );
    }
    const value = event[side];

    return value === null || value === undefined ? <Dash /> : <bdi dir="ltr" className={side === 'before' ? 'gl-au-was' : 'gl-au-now'}>{formatMoney(value)}</bdi>;
}

function Dash() {
    return <span className="text-gray-300">—</span>;
}

function valueText(value) {
    return value === null || value === '' ? '—' : value;
}

/** A day's header row: its date, with "اليوم" on today. */
function DayHeader({ day, isToday }) {
    return (
        <tr className="data-table-group">
            <td colSpan={10}>
                <span className="gl-au-day">
                    {formatDayLabel(day)}
                    {isToday && <Chip size="sm" className="gl-au-today">اليوم</Chip>}
                </span>
            </td>
        </tr>
    );
}

/**
 * The audit log: every change made to the subscriptions' account lines after
 * they were recorded — edits, cancellations, corrections, refunds and
 * permanent deletions — newest first and grouped by day, with who made it
 * and why. The figures follow the period, the search and the filters.
 */
export default function Index({ events, period, counts, impactSummary = null, today, scopeLabel, filters, filterOptions, statement }) {
    const { can } = usePage().props;
    const { search, setSearch, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable('/transaction-audit', filters, { period });
    const rowClick = useRowClick();
    const statementWindow = useStatementWindow(statement);
    const caption = periodCaption(period);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    function changePeriod(next) {
        router.get(
            '/transaction-audit',
            { search, per_page: filters.per_page, filter: filterValues, period: next },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }

    /** A row's subscription, in the shape the statement window's header reads. */
    function openStatement(subscription) {
        statementWindow.open({
            id: subscription.id,
            fullName: subscription.name,
            accountNumber: subscription.accountNumber,
            status: subscription.status,
            statusLabel: subscription.statusLabel,
            branchName: subscription.branchName,
        });
    }

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    eyebrow={scopeLabel}
                    title="سجل التدقيق"
                    info="كل تعديل أو إلغاء أو حذف على حركات المشتركين: من قام به، ومتى، ولماذا."
                    actions={<PeriodTabs period={period} onChange={changePeriod} />}
                />
            }
        >
            <Head title="سجل التدقيق" />

            <div className="gl-rp-figs">
                <Figure dark label={`إجراءات على الحركات، ${caption}`} hint={impactSummary ? `من ${formatNumber(impactSummary.users)} موظف، صافي الأثر ${Number(impactSummary.net) > 0 ? '+' : ''}${formatMoney(impactSummary.net)} ₪` : `منها ${formatNumber(counts.refund)} إرجاع`}>{formatNumber(total)}</Figure>
                <Figure tone="clr" label="تعديلات" hint="بيانات عُدّلت في مكانها، دون تغيير المبالغ">{formatNumber(counts.amendment)}</Figure>
                <Figure tone="disc" label="إلغاءات وتصحيحات وإرجاعات" hint={impactSummary ? `بقيمة ${formatMoney(impactSummary.cancelled)} ₪` : `${formatNumber(counts.correction)} تصحيح، ${formatNumber(counts.cancellation)} إلغاء`}>{formatNumber(counts.cancellation + counts.correction + counts.refund)}</Figure>
                <Figure tone="owe" label="حسّاسة تحتاج مراجعة" hint="حذف نهائي، أو على حركة من صندوق مستلم">{impactSummary ? formatNumber(impactSummary.sensitive) : formatNumber(counts.deletion)}</Figure>
            </div>

            <div className="mt-6">
                <DataTableToolbar
                    search={search}
                    onSearchChange={setSearch}
                    placeholder="بحث باسم المشترك أو رقم الحساب أو الطبلون..."
                    perPage={filters.per_page}
                    onPerPageChange={setPerPage}
                    total={events.total}
                    filterMenu={
                        <DataTableFilterMenu
                            tableKey="transaction-audit"
                            groups={filterOptions}
                            values={filterValues}
                            onChange={setFilter}
                            onChangeMany={setFilters}
                            onClear={clearFilters}
                        />
                    }
                />

                <div className="data-table-container">
                    <table className="data-table gl-au-table w-full text-start text-sm">
                        <thead>
                            <tr>
                                <th>الوقت</th>
                                <th>الإجراء</th>
                                <th>المشترك</th>
                                <th>الحركة</th>
                                <th>قبل</th>
                                <th>بعد</th>
                                <th className="num">الأثر ₪</th>
                                <th>السبب</th>
                                <th>بواسطة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.data.length === 0 ? (
                                <tr>
                                    <td colSpan={9}>لا توجد إجراءات مطابقة في هذه الفترة.</td>
                                </tr>
                            ) : (
                                events.data.map((event, index) => {
                                    const style = KIND_STYLES[event.kind];

                                    return (
                                        <Fragment key={event.key}>
                                            {event.day !== events.data[index - 1]?.day && <DayHeader day={event.day} isToday={event.day === today} />}
                                            <tr className={event.sensitive ? 'gl-au-flag' : undefined} {...rowClick(can?.viewSubscriptions && event.subscription ? () => openStatement(event.subscription) : null)}>
                                                <td className="whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-2 font-semibold text-gray-900">
                                                        <Icon name="clock" className="h-4 w-4 text-gray-400" />
                                                        {formatClock(event.time)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <Chip size="sm" variant="soft" className="gl-au-kind" data-tone={style.tone}>
                                                        <Icon name={style.icon} className="h-3.5 w-3.5" />
                                                        {event.kindLabel}
                                                    </Chip>
                                                    {event.sensitive && <small className="gl-au-sensitive" title={event.sensitiveReason}>حسّاس، {event.sensitiveReason}</small>}
                                                    {event.kindNote && <span className="mt-1 block text-xs text-gray-500">{event.kindNote}</span>}
                                                </td>
                                                <td>
                                                    {event.subscription ? (
                                                        <RowIdentity
                                                            name={event.subscription.name}
                                                            subtitle={`${event.subscription.accountNumber}، ${event.subscription.branchName}`}
                                                            status={STATUS_DOTS[event.subscription.status]}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-500">مشترك محذوف</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="grid gap-1">
                                                        {event.lines.map((line, lineIndex) => (
                                                            <span key={lineIndex} className="whitespace-nowrap">
                                                                <span className="font-medium text-gray-900">{line.label}</span>{' '}
                                                                <b className="font-display font-bold text-gray-900">{line.amount}</b>{' '}
                                                                <span className="text-xs text-gray-500">₪</span>
                                                                {line.voucherNumber && (
                                                                    <span className="text-xs text-gray-500">
                                                                        {' '}
                                                                       ، سند <bdi dir="ltr">{line.voucherNumber}</bdi>
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td><BeforeAfter event={event} side="before" /></td>
                                                <td><BeforeAfter event={event} side="after" /></td>
                                                <td className="num"><Impact value={event.impact} /></td>
                                                <td className="gl-au-reason">{event.reason ?? <Dash />}{event.notes && <small>{event.notes}</small>}</td>
                                                <td className="gl-au-by">{event.userName ?? 'مستخدم محذوف'}</td>
                                            </tr>
                                        </Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination meta={events} filters={filters} baseUrl="/transaction-audit" extraParams={{ period }} />
            </div>

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
