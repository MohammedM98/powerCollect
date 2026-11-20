import { ToggleButton } from '@heroui/react';
import SegmentedChoice from '@/Components/SegmentedChoice';
import { Figure } from '@/Pages/Reports/ReportViews';
import { formatMoney, formatNumber } from '@/lib/format';

/** The balance filter that lists only those who owe: their balance above zero on the company's side. */
export const DEBTORS_FILTER = { balance_side: 'debit', balance_operator: 'gt', balance_amount: '0', balance_to: '' };

export const isDebtorsFilter = (values) => values.balance_side === 'debit' && values.balance_operator === 'gt' && Number(values.balance_amount) === 0 && !values.balance_to;

/**
 * The subscriptions list's figures, from the server: how many, what the
 * debtors owe, what the company holds for those in credit, and how many
 * have no phone (so messages miss them).
 */
export function SubscriptionFigures({ summary }) {
    return (
        <div className="gl-rp-figs gl-sub-figs">
            <Figure dark label="المشتركون" hint={`${formatNumber(summary.byStatus.active ?? 0)} نشط`}>{formatNumber(summary.total)}</Figure>
            <Figure tone="owe" label="المستحق عليهم" hint={`${formatNumber(summary.debtors)} مشترك مدين`}><bdi dir="ltr">{formatMoney(summary.owed)}</bdi> <span className="gl-rp-unit">₪</span></Figure>
            <Figure tone="pay" label="لصالح المشتركين" hint={`${formatNumber(summary.creditors)} مشترك`}><bdi dir="ltr">{formatMoney(summary.credit)}</bdi> <span className="gl-rp-unit">₪</span></Figure>
            <Figure tone={summary.withoutPhone > 0 ? 'warn' : null} label="بلا رقم جوال" hint="لا تصلهم الرسائل">{formatNumber(summary.withoutPhone)}</Figure>
        </div>
    );
}

/**
 * Quick filters above the table, each with its count: the status (all,
 * active, waiting, disconnected) and the debtors alone.
 */
export function SubscriptionQuickFilters({ summary, statusOptions, values, onStatus, onDebtors }) {
    const options = [
        { value: '', label: <>الكل <span className="gl-sub-count">{formatNumber(summary.total)}</span></> },
        ...statusOptions.map((option) => ({ value: option.value, label: <>{option.label} <span className="gl-sub-count">{formatNumber(summary.byStatus[option.value] ?? 0)}</span></> })),
    ];
    const debtorsOnly = isDebtorsFilter(values);

    return (
        <div className="gl-sub-quick">
            <SegmentedChoice label="حالة الاشتراك" value={values.status ?? ''} onChange={onStatus} options={options} />
            <ToggleButton className="gl-sub-debtors" isSelected={debtorsOnly} onChange={onDebtors} aria-label="المدينون فقط">
                المدينون <span className="gl-sub-count">{formatNumber(summary.debtors)}</span>
            </ToggleButton>
        </div>
    );
}
