import type { Amount } from './types.ts';

interface ChargeDraft {
    type: string;
    amount: string;
}

interface ChargeSubscription {
    minimumPayment?: Amount;
    subscriptionFee?: Amount;
}

interface ChargeType {
    value: string;
    usualAmount?: Amount;
}

/** Selecting minimum charge fills the configured amount; other charges retain typed amounts. */
export function amountForChargeType(current: ChargeDraft, type: string, subscription: ChargeSubscription, chargeTypes: ChargeType[]): string {
    if (type === 'minimum_charge') {
        return String(subscription.minimumPayment ?? '0');
    }

    const amount = current.type === 'minimum_charge' ? '' : current.amount;
    const usual = type === 'subscription_fee' ? subscription.subscriptionFee : chargeTypes.find((option) => option.value === type)?.usualAmount;

    return amount === '' && usual ? String(usual) : amount;
}
