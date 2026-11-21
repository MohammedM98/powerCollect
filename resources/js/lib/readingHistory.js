import { roundToCents } from './currency.ts';

/** Periods are measured back from the subscription's latest recorded week. */
export function readingsInPeriod(readings, period) {
    const sorted = [...readings].sort((a, b) => b.weekEnd.localeCompare(a.weekEnd));

    if (period === 'all' || sorted.length === 0) {
        return sorted;
    }

    const cutoff = new Date(`${sorted[0].weekEnd}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - Number(period) * 7);

    return sorted.filter((reading) => reading.weekEnd > cutoff.toISOString().slice(0, 10));
}

export function readingTotals(readings) {
    return readings.reduce((totals, reading) => ({
        consumption: roundToCents(totals.consumption + Number(reading.consumption)),
        discount: roundToCents(totals.discount + Number(reading.discountAmount)),
        due: roundToCents(totals.due + Number(reading.amountDue)),
    }), { consumption: 0, discount: 0, due: 0 });
}

export function groupReadingsByMonth(readings) {
    const groups = new Map();

    for (const reading of readings) {
        const month = reading.weekEnd.slice(0, 7);
        if (!groups.has(month)) {
            groups.set(month, { month, readings: [] });
        }
        groups.get(month).readings.push(reading);
    }

    return [...groups.values()].map((group) => ({ ...group, totals: readingTotals(group.readings) }));
}
