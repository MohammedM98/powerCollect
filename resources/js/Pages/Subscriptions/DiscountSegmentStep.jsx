import { Button, Input } from '@heroui/react';
import InputError from '@/Components/InputError';
import { FormStep } from './AccountFormParts';

/** The standing discount's customer segment: optional, from the company's list, or a new one typed in. */
export default function DiscountSegmentStep({ data, discountSegments, errors, setData, steps }) {
    return (
        <FormStep number={steps.segment} title="تصنيف الزبون" hint="اختياري: لمن هذا الخصم؟ يفيد في التقارير" done={Boolean(data.segment.trim())}>
            <div>
                <label htmlFor="discount_segment" className="sr-only">
                    تصنيف الزبون
                </label>
                <Input
                    id="discount_segment"
                    name="segment"
                    maxLength={100}
                    autoComplete="off"
                    placeholder="مثال: موظفو أبو زايد"
                    value={data.segment}
                    onChange={(e) => setData('segment', e.target.value)}
                    className={inputClass}
                />
                {discountSegments.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                        {discountSegments.map((segment) => (
                            <Button
                                key={segment}
                                aria-pressed={data.segment === segment}
                                onClick={() => setData('segment', data.segment === segment ? '' : segment)}
                                className={`rounded-full border px-3 py-1 text-[13.5px] font-semibold transition ${
                                    data.segment === segment
                                        ? 'border-gray-900 bg-gray-900 text-surface'
                                        : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200 hover:text-gray-900'
                                }`}
                            >
                                {segment}
                            </Button>
                        ))}
                    </div>
                )}
                <InputError message={errors.segment} className="mt-2" />
            </div>
        </FormStep>
    );
}

export const inputClass =
    'block h-[50px] w-full rounded-[14px] border-[1.5px] border-gray-200 bg-surface px-4 text-base text-gray-900 transition placeholder:text-gray-400 hover:border-brand-500/45 focus:border-brand-500 focus:outline-hidden focus:ring-4 focus:ring-brand-500/15';
