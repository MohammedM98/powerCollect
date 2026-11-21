import { useEffect, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { BranchFilterBanner } from '@/Components/BranchBanner';
import Icon from '@/Components/Icon';
import { FilterField } from '@/Components/DataTable/DataTableFilterMenu';
import { Button, Card, Chip, SearchField } from '@heroui/react';
import { formatMoney } from '@/lib/format';
import { boxEntryMatches, boxReconciliation, financialBoxMatches, financialBoxesTotals, sortFinancialBoxes } from '@/lib/financialBoxes';
import MoneyFlow from '@/Components/Finance/MoneyFlow';
import AuditApprovalDialog from './AuditApprovalDialog';
import AuditTransferSearch from './AuditTransferSearch';
import BankTransferAuditForm from './BankTransferAuditForm';
import BoxDetails from './BoxDetails';
import BoxTabs from './BoxTabs';
import FinancialBoxList from './FinancialBoxList';
import { boxTypes, boxTypeStyles } from './CollectorCashBox';
import { BOX_TONES, FinancialBoxCard, financialAmountsLine } from './FinancialBoxComponents';
import PageHeader from '@/Components/PageHeader';
import { queryValue, urlWithout } from '@/lib/pageUrl';
import { ChoiceSelect, SearchableSelect, SegmentedChoice } from '@/Components/UI';

const periodDate = (date) => new Intl.DateTimeFormat('ar-u-nu-latn', { dateStyle: 'medium', timeZone: 'Asia/Gaza' }).format(new Date(`${date}T12:00:00Z`));

function savedPreference(key, fallback, allowed) {
    try {
        const value = localStorage.getItem(`financial-boxes:${key}`);
        return allowed.includes(value) ? value : fallback;
    } catch {
        return fallback;
    }
}

/** What each place holds, said under the tabs. */
const placeHints = {
    open: 'صناديق المحصّلين التي ما زالت تستقبل حركات. راجع الصندوق وأكّد إغلاقه فينتقل إلى «المغلقة».',
    closed: 'كل الصناديق المغلقة متاحة للتدقيق تلقائيًا. اختر الفترة الأسبوعية لعرض الصناديق حسب تاريخ إغلاقها.',
};

const emptyPlace = {
    open: 'لا صناديق مفتوحة فيها حركات الآن.',
    closed: 'لا توجد صناديق مغلقة خلال هذه الفترة.',
};

/** One type of box above the boxes, as a tile in its colour: their total and how many there are; a click narrows the list to it. */
function SummaryTile({ type, label, boxes, hint, active, onClick }) {
    const rows = boxes.map(boxReconciliation);
    const expected = rows.reduce((sum, row) => sum + row.expected, 0);
    const checked = rows.filter((row) => row.confirmed !== null);
    const confirmed = checked.reduce((sum, row) => sum + row.confirmed, 0);
    const difference = Math.round(checked.reduce((sum, row) => sum + (row.difference ?? 0), 0) * 100) / 100;
    const pending = expected - checked.reduce((sum, row) => sum + row.expected, 0);

    return (
        <Button data-raw="" variant="ghost" onClick={onClick} aria-pressed={active} className="gl-cb-tile gl-rc-tile" data-tone={BOX_TONES[type]}>
            <span className="gl-rc-tile-head">
                <span className="gl-cb-tile-icon" aria-hidden="true"><Icon name={boxTypeStyles[type].icon} className="h-5 w-5" /></span>
                <small>{label}</small>
                <span className="gl-rc-tile-count">{boxes.length} {hint}</span>
            </span>
            <span className="gl-rc-terms">
                <span><small>المتوقع</small><b><bdi dir="ltr">{formatMoney(expected)}</bdi></b></span>
                <span><small>{type === 'cash' ? 'المعدود' : 'المطابَق'}</small><b><bdi dir="ltr">{formatMoney(confirmed)}</bdi></b></span>
                <span><small>{checked.length ? 'الفرق' : 'لم يُراجع'}</small><b data-tone={checked.length ? (Math.abs(difference) < 0.005 ? 'pay' : difference < 0 ? 'owe' : 'warn') : 'warn'}><bdi dir="ltr">{formatMoney(checked.length ? difference : pending)}</bdi></b></span>
            </span>
        </Button>
    );
}

/** Open boxes for closing, and closed boxes grouped by their closing week. */
export default function BranchCashBoxes({ branch, branches, branchScope = null, started, place, tabs, boxes, periods, week, pendingCount, periodAudit, urls, canSearchTransfers, searchingTransfers, transferSearch, canApprovePeriod }) {
    const { props: { errors }, url: pageUrl } = usePage();
    const [search, setSearch] = useState('');
    const [person, setPerson] = useState('');
    const [type, setType] = useState('');
    const [auditState, setAuditState] = useState('');
    const [confirmingPeriod, setConfirmingPeriod] = useState(false);
    const [busy, setBusy] = useState(false);
    const searchVisit = useRef(0);
    const [auditingEntry, setAuditingEntry] = useState(null);
    const [view, setView] = useState(() => savedPreference('view', 'table', ['table', 'cards']));
    const [sort, setSort] = useState({ key: 'dates', direction: 'desc' });
    const [boxId, setBoxId] = useState(() => Number(queryValue(pageUrl, 'box')) || null);
    const selectedBox = boxes.find((box) => box.id === boxId);
    const inPlace = boxes.filter((box) => box.place === place);
    const people = [...new Map(inPlace.filter((box) => box.user).map((box) => [box.user.id, box.user.name])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'ar'));
    const currentPeriod = periods.find((period) => period.start === week);
    const sortOptions = [
        ['dates:desc', `${place === 'closed' ? 'الإضافة للتدقيق' : 'فتح الصندوق'}، الأحدث أولًا`],
        ['dates:asc', `${place === 'closed' ? 'الإضافة للتدقيق' : 'فتح الصندوق'}، الأقدم أولًا`],
        ...(place === 'closed' ? [['audited:desc', 'اعتماد التدقيق، الأحدث أولًا'], ['audited:asc', 'اعتماد التدقيق، الأقدم أولًا']] : []),
        ['number:desc', 'رقم الصندوق، الأكبر أولًا'], ['number:asc', 'رقم الصندوق، الأصغر أولًا'],
        ['total:desc', 'الإجمالي، الأعلى أولًا'], ['total:asc', 'الإجمالي، الأقل أولًا'],
        ['status:asc', 'الحالة، تصاعديًا'], ['status:desc', 'الحالة، تنازليًا'],
    ];
    const reviewedBoxes = currentPeriod?.reviewed ?? 0;
    const periodBoxes = currentPeriod?.count ?? 0;
    const shown = inPlace.filter((box) => (!type || box.type === type) && (!person || String(box.user?.id) === person) && (!auditState || Boolean(box.audit) === (auditState === 'reviewed')) && financialBoxMatches(box, search));
    const navigation = { branch_id: branch?.id ?? '', place, week, ...(searchingTransfers ? { view: 'transfers' } : {}) };
    function searchTransfers(values) {
        const visit = ++searchVisit.current;
        router.get(urls.index, { ...navigation, ...values }, {
            preserveScroll: true, preserveState: true, replace: true,
            only: ['transferSearch', 'periods', 'canApprovePeriod', 'errors'],
            onStart: () => setBusy(true),
            onFinish: () => { if (visit === searchVisit.current) setBusy(false); },
        });
    }
    function reviewPeriod() {
        if (!searchingTransfers) { setConfirmingPeriod(true); return; }
        router.reload({ only: ['periodAudit', 'periods', 'transferSearch'], onStart: () => setBusy(true), onSuccess: (page) => { if (page.props.periodAudit) setConfirmingPeriod(true); }, onFinish: () => setBusy(false) });
    }
    useEffect(() => {
        try {
            localStorage.setItem('financial-boxes:view', view);
        } catch {
            return;
        }
    }, [view]);

    function closeBox() {
        setBoxId(null);
        router.replace({ url: urlWithout(pageUrl, 'box'), preserveScroll: true, preserveState: true });
    }

    function perform(kind, record, extra = {}, options = {}) {
        router.post(`${urls.actions}/${kind}${record ? `/${record.id}` : ''}`, { branch_id: record?.branch_id ?? selectedBox?.branch_id ?? branch?.id, ...extra }, { preserveScroll: true, ...options });
    }

    function sortBy(key) {
        setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
    }

    const summary = Object.keys(boxTypes).map((key) => ({ key, type: key, label: boxTypes[key], boxes: inPlace.filter((box) => box.type === key), hint: { open: 'صناديق مفتوحة', closed: 'صناديق مغلقة في الفترة' }[place], active: type === key, onClick: () => setType(type === key ? '' : key) }));

    return <AuthenticatedLayout badges={{ '/payments/summary': pendingCount }} scope={branchScope?.name ?? null} header={<PageHeader title="الصناديق المالية" info={branchScope || branches.length <= 1 ? (branch?.name ?? 'جميع الفروع') : null} meta={!branchScope && branches.length > 1 ? <ChoiceSelect aria-label="الفرع" className="rounded-control border-gray-200 py-1 text-sm" value={branch?.id ?? ''} onChange={(event) => router.get(urls.index, { ...navigation, branch_id: event.target.value })}><option value="">جميع الفروع</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</ChoiceSelect> : null} />}>
        <Head title="الصناديق المالية" />
        <BoxTabs tabs={tabs} current={place} hint={started && !searchingTransfers ? placeHints[place] : null} />
        {branchScope && <BranchFilterBanner scope={branchScope} eyebrow="تعرض الآن صناديق" group={{ options: branches.map((item) => ({ value: String(item.id), label: item.name })) }} value={branch ? String(branch.id) : ''} onChange={(value) => router.get(urls.index, { place, branch_id: value })} />}
        <MoneyFlow branchId={branch?.id ?? null} />
        {!branch && place === 'closed' && <p className="mb-4 text-sm text-gray-500">تعرض الصناديق من آخر فترة متاحة لكل فرع. اختر فرعًا لعرض فتراته الأسبوعية أو اعتماد فترة كاملة.</p>}
        {!started ? <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-dashed border-gray-200 bg-surface p-6 text-sm leading-7 text-gray-500">
            <p>تُفتح الصناديق تلقائيًا عند تسجيل أول دفعة أو مقاصة في الفرع، وتُضاف كل حركة إلى صندوق الموظف حسب نوعها.</p>
        </div> : <div className="financial-boxes gl-cb-page">
            {errors?.action && <p role="alert" className="rounded-control bg-red-500/10 p-4 text-sm text-red-700">{errors.action}</p>}
            {branch && place === 'closed' && <section aria-label="فترة الصناديق المغلقة" className="gl-cb-period">
                <span className="gl-cb-period-icon" aria-hidden="true"><Icon name="calendar" className="h-5 w-5" /></span>
                <div className="min-w-0"><h3>فترة الصناديق المغلقة</h3><p>دُقّق {reviewedBoxes} من {periodBoxes} صندوقًا في الفترة المختارة.</p></div>
                <Chip size="sm" className="gl-cb-chip" data-state={periodBoxes > 0 && reviewedBoxes === periodBoxes ? 'audited' : 'waiting'}><i aria-hidden="true" />{periodBoxes > 0 && reviewedBoxes === periodBoxes ? 'اكتمل تدقيق الفترة' : 'لم يكتمل تدقيق الفترة'}</Chip>
                <span className="flex-1" />
                <label htmlFor="closed-box-week" className="sr-only">الفترة الأسبوعية</label>
                <SearchableSelect id="closed-box-week" variant="pill" prefix={<span className="gl-filter-name"><Icon name="calendar" className="h-[15px] w-[15px]" />الفترة:</span>} value={week} clearable={false} searchable={periods.length > 8} options={periods.map((period) => ({ value: period.start, label: `${periodDate(period.start)} — ${periodDate(period.end)}`, hint: `${period.count} صندوق، ${period.reviewed === period.count ? 'تم التدقيق' : `دُقّق ${period.reviewed}`}` }))} onChange={(value) => router.get(urls.index, { ...navigation, week: value }, { preserveScroll: true })} className="gl-filter-item" />
                {(searchingTransfers ? canApprovePeriod && periodBoxes > reviewedBoxes : periodAudit?.boxes > 0) && <Button isDisabled={busy} onPress={reviewPeriod} className="gl-cb-approve"><Icon name="check" className="h-4 w-4" />{busy ? 'جارٍ تحديث الملخص…' : 'اعتماد الفترة كاملة'}</Button>}
            </section>}
            {canSearchTransfers && place === 'closed' && <SegmentedChoice label="مساحة التدقيق" value={searchingTransfers ? 'transfers' : 'boxes'} onChange={(value) => router.get(urls.index, { branch_id: branch.id, place: 'closed', week, ...(value === 'transfers' ? { view: 'transfers' } : {}) })} options={[{ value: 'boxes', label: <><Icon name="wallet" className="inline h-4 w-4" /> الصناديق</> }, { value: 'transfers', label: <><Icon name="search" className="inline h-4 w-4" /> البحث عن حوالة</> }]} />}
            {searchingTransfers ? <>
                <AuditTransferSearch key={`${branch.id}:${week}`} data={transferSearch} branchName={branch.name} busy={busy} errors={errors} onSearch={searchTransfers} onPage={(url) => router.visit(url, { preserveState: true, preserveScroll: true, onStart: () => setBusy(true), onFinish: () => setBusy(false) })} onEdit={setAuditingEntry} />
                <section aria-label="ملخص الحوالات غير المعتمدة في الفترة" className="rounded-card border border-gray-100 bg-surface p-4"><h3 className="mb-4 font-bold text-gray-900">ملخص الفترة قبل الاعتماد <span className="font-normal text-gray-500">· يشمل كل الصناديق، خارج نتائج البحث أيضًا</span></h3><dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">{[['الحوالات غير المعتمدة', transferSearch.summary.transfers], ['حوالات فيها فروق', transferSearch.summary.exceptions], ['تحميل على المشتركين (شيكل)', formatMoney(transferSearch.summary.debit)], ['إضافة لصالح المشتركين (شيكل)', formatMoney(transferSearch.summary.credit)]].map(([label, value]) => <div key={label}><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-1 font-display text-2xl font-bold text-gray-900">{value}</dd></div>)}</dl><p className="mt-4 border-t border-gray-100 pt-3 text-sm leading-7 text-gray-600">عند الاعتماد، تُحفظ الاستثناءات وتُرحّل فروقها، وتُعتمد {transferSearch.summary.automaticMatches} حوالة لم تُراجع كمطابقة تلقائيًا.</p></section>
            </> : <><section aria-label="ملخص" className="gl-cb-tiles">{summary.map(({ key, ...tile }) => <SummaryTile key={key} {...tile} />)}</section>
            <Card className="gl-cb-list" role="region" aria-label="الصناديق">
                <div className="gl-st-bar" data-table-toolbar="">
                    <SearchField aria-label="ابحث بالصندوق أو المشترك أو السند أو مرجع الحوالة" value={search} onChange={setSearch} className="gl-st-search">
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="ابحث بالصندوق أو المشترك أو السند أو مرجع الحوالة" />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                    <FilterField group={{ label: 'الموظف', options: people.map(([id, name]) => ({ value: String(id), label: name })) }} value={person} onChange={(value) => setPerson(value ?? '')} icon="user" />
                    <FilterField group={{ label: 'الترتيب', options: sortOptions.map(([value, label]) => ({ value, label })) }} value={`${sort.key}:${sort.direction}`} onChange={(value) => { const [key, direction] = String(value).split(':'); setSort({ key, direction }); }} clearable={false} icon="sort" isDefault={sort.key === 'dates' && sort.direction === 'desc'} />
                    {place === 'closed' && <FilterField group={{ label: 'حالة التدقيق', options: [{ value: 'waiting', label: 'بانتظار التدقيق' }, { value: 'reviewed', label: 'تم التدقيق' }] }} value={auditState} onChange={(value) => setAuditState(value ?? '')} icon="check" />}
                    {type && <Button data-raw="" variant="ghost" onClick={() => setType('')} className="gl-filter-clear"><Icon name="close" className="h-3.5 w-3.5" />{boxTypes[type]}</Button>}
                    <span className="flex-1" />
                    <div data-table-export-slot className="flex items-center empty:hidden" />
                    <SegmentedChoice label="طريقة العرض" value={view} onChange={setView} options={[{ value: 'table', label: <><Icon name="table" className="h-4 w-4" />جدول</> }, { value: 'cards', label: <><Icon name="grid" className="h-4 w-4" />بطاقات</> }]} />
                </div>
                {!shown.length ? <div className="gl-cb-empty"><span aria-hidden="true"><Icon name="wallet" className="h-6 w-6" /></span><b>{inPlace.length ? 'لا توجد صناديق بهذه الفلاتر.' : emptyPlace[place]}</b>{!inPlace.length && <p>تُفتح الصناديق تلقائيًا عند تسجيل أول دفعة أو مقاصة في الفرع، وتُضاف كل حركة إلى صندوق الموظف حسب نوعها.</p>}</div>
                    : view === 'cards' ? <div className="gl-cb-cards">{sortFinancialBoxes(shown, sort).map((box) => <FinancialBoxCard key={box.id} box={box} onOpen={(item) => setBoxId(item.id)} />)}</div>
                        : <FinancialBoxList boxes={sortFinancialBoxes(shown, sort)} onOpen={(box) => setBoxId(box.id)} sortState={{ sort: sort.key, direction: sort.direction }} onSort={sortBy} />}
                <div className="gl-st-foot"><p>المعروض <b>{shown.length}</b> من <b>{inPlace.length}</b> صندوقًا</p><p>مجموع الصناديق المعروضة: <b>{financialAmountsLine(financialBoxesTotals(shown))}</b></p></div>
            </Card></>}
        </div>}
        {selectedBox && <BoxDetails key={selectedBox.id} box={selectedBox} initialSearch={(selectedBox.payments ?? []).some((entry) => boxEntryMatches(entry, search)) ? search : ''} onClose={closeBox} perform={perform} />}
        {auditingEntry && <BankTransferAuditForm key={auditingEntry.id} entry={auditingEntry} onClose={() => setAuditingEntry(null)} />}
        {confirmingPeriod && periodAudit && <AuditApprovalDialog title="اعتماد تدقيق الفترة كاملة؟" scope={`${branch.name}، ${periodDate(week)} — ${periodDate(currentPeriod.end)}`} summary={periodAudit} url={urls.auditPeriod} payload={{ branch_id: branch.id, week, box_ids: periodAudit.box_ids, snapshot: periodAudit.snapshot }} onClose={() => setConfirmingPeriod(false)} />}
    </AuthenticatedLayout>;
}
