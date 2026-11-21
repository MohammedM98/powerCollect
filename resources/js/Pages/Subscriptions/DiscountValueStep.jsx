import InputError from '@/Components/UI/InputError';
import { formatMoney, normalizeDecimalInput } from '@/lib/format';
import { AmountBox, FieldWarning, FormStep, QuickPick } from './AccountFormParts';

/** The quick values under the amount, by kind and method; a one-off discount is in shekels only. */
const QUICK_VALUES = {
    once: { shekel: [10, 20, 50] },
    standing: { percentage: [5, 10, 20], kilowatt: [5, 10, 20], shekel: [0.5, 1] },
};

/** The discount's value: the amount or the method's figure, with quick picks and what it comes to. */
export default function DiscountValueStep({
    data,
    errors,
    example,
    exampleWithDiscount,
    field,
    invalid,
    isStanding,
    owed,
    setData,
    setValue,
    steps,
    value,
    valueInput,
    weeklySaving,
}) {
    return (
        <FormStep number={steps.value} title={field.label} hint={field.hint} done={value > 0 && !invalid}>
            <div>
                <AmountBox
                    id="value"
                    inputRef={valueInput}
                    value={data.value}
                    onChange={(e) => setData('value', normalizeDecimalInput(e.target.value))}
                    unit={field.unit}
                    label="قيمة الخصم"
                    autoFocus
                    error={Boolean(errors.value || invalid)}
                >
                    {QUICK_VALUES[data.kind][data.method].map((quick) => (
                        <QuickPick key={quick} onClick={() => setValue(quick)}>
                            {quick}
                            {field.suffix}
                        </QuickPick>
                    ))}
                    {!isStanding && owed > 0 && (
                        <QuickPick tone="green" onClick={() => setValue(owed)}>
                            كل ما عليه
                        </QuickPick>
                    )}
                    {isStanding && value > 0 && !invalid && (
                        <span className="ms-auto text-[13.5px] text-gray-500">
                            يوفّر <b className="font-display text-emerald-700 dark:text-emerald-400">{formatMoney(weeklySaving)} ₪</b> في الأسبوع
                        </span>
                    )}
                </AmountBox>
                <InputError message={errors.value ?? invalid} className="mt-2" />
                {isStanding && value > 0 && !invalid && exampleWithDiscount.amountDue < Number(example.minimumPayment) && (
                    <FieldWarning>
                        مع خصم القراءات الأسبوعية لا يُطبَّق الحد الأدنى للأسبوع ({formatMoney(example.minimumPayment)} ₪): يدفع المشترك ثمن الكيلوات
                        بعد الخصم فقط.
                    </FieldWarning>
                )}
            </div>
        </FormStep>
    );
}
