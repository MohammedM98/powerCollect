import { Button, Card, Chip } from '@heroui/react';
import Balance from '@/Components/Finance/Balance';
import Icon from '@/Components/UI/Icon';

const STATUS_TONES = {
    active: 'success',
    suspended: 'warning',
    disconnected: 'default',
};

/** Where a subscription is: its tariff, its meter box (name, then number) and its area, or that each is not set. */
function SubscriptionPlace({ subscription }) {
    const area = [...new Set([subscription.areaName, subscription.subAreaName].filter(Boolean))].join(' / ');

    return (
        <span className="gl-sub-card-place">
            <span>{subscription.tariffCategoryLabel || 'تصنيف غير محدد'}</span>
            <span>
                {subscription.meterBoxName || subscription.meterBoxNumber ? (
                    <>
                        {subscription.meterBoxName && <span>{subscription.meterBoxName}</span>}
                        {subscription.meterBoxNumber && <bdi dir="ltr" className="gl-num">{subscription.meterBoxName ? `(${subscription.meterBoxNumber})` : subscription.meterBoxNumber}</bdi>}
                    </>
                ) : (
                    'طبلون غير محدد'
                )}
            </span>
            <span>{area || 'منطقة غير محددة'}</span>
        </span>
    );
}

/**
 * Every subscription of the same person, on a HeroUI card above their
 * statement as in the redesign: one tile each with its number, status,
 * where it is and its balance, the one shown marked in the company's
 * colour, and what they owe across all of them. Picking another one shows
 * that subscription's records. Hidden when the person has only one.
 */
export default function SubscriptionSwitcher({ subscriberNumber, subscriptions, currentId, onSelect }) {
    if (!subscriptions || subscriptions.length < 2) {
        return null;
    }

    const total = subscriptions.reduce((sum, subscription) => sum + Math.round(Number(subscription.balance) * 100), 0) / 100;

    return (
        <Card className="gl-subs" aria-label="اشتراكات المشترك" role="region">
            <div className="gl-subs-head">
                <div className="min-w-0">
                    <h3>
                        اشتراكات المشترك
                        <Chip size="sm" className="gl-st-chip">{subscriptions.length} اشتراكات</Chip>
                    </h3>
                    <p>
                        {subscriberNumber && (
                            <>
                                المشترك رقم <bdi dir="ltr" className="gl-num">{subscriberNumber}</bdi>.{' '}
                            </>
                        )}
                        اضغط على بطاقة الاشتراك لعرض كشفه.
                    </p>
                </div>
                <div className="gl-subs-total">
                    <small>الرصيد الإجمالي للاشتراكات</small>
                    <b><Balance value={total} word /></b>
                </div>
            </div>
            <div className="gl-sub-cards">
                {subscriptions.map((subscription) => {
                    const current = subscription.id === currentId;

                    return (
                        <Button data-raw="" variant="ghost"
                            key={subscription.id}
                            aria-current={current ? 'true' : undefined}
                            aria-label={`عرض كشف الاشتراك ${subscription.accountNumber}`}
                            isDisabled={current}
                            onClick={() => onSelect(subscription)}
                            className="gl-sub-card"
                        >
                            <span className="gl-sub-card-top">
                                <bdi dir="ltr" className="gl-sub-card-no">{subscription.accountNumber}</bdi>
                                {current ? (
                                    <Chip size="sm" className="gl-st-chip">
                                        <Icon name="check" className="h-3.5 w-3.5" />
                                        المعروض الآن
                                    </Chip>
                                ) : (
                                    subscription.statusLabel && (
                                        <Chip size="sm" variant="soft" color={STATUS_TONES[subscription.status] ?? 'default'}>
                                            {subscription.statusLabel}
                                        </Chip>
                                    )
                                )}
                                <span className="gl-sub-card-balance"><Balance value={subscription.balance} word /></span>
                            </span>
                            {subscription.fullName && <strong className="gl-sub-card-name">{subscription.fullName}</strong>}
                            <span className="gl-sub-card-foot">
                                <SubscriptionPlace subscription={subscription} />
                                {!current && (
                                    <span className="gl-sub-card-go">
                                        عرض كشفه
                                        <Icon name="arrow-left" className="h-4 w-4" />
                                    </span>
                                )}
                            </span>
                        </Button>
                    );
                })}
            </div>
        </Card>
    );
}
