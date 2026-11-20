
import { formatMoney } from '@/lib/format';
import { MovementCard } from './AccountFormParts';
import { standingTerms } from '@/lib/discountTerms';

/** Roughly how many weeks a month has, for the monthly saving. */
const WEEKS_PER_MONTH = 4.3;

/** What a standing discount does to a usual week's bill, and the saving it gives each week and month. */
export default function StandingDiscountCard({ data, example, exampleBill, exampleWithDiscount, invalid, subscription, tone, value, weeklySaving }) {
    return (
        <MovementCard
            subscription={subscription}
            tone={tone}
            tag="كل أسبوع"
            ops={['−', '=']}
            cells={[
                {
                    label: 'فاتورة الأسبوع المعتادة',
                    value: `${formatMoney(exampleBill.amountDue)} ₪`,
                    note: `${formatMoney(example.kilos)} كيلو × ${formatMoney(example.unitPrice)} ₪`,
                },
                {
                    label: 'الخصم',
                    value: value > 0 && !invalid ? standingTerms(data.method, data.value) : '—',
                    note: data.segment.trim(),
                    move: true,
                },
                {
                    label: example.label,
                    value: `${formatMoney(exampleWithDiscount.amountDue)} ₪`,
                    note: 'يبدأ من القراءة القادمة',
                    color: 'var(--gl-ok)',
                    result: true,
                },
            ]}
        >
            <div className="gl-kv">
                <span>
                    توفير في الأسبوع{' '}
                    <b className="gl-num text-(--gl-ok)!">
                        {formatMoney(weeklySaving)} ₪
                    </b>
                </span>
                <span>
                    في الشهر تقريبًا{' '}
                    <b className="gl-num text-(--gl-ok)!">
                        {formatMoney(weeklySaving * WEEKS_PER_MONTH)} ₪
                    </b>
                </span>
            </div>
        </MovementCard>
    );
}
