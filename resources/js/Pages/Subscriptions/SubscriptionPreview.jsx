import FormPreview from '@/Components/Form/FormPreview';
import Icon from '@/Components/Icon';
import { formatAmount } from '@/lib/currency';
import { initials } from '@/lib/format';

export const STATUS_DOTS = {
    active: 'bg-emerald-500',
    suspended: 'bg-amber-500',
    disconnected: 'bg-gray-400',
};

/**
 * The dark card at the top of the form: the subscription as they're being
 * typed in (name, phone, status, subscription type and breaker), and how
 * many of the required fields are filled.
 */
export function SubscriptionPreview({ data, tariff, circuitBreaker, filled, total }) {
    const kilowattPrice = data.kilowatt_price !== '' ? data.kilowatt_price : tariff?.rate;
    const name = data.subscription_name.trim() || data.full_name.trim();
    const phone = String(data.subscription_phone || data.phone || '').trim();

    return (
        <FormPreview
            avatar={name ? initials(name) : <Icon name="user" className="h-6 w-6 text-white/70" />}
            dotClass={STATUS_DOTS[data.status]}
            title={name || 'مشترك جديد'}
            subtitle={phone || '05— ——— ——'}
            subtitleDir="ltr"
            chips={[tariff && `${tariff.categoryLabel} · ${formatAmount(kilowattPrice)} ش/ك.و`, circuitBreaker && `قاطع ${circuitBreaker.ampere} أمبير`].filter(Boolean)}
            filled={filled}
            total={total}
        />
    );
}
