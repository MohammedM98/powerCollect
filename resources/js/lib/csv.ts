/** One cell of a CSV row: text is protected from running as a formula, numbers are written as they are. */
export type CsvCell = string | number | boolean | null | undefined;

/**
 * A CSV file Excel opens as UTF-8 (it starts with a byte-order mark), one
 * quoted cell per value. User-authored text stays text: a cell starting
 * like a formula (=, +, @, - …) gets a leading apostrophe so Excel never
 * runs it. Numbers are written as they are.
 */
export function csvText(rows: CsvCell[][]): string {
    return '﻿' + rows.map((row) => row.map((value) => {
        const text = String(value);
        const safeText = typeof value === 'string' && /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
        return `"${safeText.replaceAll('"', '""')}"`;
    }).join(',')).join('\r\n');
}

/** Hand the browser a CSV file to save. */
export function downloadCsv(text: string, fileName: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
