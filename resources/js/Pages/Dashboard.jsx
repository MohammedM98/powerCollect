import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { urlWithout } from '@/lib/pageUrl';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useBranchView } from '@/hooks/useBranchView';
import Icon from '@/Components/Icon';
import Panel from '@/Components/Panel';
import { GoalRing } from '@/Components/StatRing';
import { useStatementWindow } from '@/hooks/useStatementWindow';
import { formatMoney, formatNumber, percentOf } from '@/lib/format';
import { formatWeekDay } from '@/lib/weekDays';
import { LatestPayments } from './Dashboard/DashboardPanels';
import DashboardWindows from './Dashboard/DashboardWindows';
import DashboardHeader from './Dashboard/DashboardHeader';
import { AttentionPanel, CollectionsHero, DebtorsPanel, MethodsPanel } from './Dashboard/DashboardFigures';
import DashboardActions from './Dashboard/DashboardActions';
import DashboardTiles from './Dashboard/DashboardTiles';

/** Each branch's (or collector's) collections in the period, as a ranked list with a bar each. */
function RankBars({ items }) {
    const top = Math.max(0, ...items.map((item) => Number(item.total) || 0));

    return (
        <ol className="gl-rank">
            {items.slice(0, 6).map((item, index) => (
                <li key={item.name ?? index}>
                    <span className="gl-rank-n gl-num">{index + 1}</span>
                    <span className="gl-rank-name">{item.name}</span>
                    <b className="gl-num">{formatMoney(item.total)} ₪</b>
                    <i aria-hidden="true"><span style={{ width: `${top > 0 ? ((Number(item.total) || 0) / top) * 100 : 0}%` }} /></i>
                </li>
            ))}
        </ol>
    );
}

/** The period's name on the tabs and in sentences. */
const periodLabel = (days) => (days === 7 ? '7 أيام' : `${days} يومًا`);

/**
 * The home page: the figures of the branches the user looks after over
 * the chosen period, laid out as in the redesign (docs/redesign): the
 * greeting with the governorate, branch and period; the quick actions as
 * pills, recording a payment first; what waits on someone beside the
 * period's collections and their chart; the overview tiles (subscribers,
 * meter boxes, amperes, debts); the largest debtors, the week's readings
 * and the collections by branch; how people paid beside the subscribers by
 * breaker; and the latest payments. The head of the company sees every
 * branch and can narrow to a governorate or a branch; everyone else sees
 * their own branch. Each part shows only to those who may open its page.
 *
 * @param {import('@/types/pages').DashboardProps} props
 */
export default function Dashboard({
    greeting,
    scope,
    branchScope,
    filters,
    periods,
    branchOptions,
    governorateOptions,
    sections,
    debts,
    latestPayments,
    fieldApp,
    auth,
    can,
    canCreateSubscription,
    canCreateBranch,
    canCreateUser,
    branchForm,
    userForm,
    statement,
    subscriptionForm,
    subscriptionEdit,
}) {
    const [creating, setCreating] = useState(null);
    const [findingPayer, setFindingPayer] = useState(false);
    const [editing, setEditing] = useState(false);
    const statementWindow = useStatementWindow(statement);
    // A save from one of the dashboard's windows comes back here (with any open statement), not to the record's list page.
    // The address without `?edit=` (the subscriber being edited in a window).
    const addressWithoutEdit = urlWithout(usePage().url, 'edit');
    const returnHere = { preserveState: true, headers: { 'X-Return-To': addressWithoutEdit } };
    const [search, setSearch] = useState(filters.search ?? '');
    const { collections, subscriptions, meterBoxes, readings, disconnections, boxes } = sections;
    const hasAnyData = Object.keys(sections).length > 0 || Boolean(latestPayments);
    const period = periodLabel(filters.days);
    const branchView = useBranchView();
    const canOpenReceipts = can?.viewSubscriptions || can?.recordPayments;

    /** Reloads the dashboard with changed filters (only some props when given), back on the first page of payments. */
    function visit(changes, only = null) {
        const query = Object.fromEntries(
            Object.entries({ ...filters, page: undefined, ...changes }).filter(([, value]) => value !== null && value !== undefined && value !== ''),
        );

        router.get('/dashboard', query, { preserveScroll: true, preserveState: true, replace: true, ...(only ? { only } : {}) });
    }

    /**
     * Opens the "new branch", "new user" or "new subscriber" pop-up — the
     * same one as on its own page — fetching its dropdown options the first
     * time.
     */
    function openCreateForm(kind) {
        const optionsProp = { branch: 'branchForm', user: 'userForm', subscription: 'subscriptionForm' }[kind];

        if ({ branchForm, userForm, subscriptionForm }[optionsProp]) {
            setCreating(kind);
            return;
        }

        router.reload({ only: [optionsProp], onSuccess: () => setCreating(kind) });
    }

    /** A subscriber's statement — their account, with the payment, charge and discount forms — over the dashboard; `form` opens one of them at once. */
    function openStatement(subscriber, form = null) {
        statementWindow.open(
            {
                id: subscriber.subscriptionId ?? subscriber.id,
                fullName: subscriber.fullName ?? subscriber.name ?? subscriber.subscriber,
                accountNumber: subscriber.accountNumber,
                status: subscriber.status,
                statusLabel: subscriber.statusLabel,
                branchName: subscriber.branchName,
            },
            form,
        );
    }

    /** Opens the subscriber's "edit" pop-up over their statement, fetching their details (and the form's dropdowns the first time). */
    function openEdit(subscriber) {
        router.reload({
            data: { edit: subscriber.id },
            only: subscriptionForm ? ['subscriptionEdit'] : ['subscriptionEdit', 'subscriptionForm'],
            onSuccess: () => setEditing(true),
        });
    }

    function closeEdit() {
        setEditing(false);
        router.replace({ url: addressWithoutEdit, props: (props) => ({ ...props, subscriptionEdit: null }), preserveScroll: true, preserveState: true });
    }

    const scopeLine = scope.company
        ? `${scope.label}، ${formatNumber(scope.branches)} ${scope.branches === 1 ? 'فرع' : 'فروع'} في ${formatNumber(scope.governorates)} ${scope.governorates === 1 ? 'محافظة' : 'محافظات'}`
        : scope.label;

    // "تسجيل دفعة" and "مشترك جديد" open over the dashboard; someone who can't open a statement records payments on the payments page.
    const quickActions = [
        can?.recordPayments && {
            href: '/payments',
            onClick: can?.viewSubscriptions ? () => setFindingPayer(true) : null,
            icon: 'banknotes',
            title: 'تسجيل دفعة',
            subtitle: 'استلام دفعة وطباعة الوصل',
            main: true,
        },
        canCreateSubscription && { href: '/subscriptions/create', onClick: () => openCreateForm('subscription'), icon: 'plus', title: 'مشترك جديد', subtitle: 'إضافة اشتراك' },
        can?.viewMeterReadings && { href: '/meter-readings', icon: 'chart', title: 'القراءات', subtitle: 'إدخال واعتماد' },
        can?.sendMessages && { href: '/messages/create', icon: 'send', title: 'رسالة جديدة', subtitle: 'لمشترك أو مجموعة' },
        can?.viewReports && { href: '/reports', icon: 'receipt', title: 'التقارير', subtitle: 'تقرير الفترة وتنزيله' },
        can?.viewMeterBoxes && { href: '/meter-boxes', icon: 'table', title: 'الطبلونات', subtitle: 'أماكنها ومشتركوها' },
        canCreateBranch ? { href: '/branches/create', onClick: () => openCreateForm('branch'), icon: 'building', title: 'فرع جديد', subtitle: 'إضافة فرع' }
            : canCreateUser && { href: '/users/create', onClick: () => openCreateForm('user'), icon: 'user', title: 'مستخدم جديد', subtitle: 'إضافة مستخدم' },
    ].filter(Boolean);

    const attention = [
        readings?.canApprove && {
            key: 'pending',
            icon: 'check',
            title: 'بانتظار الاعتماد',
            subtitle: 'في أسبوع القراءة الأخير',
            count: readings.pending,
            href: '/meter-readings',
        },
        readings && {
            key: 'missing',
            icon: 'gauge',
            title: 'عدادات لم تُقرأ',
            subtitle: 'في أسبوع القراءة الأخير',
            count: readings.missing,
            href: '/meter-readings',
            tone: 'red',
        },
        boxes && {
            key: 'boxes',
            icon: 'wallet',
            title: 'صناديق مفتوحة',
            subtitle: 'فيها حركات لم تُغلق',
            count: boxes.open,
            href: '/payments/cash-boxes?place=open',
        },
        disconnections && {
            key: 'overdue',
            icon: 'power',
            title: 'قطع متأخر',
            subtitle: 'في قوائم القطع ولم يُنفّذ',
            count: disconnections.overdue,
            href: '/disconnection-lists',
            tone: 'red',
        },
        disconnections && {
            key: 'upcoming',
            icon: 'calendar',
            title: 'قطع خلال 7 أيام',
            subtitle: `${formatNumber(disconnections.openLists)} قائمة مفتوحة`,
            count: disconnections.upcoming,
            href: '/disconnection-lists',
        },
    ].filter(Boolean);

    const rankList = collections?.byBranch ?? collections?.byCollector ?? null;
    const topBreaker = subscriptions?.byBreaker?.[0] ?? null;
    const hasBreakers = subscriptions?.byBreaker.length > 0;
    const breakerMax = Math.max(0, ...(subscriptions?.byBreaker ?? []).map((breaker) => breaker.count));
    const payments = latestPayments?.rows;

    const greet = `${greeting}،`;
    const periodOptions = periods.map((days) => ({ value: days, label: periodLabel(days) }));
    const readShare = readings ? percentOf(readings.approved, readings.total) : 0;
    const methodParts = collections ? [
        { label: 'نقدي', value: collections.cash, color: 'rgb(var(--gl-btn))' },
        { label: 'حوالات', value: collections.transfers, color: 'var(--gl-warn)' },
    ] : [];

    return (
        <AuthenticatedLayout scope={branchScope?.name ?? null}>
            <Head title="لوحة التحكم" />

            <div className="gl-page gl-park">
                <DashboardHeader
                    auth={auth}
                    branchOptions={branchOptions}
                    branchScope={branchScope}
                    branchView={branchView}
                    filters={filters}
                    governorateOptions={governorateOptions}
                    greet={greet}
                    periodOptions={periodOptions}
                    scope={scope}
                    scopeLine={scopeLine}
                    visit={visit}
                />

                <DashboardActions actions={quickActions} />

                {!hasAnyData ? (
                    <Panel index={1} className="py-14 text-center">
                        {fieldApp ? (
                            <>
                                <span className="gl-ico mx-auto w-[56px]! h-[56px]! text-[rgb(var(--gl-brand))]!"><Icon name="phone" className="h-7 w-7" /></span>
                                <h2 className="mt-4">حسابك للعمل الميداني</h2>
                                <p className="gl-sub mx-auto mt-2 max-w-md leading-7">
                                    تُسجَّل الدفعات والقراءات من تطبيق التحصيل على الهاتف، وتدخل إليه بنفس اسم المستخدم وكلمة المرور. لا تظهر لك بيانات في الموقع.
                                </p>
                                {fieldApp.url && <a href={fieldApp.url} className="gl-btn mt-6"><Icon name="arrow-down-tray" className="h-4 w-4" />تحميل تطبيق التحصيل</a>}
                            </>
                        ) : (
                            <p className="gl-sub">لا توجد بيانات لعرضها حاليًا — لم يتم منحك صلاحية عرض أي جدول بعد.</p>
                        )}
                    </Panel>
                ) : (
                    <>
                        {(collections || attention.length > 0) && (
                            <div className={`gl-dash-hero ${collections && attention.length > 0 ? '' : 'is-single'}`}>
                                {attention.length > 0 && <AttentionPanel attention={attention} />}
                                {collections && <CollectionsHero collections={collections} period={period} filters={filters} />}
                            </div>
                        )}

                        <DashboardTiles debts={debts} meterBoxes={meterBoxes} period={period} readings={readings} subscriptions={subscriptions} topBreaker={topBreaker} />

                        <div className="gl-grid gl-g3">
                            <DebtorsPanel debts={debts} can={can} openStatement={openStatement} />
                            {readings && (
                                <Panel index={10} title="قراءات الأسبوع" sub={readings.week ? `بدأ ${formatWeekDay(readings.week)}` : 'آخر أسبوع قراءة'} right={can?.viewMeterReadings && <Link href="/meter-readings" className="gl-btn gl-sec gl-sm">فتح</Link>}>
                                    <GoalRing percent={readShare} caption="معتمدة" />
                                    <div className="gl-kv"><span>معتمدة</span><b className="gl-num">{formatNumber(readings.approved)}</b></div>
                                    <div className="gl-kv"><span>بانتظار الاعتماد</span><b className="gl-num">{formatNumber(readings.pending)}</b></div>
                                    <div className="gl-kv"><span>لم تُقرأ</span><b className="gl-num" style={{ color: readings.missing > 0 ? 'var(--gl-bad)' : undefined }}>{formatNumber(readings.missing)}</b></div>
                                </Panel>
                            )}
                            {rankList && (
                                <Panel index={11} title={collections.byBranch ? 'التحصيل حسب الفرع' : 'المحصّلون'} sub={`آخر ${period}`}>
                                    <RankBars items={rankList} />
                                    {boxes && <div className="gl-kv"><span>صناديق مفتوحة</span><b className="gl-num">{formatNumber(boxes.open)}</b></div>}
                                    <div className="gl-kv"><span>دفعات اليوم</span><b className="gl-num">{formatNumber(collections.today.count)}</b></div>
                                    {rankList[0] && <div className="gl-kv"><span>الأعلى</span><b className="truncate">{rankList[0].name}</b></div>}
                                </Panel>
                            )}
                        </div>

                        {(collections || hasBreakers) && (
                            <div className={`gl-dash-pair ${collections && hasBreakers ? '' : 'is-single'}`}>
                                {collections && <MethodsPanel collections={collections} methodParts={methodParts} period={period} />}
                                {hasBreakers && (
                                    <Panel index={12} title="المشتركون حسب القاطع">
                                        {subscriptions.byBreaker.map((breaker, index) => (
                                            <div key={breaker.ampere} className="py-2">
                                                <div className="gl-kv"><b>{breaker.ampere} أمبير</b><span className="gl-num">{formatNumber(breaker.count)}، {breaker.share}%</span></div>
                                                <div className="gl-bar mt-2"><i style={{ width: `${breakerMax > 0 ? (breaker.count / breakerMax) * 100 : 0}%`, '--i': index }} /></div>
                                            </div>
                                        ))}
                                    </Panel>
                                )}
                            </div>
                        )}

                        {payments && (
                            <LatestPayments
                                payments={payments}
                                latestPayments={latestPayments}
                                period={period}
                                search={search}
                                onSearchChange={setSearch}
                                onVisit={visit}
                                filters={filters}
                                scope={scope}
                                can={can}
                                canOpenReceipts={canOpenReceipts}
                                onOpenStatement={openStatement}
                            />
                        )}
                    </>
                )}
            </div>

            <DashboardWindows
                branchForm={branchForm}
                closeEdit={closeEdit}
                creating={creating}
                editing={editing}
                findingPayer={findingPayer}
                openEdit={openEdit}
                openStatement={openStatement}
                returnHere={returnHere}
                setCreating={setCreating}
                setFindingPayer={setFindingPayer}
                statementWindow={statementWindow}
                subscriptionEdit={subscriptionEdit}
                subscriptionForm={subscriptionForm}
                userForm={userForm}
            />
        </AuthenticatedLayout>
    );
}
