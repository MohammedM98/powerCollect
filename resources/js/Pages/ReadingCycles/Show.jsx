import { useEffect, useMemo, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Icon from '@/Components/UI/Icon';
import { Button } from '@heroui/react';
import { formatNumber, formatDate } from '@/lib/format';
import { STAGES, stagedMoveGroups, assignmentMatches, boardColumns, boardCounters, boxMatches, columnTotals, distributionAreas, distributionBoxOptions, movePayload, toggleBoxSelection } from '@/lib/readingBoard';
import PageHeader from '@/Components/PageHeader';
import DistributionTable from './DistributionTable';
import DistributionAreas from './DistributionAreas';
import DistributionSummaryModal from './DistributionSummaryModal';
import DistributionActionModal from './DistributionActionModal';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import PrintButton from '@/Components/Print/PrintButton';
import DistributionBoard, { DistributionMission, DistributionTray } from './DistributionBoard';
import { AllocationReport, ReadingDayModal } from './CycleParts';
import { ChoiceSelect, Notice, SearchableSelect, SegmentedChoice, StatusPill } from '@/Components/UI';

/** Weekly allocations grouped by area, with standing and one-week changes. */
export default function Show({ cycle, boards, readers, paperSheets, reviewCount, abilities, showBranchSelector = false, today = null }) {
    const { flash, props } = usePage();
    const errors = props.errors ?? {};
    const [selected, setSelected] = useState(() => new Set());
    const [search, setSearch] = useState('');
    const [subAreaIds, setSubAreaIds] = useState([]);
    const [target, setTarget] = useState('');
    const [result, setResult] = useState(null);
    const [lastMove, setLastMove] = useState(null);
    const [editingDay, setEditingDay] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [recurring, setRecurring] = useState(true);
    const [assignmentFilter, setAssignmentFilter] = useState('');
    const [boxId, setBoxId] = useState('');
    const [perPage, setPerPage] = useState(25);
    const [page, setPage] = useState(1);
    const [view, setView] = useState('board');
    // Moves made on the board wait here (box id → column) until «حفظ التوزيع»; each drop also goes on the undo list.
    const [staged, setStaged] = useState({});
    const [stageHistory, setStageHistory] = useState([]);
    const [boardRecurring, setBoardRecurring] = useState(true);
    const [lastBoardMove, setLastBoardMove] = useState(null);
    const boxOptions = useMemo(() => distributionBoxOptions(boards, subAreaIds, assignmentFilter), [boards, subAreaIds, assignmentFilter]);
    const visibleBoxes = boards.filter((box) => boxMatches(box, search, subAreaIds, boxId) && assignmentMatches(box, assignmentFilter));
    const remainingBoxes = visibleBoxes.filter((box) => box.column === 'available');
    const selectedBoxes = boards.filter((box) => selected.has(box.id));
    const selectedTotals = columnTotals(selectedBoxes);
    const visibleIds = new Set(visibleBoxes.map((box) => box.id));
    const hiddenSelected = selectedBoxes.filter((box) => !visibleIds.has(box.id)).length;
    const allVisibleSelected = visibleBoxes.length > 0 && visibleBoxes.every((box) => selected.has(box.id));
    const areas = useMemo(() => distributionAreas(boards, assignmentFilter), [boards, assignmentFilter]);
    const columns = useMemo(() => boardColumns(readers), [readers]);
    const counters = boardCounters(boards);
    const totalPages = Math.max(1, Math.ceil(visibleBoxes.length / perPage));
    const currentPage = Math.min(page, totalPages);
    const pageBoxes = visibleBoxes.slice((currentPage - 1) * perPage, currentPage * perPage);
    const stagedGroups = stagedMoveGroups(boards, staged);
    const changedCount = stagedGroups.reduce((sum, group) => sum + group.boxIds.length, 0);

    useEffect(() => {
        if (flash?.allocationResult) {
            setResult(flash.allocationResult);
        }
    }, [flash]);

    // Once the server has a move, its box sits where it was staged: it drops out of what waits to be saved.
    useEffect(() => {
        setStaged((current) => {
            const next = Object.fromEntries(Object.entries(current).filter(([id, column]) => boards.find((box) => String(box.id) === id)?.column !== column));

            return Object.keys(next).length === Object.keys(current).length ? current : next;
        });
    }, [boards]);

    useEffect(() => {
        if (boxId && !boxOptions.some((option) => option.value === boxId)) {
            setBoxId('');
            setPage(1);
        }
    }, [boxId, boxOptions]);

    function toggle(id) {
        setSelected((current) => {
            const next = new Set(current);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function toggleColumn(boxes) {
        setSelected((current) => toggleBoxSelection(current, boxes));
    }

    function move(boxIds, column, confirmDownloaded = false, repeat = recurring, showSummary = true) {
        const ids = boxIds;

        if (busy || ids.length === 0 || ids.length > 1000) {
            return;
        }

        setBusy(true);
        setResult(null);
        const saveRecurring = abilities.approve && repeat;
        setLastMove({ boxIds: ids, column, recurring: saveRecurring });
        router.post(`/reading-cycles/${cycle.id}/assignments`, { ...movePayload(ids, column, boards, confirmDownloaded), recurring: saveRecurring, publish: abilities.approve }, {
            preserveScroll: true,
            onSuccess: () => {
                setSelected(column.key === 'paper' ? new Set(ids) : new Set());
                setActionsOpen(false);
                setSummaryOpen(showSummary);
            },
            onFinish: () => setBusy(false),
        });
    }

    function stage(next) {
        setStageHistory((history) => [...history, staged]);
        setStaged(next);
    }

    /**
     * Saves the board's waiting moves, one request per destination in turn;
     * a refusal stops there and leaves the rest waiting, with the reasons shown.
     */
    function saveStaged() {
        if (busy || stagedGroups.length === 0) {
            return;
        }

        const saveRecurring = abilities.approve && boardRecurring;
        setBusy(true);
        setResult(null);

        const send = (index) => {
            const group = stagedGroups[index];
            const column = columns.find((candidate) => candidate.key === group.column);
            setLastMove({ boxIds: group.boxIds, column, recurring: saveRecurring });
            router.post(`/reading-cycles/${cycle.id}/assignments`, { ...movePayload(group.boxIds, column, boards), recurring: saveRecurring, publish: abilities.approve }, {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    if (index + 1 < stagedGroups.length) {
                        send(index + 1);
                    } else {
                        setBusy(false);
                        setStageHistory([]);
                        setLastBoardMove(null);
                    }
                },
                onError: () => setBusy(false),
                onCancel: () => setBusy(false),
            });
        };

        send(0);
    }

    function approve(data) {
        if (busy) return;
        setBusy(true);
        router.post(`/reading-cycles/${cycle.id}/assignments/approve`, data, { preserveScroll: true, onFinish: () => setBusy(false) });
    }

    function assignSelected() {
        const column = columns.find((candidate) => candidate.key === target);

        if (column) {
            move(selectedBoxes.map((box) => box.id), column);
        }
    }

    function createSheet() {
        if (busy) return;
        const ids = [...selected].filter((id) => {
            const box = boards.find((candidate) => candidate.id === id);
            return box?.column === 'paper' && box.status === 'approved';
        });
        if (ids.length === 0 || ids.length > 200) return;
        setBusy(true);
        router.post(`/reading-cycles/${cycle.id}/paper-sheets`, { box_ids: ids }, { onFinish: () => setBusy(false) });
    }

    function openActions(boxes, defaultTarget = '') {
        setSelected(new Set(boxes.map((box) => box.id)));
        setTarget(defaultTarget);
        if (defaultTarget === 'paper') setRecurring(false);
        setSummaryOpen(false);
        setActionsOpen(true);
    }

    function showPaperSheets() {
        setSummaryOpen(false);
        requestAnimationFrame(() => document.getElementById('sheets-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }

    const selectedPaperApproved = [...selected].filter((id) => {
        const box = boards.find((candidate) => candidate.id === id);

        return box?.column === 'paper' && box.status === 'approved';
    }).length;
    const allocationReport = result && <AllocationReport result={result} onClose={() => setResult(null)} onConfirmDownloaded={abilities.manage && lastMove ? () => move(lastMove.boxIds, lastMove.column, true, lastMove.recurring) : null} />;

    return (
        <AuthenticatedLayout
            header={
                <>
                    <PageHeader
                        eyebrow={showBranchSelector ? <><Link href="/reading-cycles" className="hover:underline">الفروع</Link> / {cycle.branchName}</> : 'توزيع القراءة القادمة'}
                        title="توزيع القراءات"
                        titleAddon={<StatusPill tone={STAGES[cycle.stage].tone} label={STAGES[cycle.stage].label} />}
                    />
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button variant="secondary" isDisabled={busy} onPress={() => setSummaryOpen(true)}>ملخّص توزيع الفرع</Button>
                        <PrintButton title={`توزيع القراءات — ${cycle.branchName}`} base="/reading-cycles/print" params={{ cycle: cycle.id, search, area_ids: subAreaIds, box_id: boxId, assignment: assignmentFilter, print_page: currentPage, per_page: perPage }} selectedIds={[...selected]} selectionPage="/reading-cycles/print" />
                        {abilities.review && (
                            <Button variant="secondary" onPress={() => router.visit(`/reading-cycles/${cycle.id}/submissions`)}>
                                <Icon name="list" className="h-4 w-4" />
                                القراءات الميدانية
                                {reviewCount > 0 && <span className="rounded-full bg-(--ma-warn-s) px-2 text-xs font-bold text-(--ma-warn)">{formatNumber(reviewCount)}</span>}
                            </Button>
                        )}
                        {abilities.manage && (
                            <Button variant="secondary" onPress={() => setEditingDay(true)}>
                                <Icon name="calendar" className="h-4 w-4" />
                                يوم القراءة
                            </Button>
                        )}
                        {abilities.approve && counters.draft > 0 && (
                            <Button isDisabled={busy} onPress={() => setSummaryOpen(true)}>
                                <Icon name="check" className="h-4 w-4" />
                                مراجعة واعتماد ({formatNumber(counters.draft)})
                            </Button>
                        )}
                    </div>
                </>
            }
        >
            <Head title={`توزيع القراءات — ${formatDate(cycle.readingDate)}`} />

            {!actionsOpen && allocationReport}
            {(errors.box_ids || errors.approve || errors.copy) && !result && <Notice tone="danger" role="alert" className="mb-4">{errors.box_ids ?? errors.approve ?? errors.copy}</Notice>}

            <DistributionMission cycle={cycle} boards={boards} readers={readers} staged={staged} today={today} />

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm gl-text-muted">{view === 'board' ? (abilities.manage ? 'اسحب المنطقة كاملة إلى قارئ، أو افتحها واسحب طبلونات بعينها؛ لا يُحفظ شيء حتى «حفظ التوزيع».' : 'توزيع الطبلونات على القرّاء.') : 'الطبلونات حسب المنطقة.'}</p>
                <SegmentedChoice label="طريقة العرض" value={view} onChange={setView} options={[{ value: 'board', label: 'لوحة التوزيع' }, { value: 'table', label: 'جدول' }]} />
            </div>

            {view === 'board' ? (
                <>
                    <DistributionBoard boards={boards} readers={readers} staged={staged} onStage={stage} canMove={abilities.manage} busy={busy} onMoved={setLastBoardMove} />
                    <DistributionTray
                        lastMove={lastBoardMove}
                        changedCount={changedCount}
                        recurring={boardRecurring}
                        onRecurringChange={setBoardRecurring}
                        canChooseRecurring={abilities.approve}
                        onUndo={() => { setStaged(stageHistory.at(-1) ?? {}); setStageHistory((history) => history.slice(0, -1)); }}
                        onDiscard={() => { setStaged({}); setStageHistory([]); setLastBoardMove(null); }}
                        onSave={saveStaged}
                        busy={busy}
                        availableOn={cycle.availableOn ? formatDate(cycle.availableOn) : null}
                    />
                </>
            ) : (
            <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <DistributionAreas areas={areas} chosen={subAreaIds} onChange={(ids) => { setSubAreaIds(ids); setPage(1); }} disabled={busy}
                    onDistribute={abilities.manage || abilities.printSheets ? () => openActions(visibleBoxes) : null} distributionCount={visibleBoxes.length}
                    filter={assignmentFilter} counts={{ all: boards.length, assigned: counters.mobile + counters.paper, available: counters.available }} onFilterChange={(value) => { setAssignmentFilter(value); setPage(1); }} />
                <div className="flex min-w-0 flex-col gap-4">
                    {selectedBoxes.length > 0 && <section aria-label="الطبلونات المحددة" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-(--ma-brand) bg-(--ma-solid) p-4">
                        <div><p role="status" className="text-sm text-(--ma-ink)"><b className="font-display text-lg text-(--ma-brand)">{formatNumber(selectedTotals.boxes)}</b> طبلون محدد، {formatNumber(selectedTotals.subscribers)} مشترك</p>{hiddenSelected > 0 && <p className="mt-1 text-xs text-(--ma-warn)">منها {formatNumber(hiddenSelected)} خارج النتائج الظاهرة.</p>}</div>
                        <div className="flex flex-wrap items-center gap-3"><Button variant="ghost" isDisabled={busy} onPress={() => setSelected(new Set())}>إلغاء التحديد كله</Button><Button isDisabled={busy} onPress={() => setActionsOpen(true)}>{abilities.manage ? 'توزيع المحدد' : 'إجراء على المحدد'} ({formatNumber(selectedTotals.boxes)})</Button></div>
                    </section>}
                    <div>
                        <DataTableToolbar search={search} onSearchChange={(value) => { setSearch(value); setPage(1); }} placeholder="ابحث باسم المنطقة أو الطبلون أو رقمه..." perPage={perPage} onPerPageChange={(size) => { setPerPage(size); setPage(1); }} total={visibleBoxes.length} printable={false}
                            filterMenu={<div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-(--ma-line) pt-3">
                                <div className="grid w-full min-w-0 flex-1 gap-3 sm:grid-cols-2">
                                    <div className="min-w-0">
                                        <label htmlFor="assignment-filter" className="mb-2 block text-xs font-semibold text-(--ma-muted)">عرض التوزيع</label>
                                        <ChoiceSelect id="assignment-filter" value={assignmentFilter} disabled={busy} onChange={(event) => { setAssignmentFilter(event.target.value); setPage(1); }} className="block w-full text-sm">
                                            <option value="">كل حالات التوزيع</option>
                                            <option value="assigned">كل الطبلونات الموزعة</option>
                                            {columns.map((column) => <option key={column.key} value={column.key}>{column.key === 'available' ? 'غير موزع' : column.label}</option>)}
                                        </ChoiceSelect>
                                    </div>
                                    <div className="min-w-0">
                                        <label htmlFor="distribution-box-filter" className="mb-2 block text-xs font-semibold text-(--ma-muted)">الطبلون</label>
                                        <SearchableSelect id="distribution-box-filter" value={boxId} options={boxOptions} disabled={busy} placeholder="كل الطبلونات" searchPlaceholder="ابحث باسم الطبلون أو رقمه..." emptyLabel="لا توجد طبلونات ضمن التصفية الحالية" onChange={(value) => { setBoxId(value); setPage(1); }} />
                                    </div>
                                    {(search || subAreaIds.length > 0 || assignmentFilter || boxId) && <Button variant="ghost" size="sm" isDisabled={busy} onPress={() => { setSearch(''); setSubAreaIds([]); setAssignmentFilter(''); setBoxId(''); setPage(1); }} className="justify-self-start sm:col-span-2">مسح التصفية</Button>}
                                </div>
                                {(abilities.manage || abilities.printSheets) && <Button variant="secondary" isDisabled={busy || visibleBoxes.length === 0} onPress={() => toggleColumn(visibleBoxes)}>{allVisibleSelected ? 'إلغاء تحديد النتائج' : 'تحديد كل النتائج'} ({formatNumber(visibleBoxes.length)})</Button>}
                            </div>}
                        />
                        <>
                        <DistributionTable boxes={pageBoxes} allBoxes={visibleBoxes} readers={readers} selected={selected} canSelect={abilities.manage || abilities.printSheets} busy={busy} onToggle={toggle} onToggleGroup={toggleColumn} />
                        {totalPages > 1 && <nav aria-label="صفحات الطبلونات" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-(--ma-muted)">
                            <span>الصفحة {formatNumber(currentPage)} من {formatNumber(totalPages)}، التحديد يشمل جميع صفحات النتائج</span>
                            <div className="flex gap-2"><Button variant="secondary" isDisabled={busy || currentPage === 1} onPress={() => setPage(currentPage - 1)}>السابق</Button><Button variant="secondary" isDisabled={busy || currentPage === totalPages} onPress={() => setPage(currentPage + 1)}>التالي</Button></div>
                        </nav>}
                        </>
                    </div>

                    {remainingBoxes.length > 0 && abilities.manage && <Notice tone="warn">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span><bdi dir="ltr">{formatNumber(remainingBoxes.length)}</bdi> طبلون غير موزع ضمن النتائج الحالية.</span>
                            <Button variant="ghost" size="sm" isDisabled={busy} onPress={() => openActions(remainingBoxes, 'paper')}>تحديد المتبقي للكشوف الورقية</Button>
                        </div>
                    </Notice>}

                </div>
            </div>
            )}

            {(abilities.printSheets || paperSheets.length > 0) && (
                <section className="mt-6 rounded-card border border-(--ma-line) bg-(--ma-solid) p-4 shadow-card" aria-labelledby="sheets-title">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 id="sheets-title" className="font-bold text-(--ma-ink)">الكشوف الورقية</h3>
                            <p className="text-xs text-(--ma-muted)">للقرّاء الذين لا يملكون هواتف: حدّد الطبلونات المخصصة للورق والمعتمدة، ثم أنشئ كشفًا للطباعة. تُدخل القراءات لاحقًا من الموقع.</p>
                        </div>
                        {abilities.printSheets && (
                            <Button onPress={createSheet} isDisabled={busy || selectedPaperApproved === 0 || selectedPaperApproved > 200}>
                                <Icon name="printer" className="h-4 w-4" />
                                إنشاء كشف ({formatNumber(selectedPaperApproved)})
                            </Button>
                        )}
                    </div>
                    {paperSheets.length > 0 && (
                        <ul className="mt-4 divide-y divide-(--ma-line) rounded-control border border-(--ma-line) text-sm">
                            {paperSheets.map((sheet) => (
                                <li key={sheet.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                                    <span>
                                        <b className="font-display" dir="ltr">{sheet.number}</b>، {formatNumber(sheet.boxes)} طبلون
                                    </span>
                                    <span className="text-xs text-(--ma-muted)">
                                        {sheet.printCount > 0 ? `طُبع ${formatNumber(sheet.printCount)} مرة، آخرها ${sheet.lastPrintedAt} (${sheet.lastPrintedBy})` : 'لم يُطبع بعد'}
                                    </span>
                                    {abilities.printSheets && <Link href={`/paper-sheets/${sheet.id}?print=1`} className="text-sm font-semibold text-(--ma-brand) hover:underline">طباعة وتخصيص</Link>}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            {summaryOpen && <DistributionSummaryModal cycle={cycle} boards={boards} readers={readers} paperSheets={paperSheets} abilities={abilities} busy={busy} errors={errors} result={result} onClose={() => setSummaryOpen(false)} onApprove={() => approve({})} onPaper={showPaperSheets} onPreparePaper={() => openActions(boards.filter((box) => box.column === 'paper'), 'paper')} onRemaining={() => openActions(boards.filter((box) => box.column === 'available'), 'paper')} />}
            {actionsOpen && <DistributionActionModal boards={boards} selectedBoxes={selectedBoxes} readers={readers} abilities={abilities} busy={busy} errors={errors} target={target} onTargetChange={setTarget} recurring={recurring} onRecurringChange={setRecurring} hiddenSelected={hiddenSelected} onRemoveHidden={() => setSelected(new Set(selectedBoxes.filter((box) => visibleIds.has(box.id)).map((box) => box.id)))} onClose={() => setActionsOpen(false)} onAssign={assignSelected} onCreateSheet={createSheet} allocationReport={errors.box_ids ? allocationReport : null} />}
            {editingDay && <ReadingDayModal cycle={cycle} onClose={() => setEditingDay(false)} />}
        </AuthenticatedLayout>
    );
}
