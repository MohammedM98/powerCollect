import { lazy, Suspense, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useBranchView } from '@/hooks/useBranchView';
import Icon from '@/Components/Icon';
import ChartStudio from '@/Components/ChartStudio';
import KpiTile from '@/Components/KpiTile';
import LiveBars from '@/Components/LiveBars';
import Panel from '@/Components/Panel';
import SearchableSelect from '@/Components/SearchableSelect';
import SplitBar from '@/Components/SplitBar';
import StatStrip, { ChangePill, Spark, Stat } from '@/Components/StatStrip';
import { GoalRing } from '@/Components/StatRing';
import WordReveal from '@/Components/WordReveal';
import { useStatementWindow } from '@/hooks/useStatementWindow';
import { formatMoney, formatNumber, formatShortDay, percentOf } from '@/lib/format';
import { shouldPrefetchPage } from '@/lib/navigation';
import { formatWeekDay } from '@/lib/weekDays';
import { TileLink } from './Dashboard/DashboardParts';
import { LatestPayments } from './Dashboard/DashboardPanels';

const BranchModal = lazy(() => import('@/Pages/Branches/BranchModal'));
const UserModal = lazy(() => import('@/Pages/Users/UserModal'));
const SubscriptionModal = lazy(() => import('@/Pages/Subscriptions/SubscriptionModal'));
const StatementModal = lazy(() => import('@/Pages/Subscriptions/StatementModal'));
const QuickPaymentSearch = lazy(() => import('./Dashboard/QuickPaymentSearch'));

/** The current address without `?edit=` (the subscriber being edited in a window). */
function urlWithoutEdit() {
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');

    return `${url.pathname}${url.search}`;
}

/** The period's name on the tabs and in sentences. */
const periodLabel = (days) => (days === 7 ? '7 أيام' : `${days} يومًا`);

/**
 * The home page: the figures of the branches the user looks after over
 * the chosen period — the collections, subscribers, meter boxes, weekly
 * readings and debts — what waits on someone, the quick actions and the
 * latest payments. The head of the company sees every branch and can
 * narrow to a governorate or a branch; everyone else sees their own
 * branch. Each part shows only to those who may open its page.
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
    const returnHere = { preserveState: true, headers: { 'X-Return-To': urlWithoutEdit() } };
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
        router.replace({ url: urlWithoutEdit(), props: (props) => ({ ...props, subscriptionEdit: null }), preserveScroll: true, preserveState: true });
    }

    const scopeLine = scope.company
        ? `${scope.label} · ${formatNumber(scope.branches)} ${scope.branches === 1 ? 'فرع' : 'فروع'} في ${formatNumber(scope.governorates)} ${scope.governorates === 1 ? 'محافظة' : 'محافظات'}`
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
    const tiles = [subscriptions, meterBoxes, subscriptions, debts !== null].filter(Boolean).length;

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

            <div className="gl-page">
                <div className="gl-phead gl-rise">
                    <div className="min-w-0">
                        <h1>
                            <WordReveal text={greet}>
                                <span style={{ color: 'rgb(var(--gl-brand))' }}>{auth.user.name}</span>
                            </WordReveal>
                        </h1>
                        <p>{[scopeLine, formatWeekDay(scope.today)].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="gl-phead-actions">
                        {branchScope && governorateOptions.length > 0 && (
                            <div className="w-full sm:w-52">
                                <SearchableSelect
                                    value={filters.governorate ?? ''}
                                    onChange={(value) => visit({ governorate: value || null, branch: null })}
                                    options={governorateOptions}
                                    placeholder="كل المحافظات"
                                    searchable={governorateOptions.length > 6}
                                    active={Boolean(filters.governorate)}
                                    portal
                                />
                            </div>
                        )}
                        {branchScope && (
                            <div className="w-full sm:w-52">
                                <SearchableSelect
                                    value={branchView.available ? String(branchView.value) : filters.branch ?? ''}
                                    onChange={branchView.available ? branchView.changeBranch : (value) => visit({ branch: value || null })}
                                    options={branchView.available ? branchView.options : branchOptions.filter((branch) => !filters.governorate || String(branch.governorate) === String(filters.governorate))}
                                    disabled={branchView.switching}
                                    placeholder="كل الفروع"
                                    searchPlaceholder="ابحث عن فرع..."
                                    active={Boolean(filters.branch)}
                                    portal
                                />
                            </div>
                        )}
                        {!scope.company && scope.label && <span className="gl-pill gl-info self-center"><Icon name="lock" className="h-3.5 w-3.5" />فرعك: {scope.label}</span>}
                        {canCreateBranch ? (
                            <button type="button" className="gl-btn gl-sec" onClick={() => openCreateForm('branch')}><Icon name="plus" className="h-4 w-4" />فرع جديد</button>
                        ) : canCreateUser ? (
                            <button type="button" className="gl-btn gl-sec" onClick={() => openCreateForm('user')}><Icon name="plus" className="h-4 w-4" />مستخدم جديد</button>
                        ) : null}
                        {can?.recordPayments && (can?.viewSubscriptions
                            ? <button type="button" className="gl-btn" onClick={() => setFindingPayer(true)} aria-haspopup="dialog"><Icon name="plus" className="h-4 w-4" />تسجيل دفعة</button>
                            : <Link href="/payments" className="gl-btn"><Icon name="plus" className="h-4 w-4" />تسجيل دفعة</Link>)}
                    </div>
                </div>

                {!hasAnyData ? (
                    <Panel index={1} className="py-14 text-center">
                        {fieldApp ? (
                            <>
                                <span className="gl-ico mx-auto" style={{ width: 56, height: 56, color: 'rgb(var(--gl-brand))' }}><Icon name="phone" className="h-7 w-7" /></span>
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
                        <div className="gl-dash">
                            <div className="gl-col">
                                {collections && (
                                    <section className="gl-glass gl-panel gl-rise" style={{ '--i': 1 }} aria-label="التحصيل">
                                        <StatStrip>
                                            <Stat label="المحصّل اليوم" value={collections.today.total} unit="₪" format={formatMoney} hint={`${formatNumber(collections.today.count)} دفعة حتى الآن`} />
                                            <Stat label={`آخر ${period}`} value={collections.total} unit="₪" format={formatMoney} badge={<ChangePill change={collections.change} />} hint={`الفترة السابقة ${formatMoney(collections.previousTotal)} ₪`} />
                                            <Stat label="دفعات الفترة" value={collections.count} hint={`نقدي ${formatMoney(collections.cash)} · حوالات ${formatMoney(collections.transfers)} ₪`}>
                                                <Spark values={collections.series.map((day) => Number(day.value) || 0)} />
                                            </Stat>
                                        </StatStrip>
                                        <ChartStudio
                                            title="استوديو التحصيل"
                                            total={collections.total}
                                            change={collections.change}
                                            formatTotal={formatMoney}
                                            series={collections.series}
                                            dayLabel={formatShortDay}
                                            periods={periodOptions}
                                            period={filters.days}
                                            onPeriodChange={(days) => visit({ days })}
                                        />
                                    </section>
                                )}
                                {!collections && (
                                    <div className="gl-seg self-start" role="group" aria-label="الفترة">
                                        {periodOptions.map((option) => <button key={option.value} type="button" aria-pressed={filters.days === option.value} onClick={() => visit({ days: option.value })}>{option.label}</button>)}
                                    </div>
                                )}

                                {(attention.length > 0 || debts !== null || collections) && (
                                    <div className="gl-grid gl-g3">
                                        {attention.length > 0 && (
                                            <Panel index={2} title="بانتظارك" sub="ما يحتاج متابعة اليوم">
                                                {attention.map(({ key, icon, title, subtitle, count, href, tone }) => (
                                                    <Link key={key} href={href} prefetch={false} className="gl-attn">
                                                        <span className="gl-dot" style={{ '--gl-c': tone === 'red' ? 'var(--gl-bad)' : 'var(--gl-warn)' }} />
                                                        <span className="min-w-0 flex-1"><b className="block truncate font-semibold">{title}</b><small className="gl-sub">{subtitle}</small></span>
                                                        <b className="gl-num">{formatNumber(count)}</b>
                                                        <span style={{ color: 'var(--gl-faint)' }}><Icon name={icon} className="h-4 w-4" /></span>
                                                    </Link>
                                                ))}
                                            </Panel>
                                        )}
                                        {debts === undefined ? (
                                            <Panel index={3} title="أكبر المدينين"><div className="space-y-3 py-2"><div className="gl-skel" /><div className="gl-skel w-2/3" /><div className="gl-skel w-1/2" /></div></Panel>
                                        ) : debts && (
                                            <Panel index={3} title="أكبر المدينين" sub={`${formatNumber(debts.count)} مدين · ₪ ${formatMoney(debts.total)}`} right={<Link href="/receivables" className="gl-btn gl-sec gl-sm">الكل</Link>}>
                                                {debts.top.length === 0 ? <p className="gl-empty-line">لا ديون مستحقة.</p> : debts.top.map((debtor) => (
                                                    <div key={debtor.subscriptionId} className="gl-row">
                                                        <div className="gl-av" style={{ color: 'var(--gl-bad)' }}>{(debtor.name ?? '').slice(0, 1)}</div>
                                                        <div className="gl-t"><b>{debtor.name}</b><small className="gl-num">₪ {formatMoney(debtor.balance)} · منذ {formatNumber(debtor.oldestDays)} يومًا</small></div>
                                                        {can?.viewSubscriptions && <button type="button" className="gl-btn gl-sec gl-sm" onClick={() => openStatement(debtor)} aria-haspopup="dialog" aria-label={`كشف حساب ${debtor.name}`}>كشف</button>}
                                                    </div>
                                                ))}
                                            </Panel>
                                        )}
                                        {collections && (
                                            <Panel index={4} title="طرق الدفع" sub={`آخر ${period} · ₪ ${formatMoney(collections.total)}`}>
                                                <SplitBar parts={methodParts} label="النقد والحوالات" formatValue={(value) => `₪ ${formatMoney(value)}`} />
                                            </Panel>
                                        )}
                                    </div>
                                )}

                                {tiles > 0 && (
                                    <div className="gl-grid gl-g4">
                                        {subscriptions && (
                                            <TileLink href="/subscriptions">
                                                <KpiTile hero index={5} icon="users" label="المشتركون النشطون" value={subscriptions.active} hint={`من ${formatNumber(subscriptions.total)} · ${formatNumber(subscriptions.newInPeriod)} جديد في آخر ${period}`}>
                                                    <div className="gl-split" role="img" aria-label="حالات المشتركين">
                                                        {[[subscriptions.active, 'var(--gl-ok)'], [subscriptions.suspended, 'var(--gl-warn)'], [subscriptions.disconnected, 'var(--gl-faint)']].map(([count, color], index) => subscriptions.total > 0 && count > 0 && (
                                                            <i key={color} style={{ '--i': index, width: `${(count / subscriptions.total) * 100}%`, background: color }} />
                                                        ))}
                                                    </div>
                                                </KpiTile>
                                            </TileLink>
                                        )}
                                        {meterBoxes && (
                                            <TileLink href="/meter-boxes">
                                                <KpiTile index={6} icon="table" label="الطبلونات" value={meterBoxes.total} hint={readings ? `قُرئ ${percentOf(readings.approved + readings.pending, readings.total)}% من العدادات هذا الأسبوع` : `${formatNumber(meterBoxes.empty)} بلا مشتركين نشطين`} />
                                            </TileLink>
                                        )}
                                        {subscriptions && (
                                            <KpiTile index={7} icon="bolt" label="الأمبير المتعاقد عليه" value={subscriptions.contractedAmperes} unit="أمبير" hint={topBreaker ? `الأكثر: قاطع ${topBreaker.ampere} أمبير (${topBreaker.share}%)` : 'لا قواطع للمشتركين النشطين'} />
                                        )}
                                        {debts === undefined ? <div className="gl-glass gl-kpi"><div className="gl-skel w-1/2" /><div className="gl-skel mt-6 h-8 w-2/3" /></div> : debts && (
                                            <TileLink href="/receivables">
                                                <KpiTile index={8} icon="clock" label="الديون المستحقة" value={formatMoney(debts.total)} unit="₪" hint={`${formatNumber(debts.count)} مدين · أكثر من 90 يومًا ${debts.olderShare}%`} />
                                            </TileLink>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="gl-col">
                                {readings && (
                                    <Panel index={2} title="قراءات الأسبوع" sub={readings.week ? `بدأ ${formatWeekDay(readings.week)}` : 'آخر أسبوع قراءة'} right={can?.viewMeterReadings && <Link href="/meter-readings" className="gl-pill gl-info">فتح</Link>}>
                                        <GoalRing percent={readShare} caption="معتمدة" />
                                        <div className="gl-kv"><span>معتمدة</span><b className="gl-num">{formatNumber(readings.approved)}</b></div>
                                        <div className="gl-kv"><span>بانتظار الاعتماد</span><b className="gl-num">{formatNumber(readings.pending)}</b></div>
                                        <div className="gl-kv"><span>لم تُقرأ</span><b className="gl-num" style={{ color: readings.missing > 0 ? 'var(--gl-bad)' : undefined }}>{formatNumber(readings.missing)}</b></div>
                                    </Panel>
                                )}
                                {rankList && (
                                    <Panel index={3} title={collections.byBranch ? 'التحصيل حسب الفرع' : 'المحصّلون'} sub={`آخر ${period}`}>
                                        <LiveBars value={formatNumber(rankList.length)} bars={rankList.map((item) => Number(item.total) || 0)} label={collections.byBranch ? 'تحصيل كل فرع' : 'تحصيل كل موظف'}>
                                            {boxes && <div className="gl-kv"><span>صناديق مفتوحة</span><b className="gl-num">{formatNumber(boxes.open)}</b></div>}
                                            <div className="gl-kv"><span>دفعات اليوم</span><b className="gl-num">{formatNumber(collections.today.count)}</b></div>
                                            {rankList[0] && <div className="gl-kv"><span>الأعلى</span><b className="truncate">{rankList[0].name}</b></div>}
                                        </LiveBars>
                                    </Panel>
                                )}
                                {quickActions.length > 0 && (
                                    <Panel index={4} title="إجراءات سريعة">
                                        <div className="gl-qa">
                                            {quickActions.map((action) => action.onClick ? (
                                                <button key={action.href} type="button" className="gl-qbtn" onClick={action.onClick} aria-haspopup="dialog"><Icon name={action.icon} className="h-[18px] w-[18px]" />{action.title}</button>
                                            ) : (
                                                <Link key={action.href} href={action.href} prefetch={shouldPrefetchPage(action.href)} className="gl-qbtn"><Icon name={action.icon} className="h-[18px] w-[18px]" />{action.title}</Link>
                                            ))}
                                        </div>
                                    </Panel>
                                )}
                                {hasBreakers && (
                                    <Panel index={5} title="المشتركون حسب القاطع">
                                        {subscriptions.byBreaker.map((breaker, index) => (
                                            <div key={breaker.ampere} className="py-2">
                                                <div className="gl-kv"><b>{breaker.ampere} أمبير</b><span className="gl-num">{formatNumber(breaker.count)} · {breaker.share}%</span></div>
                                                <div className="gl-bar mt-2"><i style={{ width: `${breakerMax > 0 ? (breaker.count / breakerMax) * 100 : 0}%`, '--i': index }} /></div>
                                            </div>
                                        ))}
                                    </Panel>
                                )}
                            </div>
                        </div>

                        {payments && (
                            <LatestPayments payments={payments} latestPayments={latestPayments} period={period} search={search} onSearchChange={setSearch} onVisit={visit} filters={filters} scope={scope} can={can} canOpenReceipts={canOpenReceipts} onOpenStatement={openStatement} />
                        )}
                    </>
                )}
            </div>

            <Suspense fallback={<p role="status" className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-control border border-gray-200 bg-surface px-4 py-3 text-sm text-gray-600 shadow-card">جارٍ تحميل النافذة…</p>}>
                {branchForm && creating === 'branch' && (
                    <BranchModal
                        show
                        onClose={() => setCreating(null)}
                        branch={null}
                        governorates={branchForm.governorates}
                        areas={branchForm.areas}
                        visitOptions={returnHere}
                    />
                )}
                {subscriptionForm && creating === 'subscription' && (
                    <SubscriptionModal show onClose={() => setCreating(null)} subscription={null} visitOptions={returnHere} {...subscriptionForm} />
                )}
                {subscriptionForm && subscriptionEdit && editing && (
                    <SubscriptionModal key={`edit-${subscriptionEdit.id}`} show onClose={closeEdit} subscription={subscriptionEdit} visitOptions={returnHere} {...subscriptionForm} />
                )}
                {findingPayer && (
                    <QuickPaymentSearch
                        show
                        onClose={() => setFindingPayer(false)}
                        onPick={(subscriber) => {
                            setFindingPayer(false);
                            openStatement(subscriber, 'payment');
                        }}
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
                        onEdit={openEdit}
                    />
                )}
                {userForm && creating === 'user' && (
                    <UserModal
                        show
                        onClose={() => setCreating(null)}
                        user={null}
                        branches={userForm.branches}
                        canChooseBranch={userForm.canChooseBranch}
                        userTypeOptions={userForm.userTypeOptions}
                        canCreateUserType={userForm.canCreateUserType}
                        visitOptions={returnHere}
                    />
                )}
            </Suspense>
        </AuthenticatedLayout>
    );
}
