import { Fragment, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { Button, Card } from '@heroui/react';
import Icon from '@/Components/Icon';
import { printFieldsProps, printRowProps } from '@/lib/print';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { BranchFilterBanner, splitBranchFilter } from '@/Components/BranchBanner';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import Pagination from '@/Components/DataTable/Pagination';
import RowIdentity from '@/Components/DataTable/RowIdentity';
import SortableTh from '@/Components/DataTable/SortableTh';
import { useDataTable } from '@/hooks/useDataTable';
import { useRowClick } from '@/hooks/useRowClick';
import { useStatementWindow } from '@/hooks/useStatementWindow';
import { formatMoney, formatNumber, formatShortDay } from '@/lib/format';
import StatementModal from '@/Pages/Subscriptions/StatementModal';
import PageHeader from '@/Components/PageHeader';
import MoneyFlow from '@/Components/Finance/MoneyFlow';

const STATUS_DOTS = { active: 'green', suspended: 'amber', disconnected: 'gray' };


/** Each age bucket's column title: short, so the table fits beside the menu; the page says they are days. */
const BUCKET_COLUMNS = { current: 'حتى 30', days_60: '31–60', days_90: '61–90', older: 'فوق 90' };

function Shekels({ amount, className = 'text-gray-900' }) {
    return (
        <span className={`whitespace-nowrap ${className}`}>
            <b className="font-display font-bold">{formatMoney(amount)}</b> <span className="text-xs font-normal text-gray-500">₪</span>
        </span>
    );
}

/** What print and Excel add as a column of their own: the last payment, which on screen opens under its row. */
const PRINT_FIELDS = [{ key: 'lastPayment', label: 'آخر دفعة', default: true }];

/** The last payment as one line: "منذ 3 يوم، 16 نوفمبر", or that none was made. */
function lastPaymentText(debtor) {
    return debtor.lastPaymentDate ? `${daysAgo(debtor.lastPaymentDays)}، ${formatShortDay(debtor.lastPaymentDate)}` : 'لم يدفع بعد';
}

function Dash() {
    return <span className="text-gray-500">—</span>;
}

/** "منذ 45 يومًا", or "اليوم". */
function daysAgo(days) {
    return days === 0 ? 'اليوم' : `منذ ${formatNumber(days)} يوم`;
}

const BUCKET_COLORS = { current: 'var(--ma-pay)', days_60: 'var(--ma-warn)', days_90: 'color-mix(in oklab, var(--ma-owe) 60%, var(--ma-warn))', older: 'var(--ma-owe)' };

/**
 * The debt split by age, as an aged-receivables report draws it: one bar
 * cut by age from green (recent) to red (oldest), then each bucket's
 * amount, share and how many owe in it, on HeroUI cards.
 */
function AgeBreakdown({ buckets, summary }) {
    return (
        <Card className="gl-age">
            <Card.Header className="gl-age-head">
                <span className="gl-set-ico" aria-hidden="true"><Icon name="clock" /></span>
                <Card.Title className="gl-set-title">توزيع المستحق حسب العمر</Card.Title>
                <span className="gl-age-note">الدفعات تسدّد أقدم الديون أولًا</span>
            </Card.Header>
            <Card.Content>
                {summary.count === 0 ? (
                    <p className="gl-age-empty">لا توجد ديون مطابقة.</p>
                ) : (
                    <>
                        <div className="gl-age-bar" role="img" aria-label={buckets.map((bucket) => `${bucket.label}: ${summary.buckets[bucket.key].share}%`).join('، ')}>
                            {buckets.map((bucket) => summary.buckets[bucket.key].share > 0 && (
                                <span key={bucket.key} style={{ width: `${summary.buckets[bucket.key].share}%`, background: BUCKET_COLORS[bucket.key] }} />
                            ))}
                        </div>
                        <ul className="gl-age-legend">
                            {buckets.map((bucket) => {
                                const figures = summary.buckets[bucket.key];

                                return (
                                    <li key={bucket.key}>
                                        <small><i style={{ background: BUCKET_COLORS[bucket.key] }} aria-hidden="true" />{bucket.label}</small>
                                        <b><bdi dir="ltr">{formatMoney(figures.amount)}</bdi> <span>₪</span></b>
                                        <span>{figures.share}%، {formatNumber(figures.count)} مشترك</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </Card.Content>
        </Card>
    );
}

/** One of the aging figures on a HeroUI card; `dark` puts it on the prototype's charcoal. */
function Figure({ label, value, unit = null, hint, tone = null, dark = false }) {
    return (
        <Card className="gl-age-fig" data-tone={tone ?? undefined} data-dark={dark || undefined}>
            <small>{label}</small>
            <b>{value === null ? '—' : <><bdi dir="ltr">{value}</bdi>{unit && <span> {unit}</span>}</>}</b>
            <p>{hint}</p>
        </Card>
    );
}

/**
 * The debts report: every subscription who owes money, with their debt
 * split by how old it is, the totals per age, and the oldest debt and
 * last payment of each. Every figure follows the search and the filters;
 * a row opens the subscription's statement over the page.
 */
export default function Index({ debtors, summary, collection = null, buckets, scopeLabel, branchScope, filters, filterOptions, statement }) {
    const { can } = usePage().props;
    const { search, setSearch, sort, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable('/receivables', filters);
    const rowClick = useRowClick();
    const statementWindow = useStatementWindow(statement);
    const columnCount = 4 + buckets.length;
    const [openIds, setOpenIds] = useState(() => new Set());
    const toggleRow = (id) => setOpenIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
    const pageTotal = debtors.data.reduce((total, debtor) => total + Number(debtor.balance), 0);
    const overdue = summary.buckets.older;
    // The Super Admin picks the branch in the banner above the report, not among the filters; clearing those keeps it.
    const branchFilter = splitBranchFilter(branchScope, filterOptions, filterValues);

    /** A debtor, in the shape the statement window's header reads. */
    function openStatement(debtor) {
        statementWindow.open({
            id: debtor.id,
            fullName: debtor.name,
            accountNumber: debtor.accountNumber,
            status: debtor.status,
            statusLabel: debtor.statusLabel,
            branchName: debtor.branchName,
        });
    }

    return (
        <AuthenticatedLayout
            scope={branchScope?.name ?? null}
            header={
                <PageHeader title="أعمار الديون" info={`الذمم المتأخرة حسب مدتها${!branchScope && scopeLabel && scopeLabel !== '—' ? `، في ${scopeLabel}` : ''}. المبالغ بالشيكل والأعمار بالأيام.`} />
            }
        >
            <Head title="أعمار الديون" />
            {branchScope && <BranchFilterBanner scope={branchScope} eyebrow="تعرض الآن ديون مشتركي" group={branchFilter.branch} value={filterValues.branch_id} onChange={(value) => setFilter('branch_id', value)} />}

            <MoneyFlow />
            <div className="gl-age-figs">
                <Figure dark label="إجمالي المستحق" value={formatMoney(summary.total)} unit="₪" hint={`${formatNumber(summary.count)} مشترك مدين، متوسط ${formatMoney(summary.average)} ₪`} />
                <Figure tone="pay" label="نسبة التحصيل، آخر 30 يومًا" value={collection?.collectionRate === null || !collection ? null : `${collection.collectionRate}%`} hint={collection ? `حُصّل ${formatMoney(collection.collected30)} من ${formatMoney(collection.charged30)} ₪ مُحمَّلة` : 'لا تحميل في الفترة'} />
                <Figure label="متوسط أيام التحصيل (DSO)" value={collection?.dso ?? null} unit={collection?.dso !== null && collection ? 'يومًا' : null} hint="المستحق مقابل متوسط تحميل اليوم في 90 يومًا، كلما قلّ كان أفضل" />
                <Figure tone="owe" label="أكثر من 90 يومًا" value={formatMoney(overdue.amount)} unit="₪" hint={`${overdue.share}% من المستحق، ${formatNumber(overdue.count)} مشترك`} />
            </div>

            <div className="mt-5">
                <AgeBreakdown buckets={buckets} summary={summary} />
            </div>

            <div className="mt-5">
                <DataTableToolbar
                    search={search}
                    onSearchChange={setSearch}
                    placeholder="بحث باسم المشترك أو رقم الحساب أو الطبلون..."
                    perPage={filters.per_page}
                    onPerPageChange={setPerPage}
                    total={debtors.total}
                    filterMenu={
                        <DataTableFilterMenu
                            tableKey="receivables"
                            groups={branchFilter.groups}
                            values={branchFilter.values}
                            onChange={setFilter}
                            onChangeMany={setFilters}
                            onClear={() => branchFilter.clear(setFilters, clearFilters)}
                        />
                    }
                />

                <div className="data-table-container">
                    <table className="data-table w-full text-start text-sm" {...printFieldsProps(PRINT_FIELDS)}>
                        <thead>
                            <tr>
                                <th data-actions="" className="dt-exp"><span className="sr-only">تفاصيل</span></th>
                                <SortableTh column="name" label="المشترك" sortState={filters} onSort={sort} />
                                <SortableTh column="balance" label="الرصيد المستحق" sortState={filters} onSort={sort} />
                                {buckets.map((bucket) => (
                                    <SortableTh key={bucket.key} column={bucket.key} label={BUCKET_COLUMNS[bucket.key] ?? bucket.label} sortState={filters} onSort={sort} />
                                ))}
                                <SortableTh column="oldest_days" label="أقدم دين" sortState={filters} onSort={sort} />
                            </tr>
                        </thead>
                        <tbody>
                            {debtors.data.length === 0 ? (
                                <tr>
                                    <td colSpan={columnCount}>لا يوجد مشتركون مدينون مطابقون.</td>
                                </tr>
                            ) : (
                                debtors.data.map((debtor) => {
                                    const open = openIds.has(debtor.id);

                                    return (
                                    <Fragment key={debtor.id}>
                                    <tr {...rowClick(can?.viewSubscriptions ? () => openStatement(debtor) : null)} {...printRowProps({ lastPayment: lastPaymentText(debtor) })} className={open ? 'is-open' : undefined}>
                                        <td className="dt-exp">
                                            <Button data-raw="" variant="ghost" className="dt-exp-btn" aria-expanded={open} aria-controls={`debtor-details-${debtor.id}`} aria-label={`${open ? 'إخفاء' : 'عرض'} تفاصيل ${debtor.name}`} onClick={(event) => { event.stopPropagation(); toggleRow(debtor.id); }}>
                                                <Icon name="chevron-down" className="h-4 w-4" />
                                            </Button>
                                        </td>
                                        <td>
                                            <RowIdentity
                                                name={debtor.name}
                                                subtitle={`${debtor.accountNumber}، ${debtor.branchName}`}
                                                status={STATUS_DOTS[debtor.status]}
                                            />
                                        </td>
                                        <td>
                                            <Shekels amount={debtor.balance} />
                                        </td>
                                        {buckets.map((bucket) => (
                                            <td key={bucket.key}>
                                                {debtor.buckets[bucket.key] > 0 ? (
                                                    <b className="gl-age-heat" data-bucket={bucket.key}>
                                                        {formatMoney(debtor.buckets[bucket.key])}
                                                    </b>
                                                ) : (
                                                    <Dash />
                                                )}
                                            </td>
                                        ))}
                                        <td className="whitespace-nowrap">
                                            {debtor.oldestDate ? (
                                                <>
                                                    <span className="font-semibold text-gray-900">{daysAgo(debtor.oldestDays)}</span>
                                                    <span className="block text-xs text-gray-500">{formatShortDay(debtor.oldestDate)}</span>
                                                </>
                                            ) : (
                                                <Dash />
                                            )}
                                        </td>
                                    </tr>
                                    {open && (
                                        <tr id={`debtor-details-${debtor.id}`} className="dt-detail" data-print-skip="">
                                            <td colSpan={columnCount}>
                                                <dl>
                                                    <div>
                                                        <dt>آخر دفعة</dt>
                                                        <dd>{lastPaymentText(debtor)}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>الحساب</dt>
                                                        <dd><bdi dir="ltr">{debtor.accountNumber}</bdi></dd>
                                                    </div>
                                                    <div>
                                                        <dt>الفرع</dt>
                                                        <dd>{debtor.branchName}</dd>
                                                    </div>
                                                    {debtor.statusLabel && (
                                                        <div>
                                                            <dt>حالة المشترك</dt>
                                                            <dd>{debtor.statusLabel}</dd>
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
                </div>

                {debtors.data.length > 0 && (
                    <div className="data-table-totals text-sm text-gray-500">
                        <span>
                            مجموع هذه الصفحة: <Shekels amount={pageTotal} />
                        </span>
                        <span>
                            إجمالي الديون: <Shekels amount={summary.total} className="text-brand-600" />
                        </span>
                    </div>
                )}

                <Pagination meta={debtors} filters={filters} baseUrl="/receivables" />
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
