import { useBrand } from '@/hooks/useBrand';

// The time printed on the statement, in the app's Arabic with Western digits.
export const PRINTED_AT_FORMAT = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { dateStyle: 'long', timeStyle: 'short' });

/** The statement's heading on paper: the company, the subscription, and when it was printed. */
export function PrintHeading({ subscription, caption }) {
    const brand = useBrand();

    return (
        <header className="statement-print-only mb-3 border-b-2 border-brand-600 pb-2">
            <div className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-3">
                    <img src={brand.logos.print} alt={`شعار ${brand.name}`} className="h-12 w-auto" />
                    <div>
                        <div className="text-base font-bold">{brand.name}</div>
                        <div className="text-sm text-gray-600">{subscription.branchName}</div>
                    </div>
                </div>
                <div className="text-end">
                    <h1 className="text-xl font-bold text-brand-600">كشف حساب {subscription.fullName}</h1>
                    <p className="text-sm text-gray-700">
                        {subscription.subscriberNumber && (
                            <>
                                مشترك <bdi dir="ltr">{subscription.subscriberNumber}</bdi> ·{' '}
                            </>
                        )}
                        حساب <bdi dir="ltr">{subscription.accountNumber}</bdi>
                        {subscription.tariffCategoryLabel && ` · ${subscription.tariffCategoryLabel}`}
                        {subscription.tariffSegmentName && ` (${subscription.tariffSegmentName})`}
                        {subscription.meterBoxNumber && ` · طبلون ${subscription.meterBoxNumber}`}
                    </p>
                    <p className="text-xs text-gray-600">طُبع في {PRINTED_AT_FORMAT.format(new Date())}</p>
                </div>
            </div>
            {caption && <p className="mt-2 text-xs text-gray-700">مطبوع حسب: {caption}</p>}
        </header>
    );
}

export function SummaryCard({ label, value, hint, tone = 'default', className = '' }) {
    const styles = {
        default: ['border-gray-200 bg-surface', 'text-gray-500', 'text-gray-900'],
        owes: ['border-red-500/25 bg-red-500/10', 'text-red-700 dark:text-red-400', 'text-red-700 dark:text-red-400'],
        credit: ['border-emerald-500/25 bg-emerald-500/10', 'text-emerald-700 dark:text-emerald-400', 'text-emerald-700 dark:text-emerald-400'],
        settled: ['border-gray-200 bg-surface', 'text-gray-500', 'text-gray-500'],
    }[tone];

    return (
        <div className={`rounded-xl border p-4 ${styles[0]} ${className}`}>
            <p className={`text-sm ${styles[1]}`}>{label}</p>
            <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${styles[2]}`}>{value}</p>
            {hint && <p className={`mt-1 text-xs ${styles[1]}`}>{hint}</p>}
        </div>
    );
}
