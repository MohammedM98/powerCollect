import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import { Affix, ChoiceSelect, TextInput } from '@/Components/UI';

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
 * A tariff: its category, then its price per kilowatt, with an example of
 * what a subscriber pays at that price under it.
 */
export default function TariffForm({ data, setData, errors, categoryOptions }) {
    const rate = Number.parseFloat(data.rate);
    const example = Number.isFinite(rate) ? (rate * EXAMPLE_KILOWATTS).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;

    return (
        <FormSection icon="dollar" title="بيانات التعرفة" description="الفئة وسعر الكيلوواط فيها" columns={2}>
            <FormField id="category" label="الفئة" required error={errors.category}>
                <ChoiceSelect value={data.category} onChange={(e) => setData('category', e.target.value)}>
                    {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </ChoiceSelect>
            </FormField>

            <FormField
                id="rate"
                label="سعر الكيلوواط"
                required
                error={errors.rate}
                hint={example ? <>مثال: مشترك استهلك <bdi dir="ltr">{EXAMPLE_KILOWATTS}</bdi> كيلوواط يدفع <bdi dir="ltr">{example} ₪</bdi>.</> : 'بالشيكل، لكل وحدة مستهلكة.'}
            >
                <Affix unit="₪">
                    <TextInput type="number" step="0.01" inputMode="decimal" dir="ltr" placeholder="0.00" className="block w-full gl-num" value={data.rate} onChange={(e) => setData('rate', e.target.value)} />
                </Affix>
            </FormField>
        </FormSection>
    );
}
