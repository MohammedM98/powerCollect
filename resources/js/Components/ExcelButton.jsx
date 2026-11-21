import { Button } from '@heroui/react';
import { lazy, Suspense, useState } from 'react';
import Icon from '@/Components/Icon';
import { excelUrl } from '@/lib/tableExcel';
import { pageTitle } from '@/lib/print';

const ExcelStudio = lazy(() => import('@/Components/ExcelStudio'));

export const tableExportButtonClass = 'inline-flex h-[34px] items-center gap-2 rounded-control border px-3 text-sm font-semibold transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-gray-900 disabled:cursor-not-allowed disabled:opacity-50';

/** The same small action beside every table's print button; the editor loads on demand. */
export default function ExcelButton({ title, base, loadParts, storageKey, templateKind = 'tables', meta, disabled = false, className = tableExportButtonClass, label = 'Excel' }) {
    const [open, setOpen] = useState(false);
    const caption = title ?? document.title;
    const classes = `tone-excel ${className}`;

    if (!loadParts) {
        return <a data-excel-button href={excelUrl(caption, base)} onClick={(event) => { event.currentTarget.href = excelUrl(title ?? pageTitle(), base); }} target="_blank" rel="noopener noreferrer" className={classes} title="تخصيص وتنزيل ملف Excel منسّق لكل النتائج المطابقة"><Icon name="excel" className="h-4 w-4" />{label}</a>;
    }

    return <>
        <Button data-raw="" variant="ghost" data-excel-button isDisabled={disabled} onClick={() => setOpen(true)} className={classes} title="تخصيص وتنزيل ملف Excel منسّق"><Icon name="excel" className="h-4 w-4" />{label}</Button>
        {open && <Suspense fallback={<span role="status" className="text-xs text-gray-500">جارٍ تحميل محرر Excel…</span>}>
            <ExcelStudio show onClose={() => setOpen(false)} title={`تصدير ${caption} إلى Excel`} storageKey={storageKey ?? `table:${window.location.pathname}`} templateKind={templateKind} loadParts={loadParts} defaults={{ title: caption, fileName: caption }} meta={meta} />
        </Suspense>}
    </>;
}
