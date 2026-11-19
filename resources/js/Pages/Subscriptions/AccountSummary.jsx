import { Chip } from '@heroui/react';
import Icon from '@/Components/Icon';
import { BALANCE_HINTS, BALANCE_TEXT_CLASSES } from '@/lib/balance';

/** A described balance (describeBalance()) as it reads everywhere: "50 ₪", "-9.10 ₪" or "0 ₪", coloured. */
export function BalanceText({ balance }) {
    return (
        <bdi dir="ltr" title={BALANCE_HINTS[balance.tone]} className={`inline-block whitespace-nowrap font-display font-bold tabular-nums ${BALANCE_TEXT_CLASSES[balance.tone]}`}>
            {balance.signed} ₪
        </bdi>
    );
}

/** The subscription's standing discount, taken off each weekly reading, beside their name. */
export function StandingDiscountBadge({ discount }) {
    return (
        <Chip size="sm" title={discount.notes ?? undefined} className="gl-st-chip" data-tone="discount">
            <Icon name="repeat" className="h-3.5 w-3.5" />
            <Chip.Label>
                خصم القراءات الأسبوعية: {discount.terms}
                {discount.segment && `، ${discount.segment}`}
            </Chip.Label>
        </Chip>
    );
}

/** What the balance will be once the form is saved. */
export function BalanceAfter({ label, balanceAfter, placeholder }) {
    return (
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
            {label}: {balanceAfter ? <BalanceText balance={balanceAfter} /> : <span className="text-gray-400">{placeholder}</span>}
        </p>
    );
}
