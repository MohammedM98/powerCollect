import { Button, Input } from '@heroui/react';
import { useState } from 'react';
import Icon from '@/Components/UI/Icon';
import { formatNumber } from '@/lib/format';
import { readingSearchMatches } from '@/lib/readingBoard';
import { CheckBox } from '@/Components/UI';

export default function DistributionAreas({ areas, chosen, onChange, disabled, filter, counts, onFilterChange, onDistribute, distributionCount = 0 }) {
    const [search, setSearch] = useState('');
    const matching = areas.filter((area) => readingSearchMatches(area.name, search));
    const activeStatus = filter === 'available' ? 'available' : filter ? 'assigned' : '';

    function toggle(id) {
        onChange(chosen.includes(id) ? chosen.filter((value) => value !== id) : [...chosen, id]);
    }

    return (
        <aside className="overflow-hidden rounded-card border border-(--ma-line) bg-(--ma-solid) shadow-card" aria-label="اختيار مناطق التوزيع">
            <div className="flex flex-col gap-3 border-b border-(--ma-line) p-4">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 font-bold text-(--ma-ink)"><Icon name="pin" className="h-4 w-4 text-(--ma-brand)" />المناطق</h2>
                    {chosen.length > 0 && <Button data-raw="" variant="ghost" isDisabled={disabled} onClick={() => onChange([])} className="text-xs font-semibold text-(--ma-brand) hover:underline">عرض الكل</Button>}
                </div>
                <p className="text-xs leading-6 text-(--ma-muted)">اختر منطقة أو أكثر، ثم حدّد الطبلونات التي تريد توزيعها.</p>
                <div role="group" aria-label="تصفية المناطق حسب حالة التوزيع" className="grid grid-cols-3 gap-1 rounded-control border border-(--ma-line) bg-(--ma-tile) p-1">
                    {[
                        { value: '', label: 'الكل', count: counts.all },
                        { value: 'assigned', label: 'موزع', count: counts.assigned },
                        { value: 'available', label: 'غير موزع', count: counts.available },
                    ].map((status) => <Button data-raw="" variant="ghost" key={status.value} isDisabled={disabled} aria-pressed={activeStatus === status.value} onClick={() => onFilterChange(status.value)} className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-semibold transition ${activeStatus === status.value ? 'bg-(--ma-solid) text-(--ma-brand) shadow-xs' : 'text-(--ma-muted) hover:text-(--ma-ink)'}`}>
                        <span>{status.label}</span><span className="font-display text-sm">{formatNumber(status.count)}</span>
                    </Button>)}
                </div>
                <label className="sr-only" htmlFor="distribution-area-search">البحث عن منطقة</label>
                <Input id="distribution-area-search" type="search" value={search} disabled={disabled} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن منطقة..." className="block w-full text-sm" />
                <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-(--ma-muted)">{formatNumber(matching.length)} منطقة{chosen.length > 0 && `، اختيرت ${formatNumber(chosen.length)}`}</span>
                    {matching.length > 0 && <Button data-raw="" variant="ghost" isDisabled={disabled} onClick={() => onChange([...new Set([...chosen, ...matching.map((area) => area.id)])])} className="font-semibold text-(--ma-brand) hover:underline">اختيار كل نتائج المناطق</Button>}
                </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-2 lg:max-h-120">
                {matching.length === 0 && <p className="px-3 py-6 text-center text-sm text-(--ma-muted)">لا توجد مناطق مطابقة للبحث وحالة التوزيع. غيّر البحث أو اختر «الكل».</p>}
                {matching.map((area) => <label key={area.id} className={`flex cursor-pointer items-start gap-3 rounded-control px-3 py-3 hover:bg-(--ma-tile) ${chosen.includes(area.id) ? 'bg-(--ma-brand-soft)' : ''}`}>
                    <CheckBox checked={chosen.includes(area.id)} disabled={disabled} onChange={() => toggle(area.id)} aria-label={`عرض منطقة ${area.name}`} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="block text-sm font-semibold text-(--ma-ink)">{area.name}</span>
                        <span className="text-xs text-(--ma-muted)">{formatNumber(area.matchingBoxes)} طبلون{filter ? ' مطابق' : ''}، {formatNumber(area.matchingSubscribers)} مشترك</span>
                        <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs" aria-label={`إجمالي المنطقة: ${area.assigned} موزع، ${area.unassigned} غير موزع`}>
                            <span className="text-(--ma-pay)">{formatNumber(area.assigned)} موزع</span>
                            <span className="text-(--ma-warn)">{formatNumber(area.unassigned)} متبقٍ</span>
                        </span>
                    </span>
                </label>)}
            </div>
            {chosen.length > 0 && onDistribute && <div className="border-t border-(--ma-line) p-4"><Button data-raw="" variant="ghost" isDisabled={disabled || distributionCount === 0} onClick={onDistribute} className="gl-btn w-full">إجراء على المناطق المختارة ({formatNumber(distributionCount)})</Button><p className="mt-2 text-xs leading-6 text-(--ma-muted)">يشمل الطبلونات المطابقة للتصفية في كل الصفحات.</p></div>}
        </aside>
    );
}
