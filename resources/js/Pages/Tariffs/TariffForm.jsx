import InsetList, { InsetRow } from '@/Components/Form/InsetList';
import { ChoiceSelect, TextInput } from '@/Components/UI';

/**
 * The form's starting values: the tariff's own when editing, otherwise
 * blank with the first category preselected.
 */
export function tariffFormData(tariff, categoryOptions) {
    return tariff ? { category: tariff.category, rate: tariff.rate } : { category: categoryOptions[0]?.value ?? '', rate: '' };
}

/** What a subscriber who used this many kilowatts pays at the rate being typed, for the line under the price. */
const EXAMPLE_KILOWATTS = 120;

/**
 * A tariff as a grouped list: its category, then its price per kilowatt,
 * with an example of what a subscriber pays at that price under it.
 */
export default function TariffForm({ data, setData, errors, categoryOptions }) {
    const rate = Number.parseFloat(data.rate);
    const example = Number.isFinite(rate) ? (rate * EXAMPLE_KILOWATTS).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;

    return (
        <div className="space-y-5">
            <InsetList>
                <InsetRow label="الفئة" htmlFor="category" required error={errors.category}>
                    <ChoiceSelect id="category" className="block w-full" value={data.category} onChange={(e) => setData('category', e.target.value)}>
                        {categoryOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </ChoiceSelect>
                </InsetRow>
            </InsetList>

            <InsetList caption={example && <>مثال: مشترك استهلك <b className="gl-num">{EXAMPLE_KILOWATTS}</b> كيلوواط يدفع <b className="gl-num" dir="ltr">{example} ₪</b>.</>}>
                <InsetRow label="سعر الكيلوواط" htmlFor="rate" hint="بالشيكل، لكل وحدة مستهلكة" required error={errors.rate}>
                    <div className="flex w-full items-center gap-2">
                        <TextInput id="rate" type="number" step="0.01" inputMode="decimal" dir="ltr" placeholder="0.00" className="block w-full gl-num" value={data.rate} onChange={(e) => setData('rate', e.target.value)} />
                        <span className="text-(--gl-faint)">₪</span>
                    </div>
                </InsetRow>
            </InsetList>
        </div>
    );
}
