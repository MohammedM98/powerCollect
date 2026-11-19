import { useState } from 'react';
import { usePage } from '@inertiajs/react';
import DateInput from '@/Components/DateInput';
import Icon from '@/Components/Icon';
import TableExportActions from '@/Components/DataTable/TableExportActions';
import KpiTile from '@/Components/KpiTile';
import SearchableSelect from '@/Components/SearchableSelect';
import { cents, reportMoney, shortDate } from '@/lib/reportFormatting';

export const TH = 'px-3 py-2.5 text-start text-[13.5px] font-semibold text-gray-700';

export const NUM_TH = TH.replace('text-start', 'text-right');

export const TD = 'px-3 py-2.5 text-start';

export const NUM = 'px-3 py-2.5 text-right [direction:ltr] font-display tabular-nums text-gray-900';

export function Comparison({ comparison }) {
    const difference = Number(comparison.difference);

    return (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-gray-100 bg-surface p-4 shadow-card" aria-label="المقارنة بالفترة السابقة">
            <div>
                <h3 className="text-sm font-bold text-gray-900">التحصيل مقارنة بالفترة السابقة</h3>
                <p className="mt-1 text-xs text-gray-500">{shortDate(comparison.from, true)} – {shortDate(comparison.to, true)}، المحصّل سابقًا {reportMoney(comparison.total)} ₪</p>
            </div>
            <p className={`text-sm font-semibold ${difference > 0 ? 'text-emerald-700 dark:text-emerald-400' : difference < 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-600'}`}>
                {difference > 0 ? 'زيادة' : difference < 0 ? 'انخفاض' : 'لم يتغير'} {reportMoney(Math.abs(difference))} ₪
                {comparison.percentage === null ? '، لا تحصيل في الفترة السابقة' : ` (${Math.abs(comparison.percentage)}%)`}
            </p>
        </section>
    );
}

/** A white card with an icon and a title, as the dashboard's panels. */
export function Panel({ icon, title, hint = null, className = '', excelParts, children }) {
    const { canExport, auth, scopeLabel, filters } = usePage().props;
    return (
        <section data-excel-source={excelParts ? 'custom' : undefined} className={`rounded-panel border border-gray-100 bg-surface p-5 shadow-card sm:p-6 ${className}`}>
            <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-gray-500">
                    <Icon name={icon} className="h-[18px] w-[18px]" />
                </span>
                <h3 className="font-bold text-gray-900">{title}</h3>
                {hint && <span className="text-xs text-gray-500">{hint}</span>}
                {canExport && excelParts && <TableExportActions title={title} showPrint={false} excelProps={{ storageKey: `reports:${title}`, templateKind: 'reports', loadParts: async (options) => (await excelParts(options)).map((part) => ({ ...part, default: true })), meta: { lines: [scopeLabel, `${filters.from} – ${filters.to}`].filter(Boolean), criteria: [['أعدّه', auth?.user?.name ?? ''], ['من', filters.from], ['إلى', filters.to]] } }} />}
            </div>
            {children}
        </section>
    );
}

/** The branch (for whoever doesn't see the banner), the quick periods, the dates and stepping to the period before or after. */
export function PeriodCard({ branches, branchScope, scopeLabel, filters, presets, today, period, periodText, visit }) {
    const preset = presets.find((item) => item.from === filters.from && item.to === filters.to)?.key ?? '';
    const [datesOpen, setDatesOpen] = useState(false);
    const stepClass = 'gl-ib w-auto gap-1 px-2.5 text-sm font-semibold disabled:opacity-40';

    return (
        <section aria-label="فلاتر التقرير" className="gl-scope sticky top-(--tn-sticky-top) z-30">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3"><span className="gl-scope-ico" aria-hidden="true"><Icon name="calendar" className="h-5 w-5" /></span><div className="min-w-0"><h3 className="gl-scope-eyebrow">الفترة</h3><p className="gl-scope-name text-base!"><bdi dir="ltr">{periodText}</bdi></p></div></div>
                {!branchScope && branches.length > 1 && (
                    <label className="order-3 flex w-full flex-col gap-1.5 gl-label text-xs sm:order-0 sm:w-60">
                        الفرع
                        <SearchableSelect
                            value={filters.branch ?? ''}
                            onChange={(value) => value && visit({ branch: value, page: undefined })}
                            options={[{ value: 'all', label: 'كل الفروع' }, ...branches.map((branch) => ({ value: String(branch.value), label: branch.label }))]}
                            searchable={branches.length > 6}
                            portal
                        />
                    </label>
                )}
                {!branchScope && branches.length === 1 && (
                    <div className="order-3 flex w-full flex-col gap-1.5 gl-label text-xs sm:order-0 sm:w-auto">
                        الفرع
                        <span className="flex h-10 items-center gap-2 rounded-control border px-3 text-sm font-bold" style={{ borderColor: 'var(--gl-line)', background: 'var(--gl-fill)' }}>
                            <Icon name="pin" className="h-4 w-4" />
                            {scopeLabel}
                        </span>
                    </div>
                )}
                <div className="order-2 w-full sm:w-52">
                    <label htmlFor="report-period" className="sr-only">الفترة</label>
                    <SearchableSelect
                        id="report-period"
                        portal
                        clearable={false}
                        searchable={false}
                        value={datesOpen ? 'custom' : preset || 'custom'}
                        onChange={(key) => {
                            if (key === 'custom') { setDatesOpen(true); return; }
                            const chosen = presets.find((item) => item.key === key);
                            setDatesOpen(false);
                            visit({ from: chosen.from, to: chosen.to, view: undefined, page: undefined });
                        }}
                        options={[...presets.map((item) => ({ value: item.key, label: item.label })), { value: 'custom', label: 'تاريخ مخصص' }]}
                    />
                </div>
                <div className="order-1 flex items-center gap-1 sm:order-3">
                    <button type="button" aria-label="الفترة السابقة" disabled={!period?.previous} className={stepClass} onClick={() => period?.previous && visit({ ...period.previous, page: undefined })}><Icon name="chevron-right" className="h-4 w-4" /></button>
                    <button type="button" aria-label="الفترة التالية" disabled={!period?.next} className={stepClass} onClick={() => period?.next && visit({ ...period.next, page: undefined })}><Icon name="chevron-left" className="h-4 w-4" /></button>
                </div>
            </div>
            {datesOpen && <div className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3 border-(--gl-line)!">
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row" role="group" aria-label="من تاريخ إلى تاريخ">
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5 gl-label text-xs sm:flex-none"><span>من تاريخ</span><DateInput aria-label="من تاريخ" className="w-full sm:w-52" required value={filters.from} max={filters.to} onChange={(value) => value && visit({ from: value, page: undefined })} /></label>
                    <label className="flex min-w-0 flex-1 flex-col gap-1.5 gl-label text-xs sm:flex-none"><span>إلى تاريخ</span><DateInput aria-label="إلى تاريخ" className="w-full sm:w-52" required value={filters.to} min={filters.from} max={today} onChange={(value) => value && visit({ to: value, page: undefined })} /></label>
                </div>
                <button type="button" className={stepClass} onClick={() => setDatesOpen(false)}>إغلاق<Icon name="close" className="h-4 w-4" /></button>
            </div>}
        </section>
    );
}

/** What was collected (cash against transfers and cheques), what the subscribers owed at the start and at the end, and what was charged. */
export function Figures({ flow, collections }) {
    const change = cents(flow.change);
    const total = Number(collections.total);

    return (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <KpiTile hero label="إجمالي المقبوضات المسجّلة" value={reportMoney(collections.total)} unit="₪" hint={`${collections.count} دفعة في الفترة`} className="md:col-span-2 xl:col-span-1 xl:row-span-2">
                <div className="gl-bar mt-5 flex" role="img" aria-label="النقدي والتحويلات والشيكات">
                    {total > 0 && (
                        <>
                            <span style={{ width: `${(Number(collections.cash) / total) * 100}%`, background: 'var(--gl-ink)' }} />
                            <span className="bg-brand-500" style={{ width: `${(Number(collections.nonCash) / total) * 100}%` }} />
                        </>
                    )}
                </div>
                <div className="gl-hint mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: 'var(--gl-ink)' }} />نقدي <b className="font-display text-(--gl-ink)!">{reportMoney(collections.cash)} ₪</b></span>
                    <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand-500" />تحويلات وشيكات <b className="font-display text-(--gl-ink)!">{reportMoney(collections.nonCash)} ₪</b></span>
                </div>
            </KpiTile>
            <KpiTile icon="ledger" label="الرصيد الافتتاحي" value={<bdi dir="ltr">{reportMoney(flow.opening)}</bdi>} unit="₪" hint={Number(flow.opening) < 0 ? 'لصالح المشتركين' : 'على المشتركين'} />
            <KpiTile icon="document-plus" label="التحميلات" value={reportMoney(flow.chargesTotal)} unit="₪" hint="قراءات ورسوم وغرامات" />
            <KpiTile icon="layers" label="الرصيد الختامي" value={<bdi dir="ltr">{reportMoney(flow.closing)}</bdi>} unit="₪" className="md:col-span-2">
                <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${change > 0 ? 'bg-amber-500/10 text-amber-700' : change < 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {change > 0 ? 'زاد' : change < 0 ? 'نقص' : 'لم يتغير'}
                    {change !== 0 && <b className="font-display">{reportMoney(Math.abs(Number(flow.change)))} ₪</b>}
                    <span className="font-normal">خلال الفترة</span>
                </p>
            </KpiTile>
        </div>
    );
}
