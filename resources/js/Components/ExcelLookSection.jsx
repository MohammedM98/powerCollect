import SegmentedTabs from '@/Components/SegmentedTabs';
import { EXCEL_FONT_SIZES, EXCEL_ORIENTATIONS, EXCEL_ROW_HEIGHTS, EXCEL_THEMES } from '@/lib/excelSheet';
import { Section } from './ExcelStudioParts';

/** The workbook's look: colours, font and sizes. */
export default function ExcelLookSection({ change, settings }) {
    return (
        <Section title="الألوان والخط">
            <p className="mb-2 text-sm font-semibold text-gray-700">ألوان صف العناوين والعنوان</p>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="الألوان">
                {Object.entries(EXCEL_THEMES).map(([key, theme]) => (
                    <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={settings.theme === key}
                        onClick={() => change({ theme: key })}
                        className={`flex flex-col items-center gap-1 rounded-control border p-1.5 text-[11px] font-semibold transition ${settings.theme === key ? 'border-excel-500 bg-excel-500/5 text-gray-900' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}
                    >
                        <span className="flex h-7 w-full flex-col overflow-hidden rounded border border-gray-200" aria-hidden="true">
                            <span className="h-2" style={{ background: `#${theme.title}` }} />
                            <span className="flex-1" style={{ background: `#${theme.head}` }} />
                            <span className="h-1.5" style={{ background: `#${theme.group}` }} />
                        </span>
                        {theme.label}
                    </button>
                ))}
            </div>
            <div className="mt-4 space-y-3 text-sm font-semibold text-gray-700">
                <div className="flex items-center justify-between gap-3">
                    حجم الخط
                    <SegmentedTabs
                        label="حجم الخط"
                        value={settings.fontSize}
                        onChange={(value) => change({ fontSize: value })}
                        options={Object.entries(EXCEL_FONT_SIZES).map(([value, size]) => ({ value, label: size.label }))}
                    />
                </div>
                <div className="flex items-center justify-between gap-3">
                    ارتفاع الصفوف
                    <SegmentedTabs
                        label="ارتفاع الصفوف"
                        value={settings.rowHeight}
                        onChange={(value) => change({ rowHeight: value })}
                        options={Object.entries(EXCEL_ROW_HEIGHTS).map(([value, height]) => ({ value, label: height.label }))}
                    />
                </div>
                <div className="flex items-center justify-between gap-3">
                    اتجاه الصفحة عند الطباعة
                    <SegmentedTabs
                        label="اتجاه الصفحة"
                        value={settings.orientation}
                        onChange={(value) => change({ orientation: value })}
                        options={Object.entries(EXCEL_ORIENTATIONS).map(([value, label]) => ({ value, label }))}
                    />
                </div>
            </div>
        </Section>
    );
}
