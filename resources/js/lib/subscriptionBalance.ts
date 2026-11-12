import type { Option } from './types.ts';

export type BalanceSide = 'debit' | 'credit';
export type BalanceOperator = 'gt' | 'lt' | 'eq' | 'between';

/** The subscriptions list's filters, as the URL carries them. */
export type SubscriptionFilters = Record<string, string | number | null | undefined>;

export const BALANCE_FILTER_KEYS = ['balance_side', 'balance_operator', 'balance_amount', 'balance_to'];
export const BALANCE_SIDES: Option<BalanceSide>[] = [{ value: 'debit', label: 'عليه للشركة' }, { value: 'credit', label: 'له عند الشركة' }];
export const BALANCE_OPERATORS: Option<BalanceOperator>[] = [{ value: 'gt', label: 'أكثر من' }, { value: 'lt', label: 'أقل من' }, { value: 'eq', label: 'يساوي' }, { value: 'between', label: 'بين مبلغين' }];

/** Empty URL values may return as null; neither changes the matched subscriptions. */
export function subscriptionFilterKey(filters: SubscriptionFilters = {}): string {
    return JSON.stringify(Object.entries(filters).filter(([, value]) => value !== '' && value != null).map(([key, value]) => [key, String(value)]).sort(([a], [b]) => a.localeCompare(b)));
}

export function balanceFilterLabel(filters: SubscriptionFilters = {}): string {
    const side = BALANCE_SIDES.find((option) => option.value === filters.balance_side);
    const operator = BALANCE_OPERATORS.find((option) => option.value === filters.balance_operator);
    if (!side || !operator || filters.balance_amount === '' || filters.balance_amount == null) {
        return '';
    }
    return filters.balance_operator === 'between'
        ? `${side.label} بين ${filters.balance_amount} و${filters.balance_to} شيكل`
        : `${side.label} ${operator.label} ${filters.balance_amount} شيكل`;
}
