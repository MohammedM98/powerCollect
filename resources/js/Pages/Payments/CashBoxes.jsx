import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card } from '@heroui/react';
import { PAGE_SIZES } from '@/Components/DataTable/DataTableToolbar';
import Pagination from '@/Components/DataTable/Pagination';
import Icon from '@/Components/Icon';
import { financialBoxesTotals } from '@/lib/financialBoxes';
import { FinancialBoxCard, FinancialBoxSummary, financialAmountsLine } from './FinancialBoxComponents';
import FinancialBoxList from './FinancialBoxList';
import { boxTypeStyles, BoxReportActions } from './CollectorCashBox';
import PageHeader from '@/Components/PageHeader';
import { SegmentedChoice } from '@/Components/UI';

const typeFilters = [{ value: '', label: 'الكل' }, ...Object.entries(boxTypeStyles).map(([value, style]) => ({ value, label: style.label }))];
const stateFilters = [{ value: '', label: 'الكل' }, { value: 'open', label: 'مفتوح' }, { value: 'closed', label: 'مغلق' }];

/**
 * Every box the collector had, in the site's table: its type, totals,
 * dates, where and by whom it was closed, its stage, its details and its
 * report to print or download. What is open now and what waits on the
 * collector are on the summary page.
 *
 * @param {import('@/types/pages').CashBoxesProps} props
 */
export default function CashBoxes({ started, branchName, boxes, filters, pendingCount, collectionUrls }) {
    const { auth } = usePage().props;
    const [view, setView] = useState('table');
    const presentedBoxes = boxes.data.map((box) => ({ ...box, user: auth.user, opened_at: box.openedAt, closed_at: box.closedAt, confirmed_at: box.confirmedAt }));
    function filter(key, value) {
        router.get(collectionUrls.cashBoxes, { ...filters, [key]: value }, { preserveState: true, preserveScroll: true, replace: true });
    }

    return <AuthenticatedLayout badges={{ '/payments/summary': pendingCount }} header={<PageHeader title="الصناديق المالية" info={branchName ?? 'حسابك الحالي'} />}>
        <Head title="الصناديق المالية" />
        {started ? <div className="financial-boxes gl-cb-page">
            <FinancialBoxSummary boxes={presentedBoxes} pageOnly />
            <Card className="gl-cb-list" role="region" aria-label="كل صناديقي">
                <div className="gl-st-bar" data-table-toolbar="">
                    <SegmentedChoice label="نوع الصندوق" value={filters.type ?? ''} onChange={(value) => filter('type', value)} options={typeFilters} />
                    <SegmentedChoice label="حالة الصندوق" value={filters.state ?? ''} onChange={(value) => filter('state', value)} options={stateFilters} />
                    <span className="flex-1" />
                    <div data-table-export-slot className="flex items-center empty:hidden" />
                    <SegmentedChoice label="طريقة العرض" value={view} onChange={setView} options={[{ value: 'table', label: <><Icon name="table" className="h-4 w-4" />جدول</> }, { value: 'cards', label: <><Icon name="grid" className="h-4 w-4" />بطاقات</> }]} />
                </div>
                {!presentedBoxes.length ? <div className="gl-cb-empty"><span aria-hidden="true"><Icon name="wallet" className="h-6 w-6" /></span><b>لا توجد صناديق بهذه الفلاتر.</b></div>
                    : view === 'cards' ? <div className="gl-cb-cards">{presentedBoxes.map((box) => <FinancialBoxCard key={box.id} box={box} onOpen={(item) => router.visit(item.urls.show)} />)}</div>
                        : <FinancialBoxList boxes={presentedBoxes} collector onOpen={(box) => router.visit(box.urls.show)} renderActions={(box) => <BoxReportActions box={box} onView={() => router.visit(box.urls.show)} />} />}
                <div className="gl-st-foot">
                    <p>المعروض <b>{boxes.data.length}</b> من <b>{boxes.total}</b> صندوقًا</p>
                    <p>مجموع الصناديق المعروضة: <b>{financialAmountsLine(financialBoxesTotals(presentedBoxes))}</b></p>
                    <SegmentedChoice label="عدد الصفوف في الصفحة" value={filters.per_page} onChange={(perPage) => filter('per_page', perPage)} options={PAGE_SIZES.map((size) => ({ value: size, label: size }))} />
                </div>
                <Pagination meta={boxes} filters={filters} baseUrl={collectionUrls.cashBoxes} />
            </Card>
        </div> : <p className="rounded-panel border border-dashed border-gray-200 bg-surface p-6 text-sm leading-7 text-gray-500">{branchName ? 'تُفتح الصناديق تلقائيًا عند تسجيل أول دفعة أو مقاصة في فرعك.' : 'حسابك غير مرتبط بفرع، لذلك لا يوجد سجل صناديق شخصي.'}</p>}
    </AuthenticatedLayout>;
}
