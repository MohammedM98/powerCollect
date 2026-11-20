import { useMemo, useState } from 'react';
import { Button, Card, Dropdown } from '@heroui/react';
import Icon from '@/Components/Icon';
import { formatNumber } from '@/lib/format';
import { laneAreaGroups, stageMove } from '@/lib/readingBoard';
import { SegmentedChoice } from '@/Components/UI';

/** Each lane's colour: readers take the tones in turn, paper is amber, the pool grey. */
const READER_TONES = ['clr', 'disc', 'brand', 'split', 'pay'];

export function laneTone(columnKey, readers) {
    if (columnKey === 'paper') return 'warn';
    if (columnKey === 'available') return 'faint';
    const index = readers.findIndex((reader) => `reader:${reader.id}` === columnKey);

    return READER_TONES[Math.max(0, index) % READER_TONES.length];
}

const subscribersOf = (boxes) => boxes.reduce((sum, box) => sum + box.subscribers, 0);

/** "Move to…" for an area or a box: the same as dragging it, from the keyboard or a phone. */
function MoveMenu({ label, lanes, current, onMove, disabled }) {
    return (
        <Dropdown>
            <Dropdown.Trigger className="button button--ghost button--sm button--icon-only db-mini" aria-label={label} isDisabled={disabled}>
                <Icon name="dots" className="h-4 w-4" />
            </Dropdown.Trigger>
            <Dropdown.Popover className="gl-pop" placement="bottom end">
                <Dropdown.Menu aria-label={label} onAction={(key) => onMove(String(key))}>
                    {lanes.filter((lane) => lane.key !== current).map((lane) => (
                        <Dropdown.Item key={lane.key} id={lane.key} textValue={lane.label}>
                            <span className="db-dot" data-tone={lane.tone} />
                            {lane.key === 'available' ? 'إعادة إلى غير الموزّعة' : `نقل إلى ${lane.label}`}
                        </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}

/** One area in a lane: its boxes there, a strip showing whose each of its boxes is, and its boxes when opened. */
function AreaGroup({ area, laneKey, lanes, tones, canMove, open, onToggle, onDragStart, onMove }) {
    const lane = lanes.find((candidate) => candidate.key === laneKey);

    return (
        <Card role="article" className="db-area" aria-label={`منطقة ${area.name}`} data-open={open || undefined}>
            <div className="db-owners" aria-hidden="true">
                {area.owners.map((owner, index) => <span key={index} data-tone={tones[owner] ?? 'faint'} />)}
            </div>
            <div
                className="db-area-head"
                draggable={canMove}
                onDragStart={(event) => onDragStart(event, area.boxes.map((box) => box.id), `منطقة ${area.name}`)}
            >
                {canMove && <span className="db-grip" aria-hidden="true">⋮⋮</span>}
                <div className="min-w-0">
                    <b>
                        {area.name}
                        {area.sharedWith.length > 0 && (
                            <span className="db-shared" title={`باقي طبلوناتها عند: ${area.sharedWith.map((key) => lanes.find((candidate) => candidate.key === key)?.label ?? key).join('، ')}`}>مقسومة</span>
                        )}
                    </b>
                    <small>{area.boxes.length === area.total ? `${formatNumber(area.total)} طبلون` : `${formatNumber(area.boxes.length)} من ${formatNumber(area.total)} طبلون`} · {formatNumber(area.subscribers)} مشترك</small>
                </div>
                <span className="db-area-tools">
                    {canMove && <MoveMenu label={`نقل منطقة ${area.name} من ${lane?.label}`} lanes={lanes} current={laneKey} onMove={(target) => onMove(area.boxes.map((box) => box.id), target, `منطقة ${area.name}`)} />}
                    <Button isIconOnly size="sm" variant="ghost" className="db-mini db-chev" onPress={onToggle} aria-expanded={open} aria-label={`${open ? 'إغلاق' : 'فتح'} منطقة ${area.name}`}>
                        <Icon name="chevron-down" className="h-4 w-4" />
                    </Button>
                </span>
            </div>
            {open && (
                <ul className="db-boxes" aria-label={`طبلونات ${area.name}`}>
                    {area.boxes.map((box) => (
                        <li
                            key={box.id}
                            className="db-box"
                            data-tone={tones[laneKey]}
                            draggable={canMove}
                            onDragStart={(event) => onDragStart(event, [box.id], `الطبلون ${box.name}`)}
                        >
                            <i aria-hidden="true" />
                            <span className="min-w-0"><b>{box.name}</b> <bdi dir="ltr">{box.number}</bdi></span>
                            <small>{formatNumber(box.subscribers)} مشترك</small>
                            {canMove && <MoveMenu label={`نقل الطبلون ${box.number}`} lanes={lanes} current={laneKey} onMove={(target) => onMove([box.id], target, `الطبلون ${box.name}`)} />}
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

/**
 * The distribution board: the areas not yet given out on one side, a lane
 * for each reader and for the paper sheets on the other. An area is dragged
 * whole to a lane, or opened and its boxes dragged one by one, so an area
 * can be split between readers and shows in each lane with what is theirs.
 * Moves wait in `staged` (box id → column) until the tray saves them; each
 * lane shows its subscribers against an even share of the branch's.
 */
export default function DistributionBoard({ boards, readers, staged, onStage, canMove, busy, onMoved }) {
    const [openAreas, setOpenAreas] = useState(() => new Set());
    const [overLane, setOverLane] = useState(null);
    const [dragging, setDragging] = useState(null);

    const lanes = useMemo(() => [
        { key: 'available', label: 'غير موزّعة', tone: 'faint' },
        ...readers.map((reader) => ({ key: `reader:${reader.id}`, label: reader.name, tone: laneTone(`reader:${reader.id}`, readers), reader })),
        { key: 'paper', label: 'الكشوف الورقية', tone: 'warn' },
    ], [readers]);
    const tones = Object.fromEntries(lanes.map((lane) => [lane.key, lane.tone]));
    const totalSubscribers = subscribersOf(boards);
    const fairShare = readers.length ? Math.ceil(totalSubscribers / readers.length) : 0;
    const columnOf = (box) => staged[box.id] ?? box.column;

    function move(boxIds, target, label) {
        onStage(stageMove(boards, staged, boxIds, target));
        onMoved?.(`${label} ← ${lanes.find((lane) => lane.key === target)?.label} (${formatNumber(boxIds.length)} طبلون)`);
    }

    function startDrag(event, boxIds, label) {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', label);
        setDragging({ boxIds, label });
    }

    function drop(event, laneKey) {
        event.preventDefault();
        setOverLane(null);
        if (dragging) {
            move(dragging.boxIds, laneKey, dragging.label);
        }
        setDragging(null);
    }

    function toggleArea(key) {
        setOpenAreas((current) => {
            const next = new Set(current);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }

    function laneProps(laneKey) {
        return canMove && !busy ? {
            onDragOver: (event) => {
                if (dragging) {
                    event.preventDefault();
                    setOverLane(laneKey);
                }
            },
            onDragLeave: (event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOverLane(null);
            },
            onDrop: (event) => drop(event, laneKey),
        } : {};
    }

    function renderGroups(laneKey) {
        const groups = laneAreaGroups(boards, staged, laneKey);

        return groups.length === 0 ? <p className="db-empty">{laneKey === 'available' ? 'كل الطبلونات موزّعة.' : canMove ? 'اسحب منطقة أو طبلونًا إلى هنا' : 'لا طبلونات'}</p> : groups.map((area) => (
            <AreaGroup
                key={area.key}
                area={area}
                laneKey={laneKey}
                lanes={lanes}
                tones={tones}
                canMove={canMove && !busy}
                open={openAreas.has(`${laneKey}|${area.key}`)}
                onToggle={() => toggleArea(`${laneKey}|${area.key}`)}
                onDragStart={startDrag}
                onMove={move}
            />
        ));
    }

    const pool = boards.filter((box) => columnOf(box) === 'available');

    return (
        <div className="db-board" onDragEnd={() => { setDragging(null); setOverLane(null); }}>
            <Card role="region" className="db-pool" aria-label="الطبلونات غير الموزّعة" data-over={overLane === 'available' || undefined} {...laneProps('available')}>
                <header className="db-lane-head">
                    <span className="db-avatar" data-tone="faint"><Icon name="layers" className="h-5 w-5" /></span>
                    <div><b>غير موزّعة</b><small>{formatNumber(pool.length)} طبلون · {formatNumber(subscribersOf(pool))} مشترك</small></div>
                </header>
                <div className="db-drop">{renderGroups('available')}</div>
            </Card>
            <div className="db-lanes">
                {lanes.filter((lane) => lane.key !== 'available').map((lane) => {
                    const boxes = boards.filter((box) => columnOf(box) === lane.key);
                    const subscribers = subscribersOf(boxes);
                    const over = lane.reader && fairShare > 0 && subscribers > fairShare;

                    return (
                        <Card role="region" key={lane.key} className="db-lane" aria-label={`عمود ${lane.label}`} data-tone={lane.tone} data-over={overLane === lane.key || undefined} {...laneProps(lane.key)}>
                            <header className="db-lane-head">
                                <span className="db-avatar" data-tone={lane.tone}>{lane.reader ? lane.label.trim().slice(0, 1) : <Icon name="printer" className="h-5 w-5" />}</span>
                                <div className="min-w-0"><b>{lane.label}</b><small>{lane.reader ? 'قارئ ميداني' : 'تُطبع وتُسلَّم لقارئ'}</small></div>
                                <span className="db-lane-count" title={`${formatNumber(subscribers)} مشترك في ${formatNumber(boxes.length)} طبلون`}><b>{formatNumber(subscribers)}</b><small>مشترك</small></span>
                            </header>
                            {lane.reader && fairShare > 0 && (
                                <div className="db-load" data-heavy={over || undefined}>
                                    <span className="db-load-bar"><i style={{ width: `${Math.min(100, (subscribers / fairShare) * 100)}%` }} /></span>
                                    <small>{over ? `أعلى من الحصة المتوازنة بـ ${formatNumber(subscribers - fairShare)}` : `الحصة المتوازنة ${formatNumber(fairShare)} مشترك`}</small>
                                </div>
                            )}
                            <div className="db-drop">{renderGroups(lane.key)}</div>
                        </Card>
                    );
                })}
            </div>
            {canMove && boards.length > 0 && Object.keys(staged).length === 0 && pool.length > 0 && (
                <p className="sr-only" role="note">اسحب المنطقة كاملة إلى قارئ، أو افتحها واسحب طبلونات بعينها.</p>
            )}
            {busy && <span className="sr-only" role="status">جارٍ الحفظ</span>}
        </div>
    );
}

const STAGE_ORDER = ['preparing', 'available', 'reading_day', 'ended', 'closed'];

/**
 * The cycle at the head of the page, on the dark card: its reading day, its
 * stages from preparing to closed with where it is now, and how the
 * branch's subscribers are spread over the readers and the paper sheets —
 * moves waiting to be saved included, so the bar answers every drop.
 */
export function DistributionMission({ cycle, boards, readers, staged, actions, today }) {
    const columnOf = (box) => staged[box.id] ?? box.column;
    const total = subscribersOf(boards);
    const parts = [
        ...readers.map((reader) => ({ key: `reader:${reader.id}`, label: reader.name })),
        { key: 'paper', label: 'الكشوف الورقية' },
    ].map((part) => ({ ...part, tone: laneTone(part.key, readers), subscribers: subscribersOf(boards.filter((box) => columnOf(box) === part.key)) }));
    const unassigned = subscribersOf(boards.filter((box) => columnOf(box) === 'available'));
    const shortDate = (date) => (date ? date.slice(5).split('-').reverse().join('/') : '');
    const opened = today && cycle.availableOn && today >= cycle.availableOn;
    const current = cycle.stage === 'preparing' && opened ? 'available' : cycle.stage;
    const reached = STAGE_ORDER.indexOf(current);
    const stages = [
        { key: 'preparing', label: 'التحضير', note: `حتى ${shortDate(cycle.availableOn)}` },
        { key: 'available', label: 'إتاحة المهام للقرّاء', note: shortDate(cycle.availableOn) },
        { key: 'reading_day', label: 'يوم القراءة', note: `${cycle.readingDayName} ${shortDate(cycle.readingDate)}` },
        { key: 'ended', label: 'المراجعة والاعتماد', note: 'بعد يوم القراءة' },
        { key: 'closed', label: 'مغلقة', note: '' },
    ];

    return (
        <Card role="region" className="db-mission" aria-label="دورة القراءة">
            <div className="db-mission-top">
                <div>
                    <small>{cycle.branchName} · أسبوع <bdi dir="ltr">{shortDate(cycle.weekStart)}</bdi> إلى <bdi dir="ltr">{shortDate(cycle.weekEnd)}</bdi>{cycle.readingDate !== cycle.weekEnd && '، يوم القراءة مؤجل لهذه الدورة'}</small>
                    <h2>قراءة {cycle.readingDayName} <bdi dir="ltr">{shortDate(cycle.readingDate)}</bdi></h2>
                </div>
                <div className="db-mission-actions">{actions}</div>
            </div>
            <ol className="db-stages" aria-label="مراحل الدورة">
                {stages.map((stage, index) => (
                    <li key={stage.key} data-state={index < reached ? 'done' : index === reached ? 'now' : undefined} aria-current={index === reached ? 'step' : undefined}>
                        {stage.label}
                        <small>{index === reached ? `الآن${stage.note ? `، ${stage.note}` : ''}` : stage.note}</small>
                    </li>
                ))}
            </ol>
            <div className="db-balance">
                <p><span>توزيع المشتركين على القرّاء</span><span><bdi dir="ltr">{formatNumber(total - unassigned)}</bdi> من <bdi dir="ltr">{formatNumber(total)}</bdi> مشترك موزّعون</span></p>
                <div className="db-balance-bar" role="img" aria-label={parts.map((part) => `${part.label} ${part.subscribers}`).join('، ')}>
                    {parts.map((part) => <i key={part.key} data-tone={part.tone} style={{ width: total ? `${(part.subscribers / total) * 100}%` : 0 }} />)}
                </div>
                <ul className="db-legend">
                    {parts.map((part) => <li key={part.key}><i data-tone={part.tone} />{part.label} <b>{formatNumber(part.subscribers)}</b></li>)}
                    <li><i data-tone="faint" />غير موزّعة <b>{formatNumber(unassigned)}</b></li>
                </ul>
            </div>
        </Card>
    );
}

/** What waits to be saved, at the foot of the board: how many boxes changed, for how long, undo and save. */
export function DistributionTray({ lastMove, changedCount, recurring, onRecurringChange, canChooseRecurring, onUndo, onDiscard, onSave, busy, availableOn }) {
    if (changedCount === 0) {
        return null;
    }

    return (
        <Card className="db-tray" role="region" aria-label="تغييرات التوزيع">
            <span className="db-tray-ico"><Icon name="pencil" className="h-4 w-4" /></span>
            <div className="min-w-0">
                <b role="status">{formatNumber(changedCount)} {changedCount === 1 ? 'طبلون تغيّر' : 'طبلونات تغيّرت'}، لم تُحفظ بعد</b>
                <small>{lastMove ? `آخر نقل: ${lastMove}. ` : ''}يراها القرّاء بعد الحفظ{availableOn ? `، وتُتاح لهم ${availableOn}` : ''}.</small>
            </div>
            <span className="grow" />
            {canChooseRecurring && (
                <SegmentedChoice label="مدة التوزيع" value={recurring ? 'always' : 'once'} onChange={(next) => onRecurringChange(next === 'always')} options={[{ value: 'always', label: 'ثابت كل أسبوع' }, { value: 'once', label: 'هذا الأسبوع فقط' }]} />
            )}
            <Button variant="secondary" onPress={onUndo} isDisabled={busy}><Icon name="undo" className="h-4 w-4" />تراجع</Button>
            <Button variant="secondary" onPress={onDiscard} isDisabled={busy}>إلغاء الكل</Button>
            <Button className="db-save" onPress={onSave} isDisabled={busy}><Icon name="check" className="h-4 w-4" />{busy ? 'جارٍ الحفظ...' : 'حفظ التوزيع'}</Button>
        </Card>
    );
}
