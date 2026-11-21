import { Button } from '@heroui/react';
import RowIdentity from '@/Components/DataTable/RowIdentity';
import { formatNumber } from '@/lib/format';
import { BandRow, CheckBox, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, StatusPill } from '@/Components/UI';

export default function DistributionTable({ boxes, allBoxes = boxes, readers, selected, canSelect, busy, onToggle, onToggleGroup }) {
    const groups = new Map();
    boxes.forEach((box) => {
        const key = box.subAreaId ?? 'none';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(box);
    });
    const readerNames = new Map(readers.map((reader) => [reader.id, reader.name]));

    function readerLabel(box) {
        if (box.column === 'available') return 'غير موزع';
        if (box.column === 'paper') return 'كشف ورقي';
        return readerNames.get(Number(box.column.split(':')[1])) ?? 'القارئ غير متاح';
    }

    function defaultLabel(box) {
        if (box.recurringChannel === 'paper') return 'الثابت: كشف ورقي';
        if (box.recurringUserId) return `الثابت: ${readerNames.get(box.recurringUserId) ?? 'القارئ غير متاح'}`;
        return 'لم يُحفظ توزيع ثابت';
    }

    return (
        <div className="data-table-container" aria-busy={busy}>
            <ListTable className="data-table w-full text-start text-sm" aria-label="توزيع الطبلونات حسب المنطقة">
                <ListHeader>
                    {canSelect && <ListColumn id="select" className="w-10"><span className="sr-only">تحديد</span></ListColumn>}
                    <ListColumn id="box" isRowHeader>الطبلون</ListColumn>
                    <ListColumn id="subscribers">المشتركون</ListColumn>
                    <ListColumn id="reader">القارئ المكلّف</ListColumn>
                    <ListColumn id="status">حالة التوزيع</ListColumn>
                    <ListColumn id="progress">الإنجاز</ListColumn>
                </ListHeader>
                <ListBody empty={<div className="py-8 text-center text-gray-500">لا توجد طبلونات مطابقة. غيّر البحث أو المنطقة.</div>}>
                    {[...groups].flatMap(([id, group]) => {
                        const matchingArea = allBoxes.filter((box) => String(box.subAreaId ?? 'none') === String(id));
                        return [
                            <BandRow key={`area-${id}`} id={`area-${id}`} columns={canSelect ? 6 : 5} className="bg-gray-50">
                                <div className="flex flex-wrap items-center justify-between gap-3 py-1">
                                    <span className="font-bold text-gray-900">{group[0].subAreaName ?? 'بدون منطقة 2'} <span className="font-normal text-gray-500">({formatNumber(matchingArea.length)} طبلون ضمن النتائج)</span></span>
                                    {canSelect && <Button data-raw="" variant="ghost" isDisabled={busy} onClick={() => onToggleGroup(matchingArea)} className="text-xs font-semibold text-brand-600 hover:underline">{matchingArea.every((box) => selected.has(box.id)) ? 'إلغاء تحديد المنطقة' : 'تحديد المنطقة كاملة'}</Button>}
                                </div>
                            </BandRow>,
                            ...group.map((box) => (
                                <ListRow key={box.id} id={box.id} className={selected.has(box.id) ? 'bg-brand-500/5' : ''}>
                                    {canSelect && <ListCell><CheckBox checked={selected.has(box.id)} disabled={busy} onChange={() => onToggle(box.id)} aria-label={`تحديد الطبلون ${box.number}`} /></ListCell>}
                                    <ListCell data-label="الطبلون"><RowIdentity icon="table" wrapName name={<>{box.name} <bdi dir="ltr" className="whitespace-nowrap font-display text-base font-bold">({box.number})</bdi></>} /></ListCell>
                                    <ListCell data-label="المشتركون">{formatNumber(box.subscribers)}</ListCell>
                                    <ListCell data-label="القارئ المكلّف"><span className={box.column === 'available' ? 'font-semibold text-amber-700' : 'font-semibold text-gray-900'}>{readerLabel(box)}</span><div className="mt-1 text-xs text-gray-500">{defaultLabel(box)}</div></ListCell>
                                    <ListCell data-label="حالة التوزيع"><div className="flex flex-wrap gap-1">
                                        <StatusPill tone={box.status === 'approved' ? 'green' : box.status ? 'amber' : 'gray'} label={box.status === 'approved' ? 'محفوظ ومعتمد' : box.status ? 'بانتظار الاعتماد' : 'غير موزع'} />
                                        {box.downloaded && <StatusPill tone="blue" label="تم تنزيل المهام" />}
                                    </div></ListCell>
                                    <ListCell data-label="الإنجاز"><span className="font-display" dir="ltr">{formatNumber(box.read)} / {formatNumber(box.subscribers)}</span><progress className="mt-1 block h-1.5 w-24 accent-brand-600" max={box.subscribers || 1} value={box.read} aria-label={`قُرئ ${box.read} من ${box.subscribers}`} /></ListCell>
                                </ListRow>
                            )),
                        ];
                    })}
                </ListBody>
            </ListTable>
        </div>
    );
}
