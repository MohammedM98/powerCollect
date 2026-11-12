import { lazy, Suspense, useMemo, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import BranchBanner, { BranchChips } from '@/Components/BranchBanner';
import Icon from '@/Components/Icon';
import InfoTip from '@/Components/InfoTip';
import TableExportActions from '@/Components/DataTable/TableExportActions';
import PageHeader from '@/Components/PageHeader';
import { reportExcelParts } from '@/lib/reportExcelParts';
import { loadReportLines } from '@/lib/reportLines';
import { isPrintMode, printUrl } from '@/lib/print';
import { cents, periodLabel, reportMoney, shortDate } from '@/lib/reportFormatting';
import { weekDayName } from '@/lib/weekDays';
import ReportPrintSheet from './ReportPrintSheet';
import { BoxesReport, DebtReport, StatementReport } from './ReportDetails';
import { Comparison, PeriodCard, Figures } from './ReportParts';
import { FlowStatement, CollectionsBreakdown, Readings, DailyCollections, DaysTable, BranchComparison, Transactions } from './ReportSections';

const ExcelStudio = lazy(() => import('@/Components/ExcelStudio'));

/**
 * The financial reports page: one branch (or every branch, for whoever
 * reports on several) over a day or a stretch of days. The figures that
 * matter lead, then the reports themselves, picked from a list as in a
 * catalogue: the financial summary, day by day, the collections, the
 * branches side by side and every line. It prints as a clean sheet of the
 * period and its summaries, and exports to Excel through the editor.
 */
export default function Index({ branches, filters, scopeLabel, branchScope, presets, today, kinds, flow, collections, readings, days, transactions, period, comparison, branchSummary, canExport, canViewStatements, reportSection = 'overview', debts, boxData, reportStatement }) {
    const { errors, auth } = usePage().props;
    const [excelOpenedAt, setExcelOpenedAt] = useState(null);
    const excelOpen = excelOpenedAt !== null;
    const section = reportSection;
    const [printView, setPrintView] = useState('summary');
    const printing = isPrintMode();
    const oneDay = filters.from === filters.to;
    const query = new URLSearchParams(
        Object.entries({ branch: filters.branch ?? '', from: filters.from, to: filters.to, kind: filters.kind, section }).filter(([, value]) => value !== ''),
    ).toString();
    const scopeName = branchScope?.name ?? scopeLabel;
    const periodText = oneDay ? `${weekDayName(filters.from)} ${shortDate(filters.from, true)}` : `${shortDate(filters.from, true)} – ${shortDate(filters.to, true)}`;
    const kindLabel = kinds.find((kind) => kind.value === filters.kind)?.label ?? 'كل الحركات';
    const hasFigures = Boolean(flow && collections);
    const openDay = (day) => visit({ from: day, to: day, page: undefined });

    function visit(changes) {
        const subscription = changes.branch !== undefined && String(changes.branch) !== String(filters.branch) ? undefined : reportStatement?.subscription.id;
        router.get('/reports', { ...filters, section, subscription, ...changes }, { preserveScroll: true, preserveState: true });
    }

    const excelMeta = useMemo(() => ({
        lines: [`الفرع: ${scopeName}`, `الفترة: ${periodLabel(period?.mode, period)} · ${periodText}`],
        criteria: [
            ['الفرع', scopeName],
            ['الفترة', `${shortDate(filters.from, true)} – ${shortDate(filters.to, true)}`],
            ['نوع التقرير', periodLabel(period?.mode, period)],
            ['تصفية ورقة الحركات فقط', kindLabel],
            ['الملخص والتحصيل', 'جميع أنواع الحركات في الفترة المحددة'],
            ['أعدّه', auth?.user?.name ?? ''],
            ['تاريخ الإعداد', (excelOpenedAt ?? new Date()).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })],
        ],
    }), [scopeName, period, periodText, filters.from, filters.to, kindLabel, auth?.user?.name, excelOpenedAt]);

    /** The parts on the page now, and every line of the period fetched with the same filters. */
    async function loadExcelParts(options) {
        const lines = await loadReportLines(query, options);

        return reportExcelParts({ flow, collections, comparison, readings, days, branchSummary: branchSummary ?? [], lines, showBranch: filters.branch === 'all' });
    }

    const sections = [
        { key: 'overview', icon: 'ledger', title: 'نظرة عامة', heading: 'ملخص التحصيل والذمم', hint: 'التحميلات والتحصيل وحركة ذمم المشتركين' },
        { key: 'collections', icon: 'wallet', title: 'التحصيل', heading: 'تقرير التحصيل', hint: 'حسب الحساب والعملة والمحصّل' },
        { key: 'boxes', icon: 'layers', title: 'الصناديق والأموال', heading: 'الصناديق والأموال', hint: 'الصناديق المفتوحة خلال الفترة والدفعات المسجلة فيها حسب العملة' },
        { key: 'debts', icon: 'calendar', title: 'الديون', heading: 'ديون المشتركين', hint: 'الأرصدة وأعمار التحميلات كما في نهاية الفترة' },
        { key: 'statement', icon: 'users', title: 'كشوفات حسابات المشتركين', heading: 'كشوفات حسابات المشتركين', hint: 'رصيد افتتاحي وحركات ورصيد متتابع' },
        { key: 'movements', icon: 'list', title: 'سجل الحركات', heading: 'سجل الحركات', hint: 'كل الحركات المالية للفترة المختارة' },
    ];
    const current = sections.find((item) => item.key === section) ?? sections[0];

    return (
        <AuthenticatedLayout
            scope={branchScope ? branchScope.name : null}
            header={
                <PageHeader
                    title="التقارير المالية"
                    meta={`${branchScope ? '' : `${scopeLabel} · `}${periodLabel(period?.mode, period)} · ${periodText}${oneDay && filters.from === today ? ' · اليوم الجاري' : ''}`}
                />
            }
        >
            <Head title={branchScope ? `التقارير المالية — ${branchScope.name}` : 'التقارير المالية'} />
            {canExport && excelOpen && (
                <Suspense fallback={null}>
                    <ExcelStudio
                        show={excelOpen}
                        onClose={() => setExcelOpenedAt(null)}
                        title="تصدير التقرير إلى Excel"
                        storageKey="reports"
                        loadParts={loadExcelParts}
                        defaults={{ title: `التقارير المالية — ${scopeName}`, fileName: `التقارير_${scopeName}_${filters.from}_${filters.to}` }}
                        meta={excelMeta}
                    />
                </Suspense>
            )}

            <div className="reports-page space-y-5" dir="rtl">
                {branchScope && (
                    <BranchBanner
                        scope={branchScope}
                        options={branches}
                        value={filters.branch}
                        onChange={(branch) => visit({ branch, page: undefined })}
                        meta={`${periodLabel(period?.mode, period)} · ${periodText}`}
                        className=""
                    >
                        {branchSummary?.length > 0 && (
                            <BranchChips
                                items={branchSummary.map((row) => ({
                                    key: row.id,
                                    href: `/reports?${new URLSearchParams({ ...filters, branch: row.id }).toString()}`,
                                    name: row.name,
                                    figure: `${reportMoney(row.collections.total)} ₪`,
                                    amount: cents(row.collections.total),
                                }))}
                            />
                        )}
                    </BranchBanner>
                )}

                <nav aria-label="أقسام التقارير" className="gl-tabs">
                    {sections.map((item) => <button key={item.key} type="button" aria-current={section === item.key ? 'page' : undefined} onClick={() => { setPrintView(item.key === 'movements' ? 'lines' : 'summary'); visit({ section: item.key, page: undefined }); }} className="gl-tab"><Icon name={item.icon} className="h-4 w-4" />{item.title}</button>)}
                </nav>
                <PeriodCard branches={branches} branchScope={branchScope} scopeLabel={scopeLabel} filters={filters} presets={presets} today={today} period={period} periodText={periodText} visit={visit} />
                {hasFigures && ['overview', 'collections', 'movements'].includes(section) && (
                    <div className="data-table-toolbar flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-600">محتوى الطباعة
                            <select aria-label="محتوى الطباعة" className="text-sm" value={printView} onChange={(event) => setPrintView(event.target.value)}>
                                <option value="summary">الملخص المالي</option>
                                <option value="lines">الحركات التفصيلية</option>
                            </select>
                        </label>
                        <TableExportActions showExcel={canExport} onExcel={() => setExcelOpenedAt(new Date())} printHref={printUrl(`${printView === 'lines' ? 'الحركات التفصيلية' : 'الملخص المالي'} — ${scopeName} — ${periodText}`, `/reports?${query}&print_view=${printView}`)} />
                    </div>
                )}

                {errors.from && (
                    <p role="alert" className="flex items-center gap-2 rounded-card border border-red-200 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-700">
                        <Icon name="alert" className="h-5 w-5" />
                        {errors.from}
                    </p>
                )}

                {branches.length === 0 && (
                    <div className="rounded-card border border-dashed border-gray-200 bg-surface px-6 py-16 text-center">
                        <b className="text-gray-900">لا توجد فروع</b>
                        <p className="mt-1 text-sm text-gray-500">أضف فرعًا أولًا لعرض تقاريره.</p>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-gray-900">{current.heading}</h2><InfoTip label={`معلومة عن ${current.heading}`}>{current.hint}</InfoTip></div>
                {hasFigures && ['overview', 'collections'].includes(section) && collections.receipts && <section className="rounded-card border border-gray-200 bg-surface p-5" aria-label="نتيجة تدقيق المقبوضات">
                    <h3 className="text-lg font-bold text-gray-900">نتيجة تدقيق مقبوضات الفترة حتى الآن</h3>
                    <p className="mt-2 text-sm leading-7 text-gray-600">{collections.receipts.basis}</p>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{collections.receipts.rows.map((row) => <div key={row.key} className={`rounded-control border p-4 ${row.key === 'confirmed' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}><dt className="text-sm text-gray-600">{row.label}</dt><dd className="mt-2 font-display text-xl font-bold text-gray-900"><bdi dir="ltr">{reportMoney(row.amount)}</bdi> ₪</dd></div>)}</dl>
                </section>}
                {hasFigures && section === 'overview' && <>
                    <Figures flow={flow} collections={collections} />
                    {comparison && <Comparison comparison={comparison} />}
                    <div className="grid gap-5 xl:grid-cols-2"><FlowStatement flow={flow} /><div className="space-y-5"><CollectionsBreakdown collections={collections} compact />{readings && <Readings readings={readings} />}</div></div>
                    {days.length > 1 && <DailyCollections days={days} onOpenDay={openDay} />}
                    {branchSummary?.length > 0 && <BranchComparison rows={branchSummary} filters={filters} />}
                </>}
                {hasFigures && section === 'collections' && <>
                    <CollectionsBreakdown collections={collections} />
                    {days.length > 1 && <><DailyCollections days={days} onOpenDay={openDay} /><DaysTable days={days} onOpenDay={openDay} /></>}
                </>}
                {section === 'boxes' && <BoxesReport data={boxData} />}
                {section === 'debts' && <DebtReport key={filters.branch} data={debts} visit={visit} />}
                {section === 'statement' && <StatementReport key={filters.branch} data={reportStatement} visit={visit} />}
                {section === 'movements' && <Transactions transactions={transactions} kinds={kinds} filters={{ ...filters, section }} showDay={!oneDay} showBranch={filters.branch === 'all'} onKind={(kind) => visit({ kind, page: undefined })} onStatement={canViewStatements ? (subscription) => visit({ section: 'statement', subscription, page: undefined }) : null} />}

            </div>

            {hasFigures && !printing && section === 'overview' && (
                <ReportPrintSheet
                    scopeName={scopeName}
                    periodName={periodLabel(period?.mode, period)}
                    from={filters.from}
                    to={filters.to}
                    flow={flow}
                    collections={collections}
                    branchSummary={branchSummary ?? []}
                    preparedBy={auth?.user?.name ?? ''}
                />
            )}
        </AuthenticatedLayout>
    );
}
