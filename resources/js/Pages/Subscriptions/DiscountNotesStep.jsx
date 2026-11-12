import InputError from '@/Components/InputError';
import { FormStep } from './AccountFormParts';
import { inputClass } from './DiscountSegmentStep';

/** The discount's notes, optional, kept on the statement line. */
export default function DiscountNotesStep({ data, errors, setData, steps }) {
    return (
        <FormStep number={steps.notes} title="ملاحظات" hint="اختياري" done={Boolean(data.notes.trim())}>
            <div>
                <label htmlFor="discount_notes" className="sr-only">
                    ملاحظات
                </label>
                <textarea
                    id="discount_notes"
                    name="notes"
                    rows={2}
                    maxLength={1000}
                    placeholder="مثال: خصم بموافقة المدير"
                    value={data.notes}
                    onChange={(e) => setData('notes', e.target.value)}
                    className={`${inputClass} h-auto min-h-[76px] resize-y py-3 leading-relaxed`}
                />
                <InputError message={errors.notes} className="mt-2" />
            </div>
        </FormStep>
    );
}
