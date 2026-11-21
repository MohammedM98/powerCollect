import BrandLogo from '@/Components/BrandLogo';
import FormPreview from '@/Components/Form/FormPreview';
import Icon from '@/Components/Icon';

import { initials, formatMoney } from '@/lib/format';

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
            chips={[tariff && `${tariff.categoryLabel}، ${formatMoney(kilowattPrice)} ش/ك.و`, circuitBreaker && `قاطع ${circuitBreaker.ampere} أمبير`].filter(Boolean)}
            filled={filled}
            total={total}
        />
    );
}

const STATUS_LABELS = { active: 'نشط', suspended: 'قيد الانتظار', disconnected: 'مفصول' };

/**
 * The subscriber's card in the form window's side panel (the redesign's
 * member card): the company's logo, the status, the name and phone as they
 * are being typed in, and the subscription type and breaker chosen.
 */
export function SubscriptionCard({ data, tariff, circuitBreaker }) {
    const kilowattPrice = data.kilowatt_price !== '' ? data.kilowatt_price : tariff?.rate;
    const name = data.subscription_name.trim() || data.full_name.trim();
    const phone = String(data.subscription_phone || data.phone || '').trim();
    const chips = [tariff && `${tariff.categoryLabel}، ${formatMoney(kilowattPrice)} ش/ك.و`, circuitBreaker && `قاطع ${circuitBreaker.ampere} أمبير`].filter(Boolean);

    return (
        <div className="gl-member" aria-live="polite">
            <div className="gl-member-top">
                <BrandLogo alt="" onDark className="h-8 w-auto max-w-[64px] object-contain" />
                <span className="gl-member-status" data-status={data.status}>{STATUS_LABELS[data.status] ?? ''}</span>
            </div>
            <b className="gl-member-name" dir="auto">{name || 'مشترك جديد'}</b>
            <span className="gl-member-phone gl-num" dir="ltr">{phone || '05— ——— ——'}</span>
            {chips.length > 0 && (
                <div className="gl-member-chips">
                    {chips.map((chip) => <span key={chip}>{chip}</span>)}
                </div>
            )}
        </div>
    );
}
