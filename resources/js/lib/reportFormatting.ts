import { formatMoney } from './format.js';
import type { Amount } from './types.ts';

/** Format report amounts with two decimals, as on the financial reports. */
export function reportMoney(amount: Amount): string {
    return formatMoney(amount, { cents: true });
}

/** Format a YYYY-MM-DD report date, optionally including its year. */
export function shortDate(isoDate: string, withYear = false): string {
    const [year, month, day] = isoDate.split('-');

    return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

/** Cents of a money string, so totals add up exactly. */
export function cents(amount: Amount): number {
    return Math.round(Number(amount ?? 0) * 100);
}

export type ReportMode = 'daily' | 'weekly' | 'monthly' | 'custom';

export function periodLabel(mode: ReportMode | string | undefined, details?: { isOpen?: boolean } | null): string {
    if (mode === 'daily') return 'تقرير يومي';
    if (mode === 'weekly') return 'تقرير أسبوعي';
    if (mode === 'monthly') return 'تقرير شهري';
    return details?.isOpen ? 'تقرير جارٍ' : 'تقرير مخصص';
}
