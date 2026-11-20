import { formatMoney } from './format.js';
import type { Amount } from './types.ts';

/**
 * An amount as a field takes it, without thousands separators: two decimal
 * places, or none when it is a whole number (50 → '50', 617.5 → '617.50',
 * -0.004 → '0'). Shown to people, an amount is written by formatMoney().
 */
export function formatAmount(amount: Amount): string {
    const cents = Math.round(Number(amount) * 100) || 0;

    return (cents / 100).toFixed(2).replace(/\.00$/, '');
}

/** Rounded to cents through the decimal text (78.225 → 78.23), as the server rounds it. */
export function roundToCents(amount: Amount): number {
    return Number(`${Math.round(Number(`${amount}e2`))}e-2`);
}

/** An amount with the shekel sign, for tables and cards: 50 → '50 ₪'. In running text, formatCurrency() writes the word. */
export function formatShekels(amount: Amount): string {
    if (amount === null || amount === undefined || amount === '') {
        return '—';
    }

    return `${formatMoney(amount)} ₪`;
}

/** An amount with the word for the currency, for running text: 50 → '50 شيكل'. */
export function formatCurrency(amount: Amount): string {
    if (amount === null || amount === undefined || amount === '') {
        return '—';
    }

    return `${formatMoney(amount)} شيكل`;
}

/** An amount in whole agorot, so sums of cents never drift. */
export function toCents(value: Amount): number {
    const cents = Math.round(Number(value || 0) * 100);

    return Number.isFinite(cents) ? cents : 0;
}

export function fromCents(cents: number): number {
    return cents / 100;
}
