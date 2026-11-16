import FormPreview from '@/Components/Form/FormPreview';
import StatusPill from '@/Components/DataTable/StatusPill';
import Icon from '@/Components/Icon';
import { formatAmount } from '@/lib/currency';
import { initials } from '@/lib/format';

export const STATUS_DOTS = {
    active: 'bg-emerald-500',
    suspended: 'bg-amber-500',
    disconnected: 'bg-danger-500',
};

const STATUS_TONES = { active: 'green', suspended: 'amber', disconnected: 'red' };

export function SubscriptionPreview({ data, tariff, circuitBreaker, filled, total, side = false, meterBox, statusLabel }) {
    const kilowattPrice = data.kilowatt_price !== '' ? data.kilowatt_price : tariff?.rate;
    const name = data.subscription_name.trim() || data.full_name.trim();
    const phone = String(data.subscription_phone || data.phone || '').trim();
    const avatar = name ? initials(name) : <Icon name="user" className="h-6 w-6" />;

    if (side) {
        return (
            <aside aria-label="معاينة حيّة" className="gl-subscriber-preview hidden min-w-0 self-start p-5 min-[600px]:block min-[900px]:sticky min-[900px]:top-0">
                <span className="gl-subscriber-preview-tag">معاينة حيّة</span>
                <div className="mb-3 mt-3.5 grid justify-items-center gap-1 text-center">
                    <span className="gl-subscriber-preview-avatar mb-1.5 grid h-16 w-16 place-items-center text-[22px] font-extrabold" aria-hidden="true">{name ? avatar : '؟'}</span>
                    <strong className="w-full break-words text-lg font-extrabold leading-tight">{name || 'اسم المشترك'}</strong>
                    <small className="gl-sub">رقم الحساب يُولّد عند الحفظ</small>
                </div>
                <dl className="gl-subscriber-preview-details grid min-w-0">
                    <div><dt>الجوال</dt><dd dir="ltr">{phone || '—'}</dd></div>
                    <div><dt>الطبلون</dt><dd>{meterBox ? <StatusPill label={meterBox} tone="blue" /> : '—'}</dd></div>
                    <div><dt>الحالة</dt><dd>{statusLabel ? <StatusPill label={statusLabel} tone={STATUS_TONES[data.status]} /> : '—'}</dd></div>
                    <div><dt>سعر الكيلو</dt><dd dir="ltr">{kilowattPrice == null || kilowattPrice === '' ? '—' : '₪ ' + formatAmount(kilowattPrice)}</dd></div>
                </dl>
            </aside>
        );
    }

    return (
        <FormPreview
            avatar={avatar}
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
