

/** Format report amounts with two decimals, as on the financial reports. */
export function reportMoney(amount) {
    return Number(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format a YYYY-MM-DD report date, optionally including its year. */
export function shortDate(isoDate, withYear = false) {
    const [year, month, day] = isoDate.split('-');

    return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

/** Cents of a money string, so totals add up exactly. */
export function cents(amount) {
    return Math.round(Number(amount ?? 0) * 100);
}

export function periodLabel(mode, details) {
    if (mode === 'daily') return 'تقرير يومي';
    if (mode === 'weekly') return 'تقرير أسبوعي';
    if (mode === 'monthly') return 'تقرير شهري';
    return details?.isOpen ? 'تقرير جارٍ' : 'تقرير مخصص';
}
