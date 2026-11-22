import { formatNumber } from '@/lib/format';

export default function DistributionAreaBreakdown({ areas }) {
    return <div className="divide-y divide-(--ma-line)">{areas.map((area) => (
        <div key={area.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-(--ma-ink)">{area.name} {area.complete
                    ? <span className="text-xs text-(--ma-pay)">كاملة</span>
                    : <span className="text-xs font-normal text-(--ma-muted)">· {formatNumber(area.boxes)} من {formatNumber(area.total)} طبلون</span>}</span>
                <span className="text-xs text-(--ma-muted)">{formatNumber(area.subscribers)} مشترك</span>
            </div>
            <details className="mt-2 text-xs text-(--ma-muted)">
                <summary className="cursor-pointer font-semibold text-(--ma-brand)">عرض الطبلونات ({formatNumber(area.boxes)})</summary>
                <ul className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-control bg-(--ma-tile) p-2" aria-label={`طبلونات ${area.name}`}>
                    {area.items.map((box) => <li key={box.id} className="rounded-md border border-(--ma-line) bg-(--ma-solid) px-2 py-2 text-(--ma-ink)">{box.name || 'طبلون'} <bdi dir="ltr" className="whitespace-nowrap font-display font-bold">({box.number})</bdi></li>)}
                </ul>
            </details>
        </div>
    ))}</div>;
}
