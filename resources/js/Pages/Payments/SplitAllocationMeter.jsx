import { Button } from '@heroui/react';
import Icon from '@/Components/Icon';
import { formatMoney } from '@/lib/format';
import { fromCents } from '@/lib/currency';

/** How much of the transfer is spread over the subscribers, what is left or over, and confirming an overpayment. */
export default function SplitAllocationMeter({ allocatedCents, distributed, meterTone, parts, putRemainderOnLast, remainingCents, totalCents }) {
    return (
        <div className={`rounded-xl border px-4 py-3 text-sm ${meterTone}`} role="status">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold">
                    <Icon name={distributed ? 'check' : 'alert'} className="h-[18px] w-[18px] shrink-0" />
                    {distributed
                        ? 'وُزّع المبلغ كاملًا'
                        : totalCents === 0
                          ? 'أدخل المبلغ المحوَّل ثم وزّعه على المشتركين'
                          : parts.length < 2
                            ? 'أضف مشتركَين على الأقل'
                            : remainingCents > 0
                              ? `بقي ${formatMoney(fromCents(remainingCents))} ₪ لم يُوزَّع`
                              : remainingCents < 0
                                ? `الموزَّع يزيد ${formatMoney(fromCents(-remainingCents))} ₪ على المحوَّل`
                                : 'أدخل مبلغ كل مشترك'}
                </p>
                <div className="flex items-center gap-3">
                    {parts.length > 0 && remainingCents > 0 && (
                        <Button data-raw="" variant="ghost" onClick={putRemainderOnLast} className="text-[13.5px] font-semibold text-brand-600 hover:underline">
                            ضع الباقي على آخر مشترك
                        </Button>
                    )}
                    <span className="font-display font-bold text-gray-900">
                        {formatMoney(fromCents(allocatedCents))} <span className="font-sans text-[13px] font-medium text-gray-500">من</span>{' '}
                        {formatMoney(fromCents(totalCents))} ₪
                    </span>
                </div>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                    className={`h-full rounded-full transition-all ${distributed ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${totalCents > 0 ? Math.min(100, (allocatedCents / totalCents) * 100) : 0}%` }}
                />
            </div>
        </div>
    );
}
