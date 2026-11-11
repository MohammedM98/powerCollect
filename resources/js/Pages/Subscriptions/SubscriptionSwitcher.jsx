import StatusPill from '@/Components/DataTable/StatusPill';
import Balance from '@/Components/Balance';
import Icon from '@/Components/Icon';

const NUMBER = 'font-display tabular-nums';
const FACT = 'flex flex-col items-start gap-[7px]';
const FACT_LABEL = 'flex items-center gap-1.5 text-[13px] text-gray-500';
const FACT_ICON = 'h-[15px] w-[15px] flex-none';
const factValue = (empty) => `max-w-full text-right leading-normal [overflow-wrap:anywhere] ${empty ? 'text-[14px] font-normal text-gray-500' : 'text-[15px] font-semibold text-gray-900'}`;

const STATUS_TONES = {
    active: 'green',
    suspended: 'amber',
    disconnected: 'gray',
};

/**
 * Every subscription of the same person above their statement, each with
 * its balance, plus what they owe across all of them. Picking another one
 * shows that subscription's records. Hidden when the person has only one.
 */
export default function SubscriptionSwitcher({ subscriberNumber, subscriptions, currentId, onSelect }) {
    if (!subscriptions || subscriptions.length < 2) {
        return null;
    }

    const total = subscriptions.reduce((sum, subscription) => sum + Math.round(Number(subscription.balance) * 100), 0) / 100;

    return (
        <section className={`mb-5 border border-gray-100 bg-surface p-6 text-gray-900 rounded-[calc(28px*var(--radius-scale,1))] max-[740px]:rounded-[calc(24px*var(--radius-scale,1))] max-[740px]:p-[18px]`} aria-label="اشتراكات المشترك">
            <div className="flex items-center justify-between gap-5 max-[740px]:flex-col max-[740px]:items-stretch max-[740px]:gap-[18px]">
                <div className="flex items-center gap-[13px]">
                    <span className={`grid h-11 w-11 flex-none place-items-center bg-graphite-gradient text-white rounded-[calc(14px*var(--radius-scale,1))]`}><Icon name="users" className="h-5 w-5 flex-none" /></span>
                    <div>
                        <h4 className="flex flex-wrap items-center gap-3 text-[20px] font-bold max-[740px]:gap-2 max-[740px]:text-[18px]">
                            اشتراكات المشترك <span className={`border border-gray-100 bg-gray-50 px-2.5 py-0.5 text-[13px] font-semibold text-gray-600 max-[740px]:text-[12px] rounded-[calc(99px*var(--radius-scale,1))]`}>{subscriptions.length} اشتراكات</span>
                        </h4>
                        {subscriberNumber && <p className="mt-[3px] text-[14px] text-gray-500">المشترك رقم <bdi dir="ltr" className={`ms-1 font-semibold text-gray-700 ${NUMBER}`}>{subscriberNumber}</bdi></p>}
                    </div>
                </div>
                <div className={`min-w-[242px] border border-gray-100 bg-gray-50/70 px-[17px] py-[11px] max-[740px]:flex max-[740px]:min-w-0 max-[740px]:items-center max-[740px]:justify-between max-[740px]:gap-2.5 rounded-[calc(16px*var(--radius-scale,1))]`}>
                    <span className="mb-[3px] block text-[13px] text-gray-500 max-[740px]:max-w-[100px]">الرصيد الإجمالي للاشتراكات</span>
                    <div className="flex items-baseline gap-1"><Balance value={total} word className="text-[23px] font-bold max-[740px]:text-[20px]" /></div>
                </div>
            </div>
            <p className="mb-3 mt-[21px] flex items-center gap-[7px] text-[14px] text-gray-500 max-[740px]:mt-[18px] max-[740px]:text-[13px]"><Icon name="enter" className="h-4 w-4 flex-none" /><span>اضغط على بطاقة الاشتراك لعرض كشفه.</span></p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4 max-[740px]:grid-cols-1 max-[740px]:gap-[13px]">
                {subscriptions.map((subscription) => {
                    const current = subscription.id === currentId;
                    const area = [...new Set([subscription.areaName, subscription.subAreaName].filter(Boolean))].join(' / ');

                    return (
                        <button
                            key={subscription.id}
                            type="button"
                            aria-current={current ? 'true' : undefined}
                            aria-label={`عرض كشف الاشتراك ${subscription.accountNumber}`}
                            disabled={current}
                            onClick={() => onSelect(subscription)}
                            className={`relative flex min-w-0 cursor-pointer flex-col overflow-hidden border border-gray-200 bg-surface px-5 pb-0 pt-[21px] text-start text-gray-900 transition-[border-color,box-shadow] duration-150 ease-[ease] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-900 disabled:cursor-default motion-reduce:transition-none max-[1050px]:px-4 [&:hover:not(:disabled)]:border-gray-400 [&:hover:not(:disabled)]:shadow-[0_12px_26px_-22px_rgb(var(--shadow-ink)/0.4)] aria-[current=true]:border-brand-500 aria-[current=true]:bg-[linear-gradient(180deg,rgb(var(--brand-500)/.035),rgb(var(--surface))_57%)] aria-[current=true]:shadow-[0_0_0_1px_rgb(var(--brand-500)/.08)] aria-[current=true]:before:absolute aria-[current=true]:before:inset-x-0 aria-[current=true]:before:top-0 aria-[current=true]:before:h-[3px] aria-[current=true]:before:bg-brand-500 aria-[current=true]:before:content-[''] rounded-[calc(20px*var(--radius-scale,1))]`}
                        >
                            <span className="flex items-start justify-between gap-3">
                                <span className="flex flex-col items-start gap-1">
                                    <span className="text-[13px] text-gray-500">رقم الاشتراك</span>
                                    <bdi dir="ltr" className={`text-[17px] font-bold leading-[1.6] ${NUMBER}`}>{subscription.accountNumber}</bdi>
                                </span>
                                <StatusPill tone={STATUS_TONES[subscription.status]} label={subscription.statusLabel} />
                            </span>
                            <strong className="mt-[17px] block min-h-[58px] text-[17px] font-semibold leading-[1.7] [overflow-wrap:anywhere] max-[1050px]:min-h-[62px] max-[740px]:mt-[13px] max-[740px]:min-h-0">{subscription.fullName}</strong>
                            <span className="mt-3 grid grid-cols-2 gap-3 pb-[18px] max-[740px]:mt-[17px]">
                                <span className={FACT}>
                                    <span className={FACT_LABEL}><Icon name="grid" className={FACT_ICON} />الطبلون</span>
                                    {subscription.meterBoxName || subscription.meterBoxNumber ? (
                                        <span className={`flex flex-wrap items-baseline gap-x-[7px] gap-y-1 ${factValue(false)}`}>
                                            {subscription.meterBoxName && <span>{subscription.meterBoxName}</span>}
                                            {subscription.meterBoxNumber && <bdi dir="ltr" className={NUMBER}>{subscription.meterBoxName ? `(${subscription.meterBoxNumber})` : subscription.meterBoxNumber}</bdi>}
                                        </span>
                                    ) : <span className={factValue(true)}>غير محدد</span>}
                                </span>
                                <span className={FACT}>
                                    <span className={FACT_LABEL}><Icon name="building" className={FACT_ICON} />التصنيف</span>
                                    <strong className={factValue(false)}>{subscription.tariffCategoryLabel || 'غير محدد'}</strong>
                                </span>
                                <span className={`col-span-full ${FACT}`}>
                                    <span className={FACT_LABEL}><Icon name="pin" className={FACT_ICON} />المنطقة</span>
                                    <strong className={factValue(!area)}>{area || 'غير محددة'}</strong>
                                </span>
                            </span>
                            <span className="mt-auto flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5 border-t border-gray-100 py-4 max-[1050px]:flex-col max-[1050px]:items-start max-[1050px]:gap-2 max-[740px]:flex-row max-[740px]:items-center">
                                <span className="text-[14px] text-gray-500">الرصيد الحالي</span>
                                <span className="flex items-baseline gap-0.5 [&>span:last-child]:text-[13px] [&>span:last-child]:text-gray-600"><Balance value={subscription.balance} word className="text-[21px] font-bold" /></span>
                            </span>
                            <span className={`flex items-center justify-center gap-2 border-t border-gray-100 px-[5px] py-[13px] text-[14px] font-semibold ${current ? 'text-brand-600' : 'text-gray-600'}`}>
                                {current ? <><Icon name="check" className="h-4 w-4 flex-none" />المعروض الآن</> : <>عرض كشف هذا الاشتراك<Icon name="arrow-left" className="h-4 w-4 flex-none" /></>}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
