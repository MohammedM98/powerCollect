import ChoiceChips from '@/Components/UI/ChoiceChips';
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import { formatAmount } from '@/lib/currency';
import { formatMoney } from '@/lib/format';
import { Affix, ConfirmDialog, FieldAction, SearchableSelect, TextInput } from '@/Components/UI';

const ACCOUNTING_TYPE_OPTIONS = [
    { value: 'weekly', label: 'أسبوعي' },
    { value: 'monthly', label: 'شهري' },
];

/** The subscription's kind and breaker: tariff, accounting type, breaker, and the kilowatt price and minimum charge they set, each unlockable when allowed. */
export default function SubscriptionTariffSection({
    canEditKilowattPrice,
    canEditMinimumCharge,
    circuitBreakers,
    confirmingKilowattPriceUnlock,
    confirmingMinimumChargeUnlock,
    data,
    errors,
    hasOwnKilowattPrice,
    kilowattPriceDropped,
    kilowattPriceLocked,
    kilowattPriceUnlocked,
    lockKilowattPrice,
    minimumChargeLocked,
    minimumChargeUnlocked,
    onCircuitBreakerChange,
    onTariffChange,
    segments,
    selectedTariff,
    setConfirmingKilowattPriceUnlock,
    setConfirmingMinimumChargeUnlock,
    setData,
    tariffRate,
    tariffs,
    unlockKilowattPrice,
    unlockMinimumCharge,
}) {
    const kilowattPriceNote = kilowattPriceUnlocked
        ? `سعر التعرفة ${formatMoney(tariffRate)} شيكل؛ يمكن أن يكون أقل منه أو أكثر.`
        : hasOwnKilowattPrice
          ? `سعر خاص بهذا المشترك — سعر التعرفة ${formatMoney(tariffRate)} شيكل.`
          : kilowattPriceDropped
            ? 'أُلغي السعر الخاص بهذا المشترك لتغيير نوع الاشتراك.'
            : 'يتبع نوع الاشتراك المختار.';

    return (
        <FormSection icon="bolt" title="نوع الاشتراك والقاطع" description="المحاسبة والتعرفة والقاطع والحد الأدنى" info="سعر الكيلو والحد الأدنى يُحسبان تلقائيًا من اختيارك">
            <FormField id="accounting_type" label="نوع المحاسبة" error={errors.accounting_type}>
                <ChoiceChips
                    label="نوع المحاسبة"
                    value={data.accounting_type}
                    onChange={(value) => setData('accounting_type', value)}
                    options={ACCOUNTING_TYPE_OPTIONS}
                />
            </FormField>

            <FormField id="tariff_id" label="نوع الاشتراك" required error={errors.tariff_id}>
                <SearchableSelect
                    name="tariff_id"
                    required
                    value={data.tariff_id}
                    onChange={onTariffChange}
                    options={tariffs.map((tariff) => ({
                        value: String(tariff.id),
                        label: tariff.categoryLabel,
                        hint: `${formatMoney(tariff.rate)} ش/ك.و`,
                    }))}
                    placeholder="اختر نوع الاشتراك"
                    searchPlaceholder="بحث في أنواع الاشتراك..."
                    emptyLabel="لا توجد أنواع مطابقة"
                    active={Boolean(data.tariff_id)}
                />
            </FormField>

            <FormField
                id="tariff_rate"
                label="سعر الكيلو"
                error={errors.kilowatt_price}
                lock={kilowattPriceLocked ? 'locked' : 'open'}
                hint={kilowattPriceNote}
                action={
                    kilowattPriceUnlocked ? (
                        <FieldAction icon="lock" onClick={lockKilowattPrice}>إلغاء التعديل</FieldAction>
                    ) : canEditKilowattPrice && selectedTariff ? (
                        <FieldAction icon="pencil" onClick={() => setConfirmingKilowattPriceUnlock(true)}>تعديل السعر</FieldAction>
                    ) : null
                }
            >
                <Affix unit="₪">
                    <TextInput
                        type={kilowattPriceLocked ? 'text' : 'number'}
                        step="0.01"
                        min={kilowattPriceLocked ? undefined : 0}
                        required={!kilowattPriceLocked}
                        readOnly={kilowattPriceLocked}
                        title={kilowattPriceLocked ? 'للقراءة فقط' : undefined}
                        value={
                            kilowattPriceLocked
                                ? hasOwnKilowattPrice
                                    ? formatAmount(data.kilowatt_price)
                                    : selectedTariff
                                      ? formatAmount(selectedTariff.rate)
                                      : '—'
                                : data.kilowatt_price
                        }
                        onChange={(e) => setData('kilowatt_price', e.target.value)}
                        className="block w-full"
                    />
                </Affix>
            </FormField>

            <FormField id="circuit_breaker_id" label="القاطع" error={errors.circuit_breaker_id}>
                <SearchableSelect
                    value={data.circuit_breaker_id}
                    onChange={onCircuitBreakerChange}
                    options={circuitBreakers.map((circuitBreaker) => ({
                        value: String(circuitBreaker.id),
                        label: `${circuitBreaker.ampere} أمبير`,
                        hint: `الحد الأدنى ${formatMoney(circuitBreaker.minimum_payment)} ش`,
                    }))}
                    placeholder="بدون قاطع"
                    searchPlaceholder="بحث في القواطع..."
                    emptyLabel="لا توجد قواطع مطابقة"
                    active={Boolean(data.circuit_breaker_id)}
                />
            </FormField>

            <FormField
                id="minimum_charge"
                label="الحد الأدنى"
                required
                error={errors.minimum_charge}
                lock={minimumChargeLocked ? 'locked' : 'open'}
                hint={minimumChargeLocked ? 'يُؤخذ من القاطع المختار.' : 'تعديل يدوي بدل قيمة القاطع.'}
                action={canEditMinimumCharge && !minimumChargeUnlocked ? <FieldAction icon="pencil" onClick={() => setConfirmingMinimumChargeUnlock(true)}>تعديل يدوي</FieldAction> : null}
            >
                <Affix unit="₪">
                    <TextInput
                        type="number"
                        step="0.01"
                        disabled={minimumChargeLocked}
                        className="block w-full"
                        value={data.minimum_charge}
                        onChange={(e) => setData('minimum_charge', e.target.value)}
                    />
                </Affix>
            </FormField>

            {segments.length > 0 && (
                <FormField id="tariff_segment_id" label="تصنيف الزبائن" error={errors.tariff_segment_id}>
                    <SearchableSelect
                        value={data.tariff_segment_id}
                        onChange={(value) => setData('tariff_segment_id', value)}
                        options={segments.map((segment) => ({ value: String(segment.id), label: segment.name }))}
                        placeholder="بدون تصنيف"
                        searchPlaceholder="بحث في التصنيفات..."
                        emptyLabel="لا توجد تصنيفات مطابقة"
                        active={Boolean(data.tariff_segment_id)}
                    />
                </FormField>
            )}

            <ConfirmDialog
                show={confirmingKilowattPriceUnlock}
                onConfirm={unlockKilowattPrice}
                onCancel={() => setConfirmingKilowattPriceUnlock(false)}
                title="تعديل سعر الكيلو لهذا المشترك؟"
                message={`سيصبح لهذا المشترك سعر كيلو خاص به بدل سعر التعرفة (${selectedTariff ? formatMoney(selectedTariff.rate) : ''} شيكل)، ويُحسب به استهلاكه وخصوماته في القراءات القادمة. هل تريد المتابعة؟`}
                confirmLabel="نعم، عدّل"
                icon="alert"
            />
            <ConfirmDialog
                show={confirmingMinimumChargeUnlock}
                onConfirm={unlockMinimumCharge}
                onCancel={() => setConfirmingMinimumChargeUnlock(false)}
                title="تعديل الحد الأدنى يدويًا؟"
                message="أنت على وشك تعديل الحد الأدنى لهذا المشترك يدويًا بدل القيمة المأخوذة من القاطع. هل تريد المتابعة؟"
                confirmLabel="نعم، عدّل"
                icon="alert"
            />
        </FormSection>
    );
}
