import { artisan } from './lib.mjs';

/** Run the table-level audit of the books and report each rule it checked. */
export function auditBooks(report) {
    const output = artisan('tinker', '--execute', 'require base_path("tests/Live/audit-books.php");');
    const { counts, violations } = JSON.parse(output.trim().split('\n').pop());
    const rules = [...new Set(violations.map((violation) => violation.rule))];

    report.check(`the books are sound: ${counts.lines} lines, ${counts.readings} readings, ${counts.boxEntries} box entries, ${counts.vouchers} vouchers`, violations.length === 0, violations.slice(0, 8).map((violation) => `${violation.rule}: ${violation.detail}`).join(' ‖ '));
    for (const rule of rules) {
        const broken = violations.filter((violation) => violation.rule === rule);
        report.finding('books', rule, `${broken.length} × e.g. ${broken[0].detail}`);
    }

    return { counts, violations };
}
