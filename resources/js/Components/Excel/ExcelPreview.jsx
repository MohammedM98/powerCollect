import TabStrip from '@/Components/UI/TabStrip';
import Icon from '@/Components/UI/Icon';
import { columnLetter, excelLook, formatExcelCell } from '@/lib/excelSheet';

/** The weight and lines of each kind of row; its colours, size and height come from the look the user chose. */
export const ROW_STYLE = {
    title: 'font-bold',
    subtitle: 'font-bold text-gray-900',
    meta: 'text-gray-500',
    head: 'text-center font-bold',
    group: 'font-bold',
    subtotal: 'bg-gray-100 font-bold',
    total: 'border-t-4 border-double border-gray-500 bg-gray-200 font-bold',
};

/** The sheets as Excel will show them: column letters, row numbers, the formula bar and a tab per sheet. */
export function Preview({ sheet, sheets, sheetIndex, onSheet, shownCell, onCell, settings }) {
    if (!sheet) {
        return <p className="m-auto text-sm text-gray-500">اختر جزءاً واحداً على الأقل.</p>;
    }

    const shown = sheet.rows.slice(0, PREVIEW_ROWS);
    const { theme, font, rows: heights } = excelLook(settings);
    // Points to pixels, as Excel draws at 100%.
    const px = (points) => Math.round(points * 1.333);
    const rowStyle = (kind) =>
        ({
            title: { color: `#${theme.title}`, fontSize: px(font.title), height: px(font.title * 1.75) },
            subtitle: { fontSize: px(font.subtitle), height: px(font.subtitle * 1.65) },
            meta: { fontSize: px(font.body - 1), height: px(heights.data) },
            head: { background: `#${theme.head}`, color: `#${theme.headText}`, height: px(heights.data + 6) },
            group: { background: `#${theme.group}`, color: `#${theme.groupText}` },
        })[kind] ?? { height: px(heights.data) };
    const width = 40 + sheet.widths.reduce((total, columnWidth) => total + columnWidth * 7.5, 0);

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-control border border-gray-200 bg-surface">
            <div className="flex items-center gap-2 bg-excel-600 px-3 py-2 text-xs font-semibold text-white">
                <Icon name="excel" className="h-4 w-4" />
                معاينة الورقة
                <span className="ms-auto font-display">{sheet.rows.length.toLocaleString('en')} صف</span>
            </div>
            <div className="flex items-center border-b border-gray-200 text-xs" dir="ltr">
                <span className="min-w-16 border-e border-gray-200 px-3 py-2 font-display text-gray-600">{shownCell?.address ?? 'A1'}</span>
                <i className="border-e border-gray-200 px-3 py-2 text-gray-400">fx</i>
                <code className="truncate px-3 py-2" dir="auto">
                    {shownCell ? (shownCell.formula ? `=${shownCell.formula}` : shownCell.text) : ''}
                </code>
            </div>
            <div className="min-h-0 flex-1 overflow-auto" dir={settings.rtl ? 'rtl' : 'ltr'}>
                <table className="border-collapse" style={{ width, tableLayout: 'fixed', fontFamily: 'Arial, sans-serif', fontSize: px(font.body) }}>
                    <colgroup>
                        <col className="w-[40px]!" />
                        {sheet.widths.map((columnWidth, index) => (
                            <col key={index} style={{ width: columnWidth * 7.5 }} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            <th className="sticky top-0 border border-gray-200 bg-gray-50" />
                            {sheet.widths.map((_, index) => (
                                <th key={index} className="sticky top-0 border border-gray-200 bg-gray-50 px-1 py-1 font-normal text-gray-500">
                                    {columnLetter(index)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((row) => {
                            const merged = ['title', 'subtitle', 'meta', 'group'].includes(row.kind) && row.cells.length === 1;
                            return (
                                <tr
                                    key={row.row}
                                    className={`${ROW_STYLE[row.kind] ?? ''} ${row.zebra ? 'bg-gray-50' : ''}`}
                                    style={rowStyle(row.kind)}
                                >
                                    <td className="border border-gray-200 bg-gray-50 px-1 text-center font-normal text-gray-400">{row.row}</td>
                                    {row.kind === 'blank' ? (
                                        <td colSpan={sheet.widths.length} className="h-5 border border-gray-200" />
                                    ) : merged ? (
                                        <td colSpan={sheet.widths.length} className="truncate border border-gray-200 px-2">
                                            {row.cells[0].v}
                                        </td>
                                    ) : (
                                        sheet.widths.map((_, index) => {
                                            const cell = row.cells[index] ?? { v: '' };
                                            const text = formatExcelCell(cell.v, cell.t, settings.currency);
                                            const address = `${columnLetter(index)}${row.row}`;
                                            const numeric = ['money', 'decimal', 'int'].includes(cell.t);
                                            return (
                                                <td
                                                    key={index}
                                                    onClick={() => onCell({ address, formula: cell.f, text })}
                                                    className={`cursor-cell truncate border border-gray-200 px-2 ${numeric ? 'font-display tabular-nums' : ''} ${shownCell?.address === address ? 'outline-solid outline-2 -outline-offset-2 outline-excel-500' : ''}`}
                                                    style={{ textAlign: numeric ? (settings.rtl ? 'left' : 'right') : undefined }}
                                                >
                                                    {cell.f && <span className="me-1 text-[9px] italic text-excel-600">ƒ</span>}
                                                    {text}
                                                </td>
                                            );
                                        })
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {sheet.rows.length > PREVIEW_ROWS && (
                <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                    تعرض المعاينة أول {PREVIEW_ROWS} صفاً من {sheet.rows.length.toLocaleString('en')}؛ الملف يحوي كل الصفوف.
                </p>
            )}
            <TabStrip
                label="أوراق الملف"
                className="flex gap-1 overflow-x-auto border-t border-gray-200 bg-gray-50 px-2"
                selectedKey={sheets[sheetIndex]?.key}
                onSelectionChange={(key) => onSheet(sheets.findIndex((candidate) => String(candidate.key) === key))}
                tabs={sheets.map((candidate) => ({ id: String(candidate.key), label: candidate.name }))}
                tabClassName={(tab, selected) => `cursor-pointer whitespace-nowrap border-t-[3px] px-3 py-2 text-xs outline-none ${selected ? 'border-excel-600 bg-surface font-bold text-excel-700' : 'border-transparent text-gray-500'}`}
            />
        </div>
    );
}

export const PREVIEW_ROWS = 80;
