import Affix from '@/Components/Affix';
import ChoiceChips from '@/Components/ChoiceChips';
import ConfirmDialog from '@/Components/ConfirmDialog';
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import SearchableSelect from '@/Components/SearchableSelect';
import TextInput from '@/Components/TextInput';
import { formatAmount } from '@/lib/currency';

const ACCOUNTING_TYPE_OPTIONS = [
    { value: 'weekly', label: 'أسبوعي' },
    { value: 'monthly', label: 'شهري' },
];

/** The subscription's kind and breaker: tariff, accounting type, breaker, and the kilowatt price and minimum charge they set, each unlockable when allowed. */
export default function SubscriptionTariffSection({
    canEditKilowattPrice,
    canEditMinimumCharge,
    compact = false,
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
    statusField,
    tariffRate,
    tariffs,
    unlockKilowattPrice,
    unlockMinimumCharge,
}) {
    return (
        <FormSection icon="bolt" title="نوع الاشتراك والقاطع" info="سعر الكيلو والحد الأدنى يُحسبان تلقائيًا من اختيارك" columns={2} bare={compact}>
            {!compact && <SubscriptionAccountingField data={data} errors={errors} setData={setData} />}
            {!compact && <SubscriptionTariffField value={data.tariff_id} error={errors.tariff_id} onChange={onTariffChange} tariffs={tariffs} />}

            <div className="grid min-w-0 content-start gap-2">
                <div className="flex items-center justify-between gap-2">
                    <InputLabel htmlFor="tariff_rate" value={compact ? "سعر الكيلو (₪)" : "سعر الكيلو"} />
                    {canEditKilowattPrice && selectedTariff && !kilowattPriceUnlocked && (
                        <button
                            type="button"
                            onClick={() => setConfirmingKilowattPriceUnlock(true)}
                            className="text-[13px] font-semibold text-brand-600 hover:underline"
                        >
                            تعديل السعر
                        </button>
                    )}
                    {kilowattPriceUnlocked && (
                        <button type="button" onClick={lockKilowattPrice} className="text-[13.5px] font-semibold text-gray-700 hover:underline">
                            إلغاء التعديل
                        </button>
                    )}
                </div>
                <div>
                    <Affix unit="₪">
                        <TextInput
                            id="tariff_rate"
                            name="kilowatt_price"
                            type={kilowattPriceLocked ? 'text' : 'number'}
                            step="0.01"
                            min={kilowattPriceLocked ? undefined : 0}
                            required={!kilowattPriceLocked}
                            readOnly={kilowattPriceLocked}
                            title={kilowattPriceLocked ? 'للقراءة فقط' : undefined}
                            aria-invalid={Boolean(errors.kilowatt_price)}
                            aria-describedby={errors.kilowatt_price ? 'kilowatt_price-error' : undefined}
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
                            className={`block w-full ${kilowattPriceLocked ? 'bg-gray-50 text-gray-600' : ''}`}
                        />
                    </Affix>
                </div>
                {kilowattPriceUnlocked ? (
                    <p className="m-0 text-[13px] text-gray-500">سعر التعرفة {formatAmount(tariffRate)} شيكل؛ يمكن أن يكون أقل منه أو أكثر.</p>
                ) : hasOwnKilowattPrice ? (
                    <p className="m-0 text-[13px] font-semibold text-brand-600">سعر خاص بهذا المشترك — سعر التعرفة {formatAmount(tariffRate)} شيكل.</p>
                ) : kilowattPriceDropped ? (
                    <p className="m-0 text-[13px] text-amber-600">أُلغي السعر الخاص بهذا المشترك لتغيير نوع الاشتراك.</p>
                ) : null}
                <InputError id="kilowatt_price-error" message={errors.kilowatt_price} />
                <ConfirmDialog
                    show={confirmingKilowattPriceUnlock}
                    onConfirm={unlockKilowattPrice}
                    onCancel={() => setConfirmingKilowattPriceUnlock(false)}
                    title="تعديل سعر الكيلو لهذا المشترك؟"
                    message={`سيصبح لهذا المشترك سعر كيلو خاص به بدل سعر التعرفة (${selectedTariff ? formatAmount(selectedTariff.rate) : ''} شيكل)، ويُحسب به استهلاكه وخصوماته في القراءات القادمة. هل تريد المتابعة؟`}
                    confirmLabel="نعم، عدّل"
                    icon="alert"
                />
            </div>

            <div className="grid min-w-0 content-start gap-2">
                <div className="flex items-center justify-between gap-2">
                    <InputLabel htmlFor="minimum_charge">
                        {compact && data.accounting_type === "weekly" ? "الحد الأدنى الأسبوعي (₪)" : "الحد الأدنى"}
                        <span className="text-red-500"> *</span>
                    </InputLabel>
                    {canEditMinimumCharge && !minimumChargeUnlocked && (
                        <button
                            type="button"
                            onClick={() => setConfirmingMinimumChargeUnlock(true)}
                            className="text-[13px] font-semibold text-brand-600 hover:underline"
                        >
                            تعديل يدوي
                        </button>
                    )}
                </div>
                <div>
                    <Affix unit="₪">
                        <TextInput
                            id="minimum_charge"
                            type="number"
                            step="0.01"
                            disabled={minimumChargeLocked}
                            required={!minimumChargeLocked}
                            min={0}
                            max={10000}
                            aria-invalid={Boolean(errors.minimum_charge)}
                            aria-describedby={errors.minimum_charge ? 'minimum_charge-error' : undefined}
                            className={`block w-full disabled:opacity-100 ${minimumChargeLocked ? 'bg-gray-50 text-gray-600' : ''}`}
                            value={data.minimum_charge}
                            onChange={(e) => setData('minimum_charge', e.target.value)}
                        />
                    </Affix>
                </div>
                <InputError id="minimum_charge-error" message={errors.minimum_charge} />
                <ConfirmDialog
                    show={confirmingMinimumChargeUnlock}
                    onConfirm={unlockMinimumCharge}
                    onCancel={() => setConfirmingMinimumChargeUnlock(false)}
                    title="تعديل الحد الأدنى يدويًا؟"
                    message="أنت على وشك تعديل الحد الأدنى لهذا المشترك يدويًا بدل القيمة المأخوذة من القاطع. هل تريد المتابعة؟"
                    confirmLabel="نعم، عدّل"
                    icon="alert"
                />
            </div>
            <FormField id="circuit_breaker_id" label="القاطع" error={errors.circuit_breaker_id}>
                <SearchableSelect
                    value={data.circuit_breaker_id}
                    onChange={onCircuitBreakerChange}
                    options={circuitBreakers.map((circuitBreaker) => ({
                        value: String(circuitBreaker.id),
                        label: `${circuitBreaker.ampere} أمبير`,
                        hint: `الحد الأدنى ${formatAmount(circuitBreaker.minimum_payment)} ش`,
                    }))}
                    placeholder="بدون قاطع"
                    searchPlaceholder="بحث في القواطع..."
                    emptyLabel="لا توجد قواطع مطابقة"
                    active={Boolean(data.circuit_breaker_id)}
                />
            </FormField>

            {compact && statusField}

            {!compact && <SubscriptionSegmentField data={data} errors={errors} segments={segments} setData={setData} />}
        </FormSection>
    );
}

export function SubscriptionTariffField({ value, error, onChange, tariffs, span }) {
    return (
        <FormField id="tariff_id" label="نوع الاشتراك" required error={error} span={span}>
            <SearchableSelect
                name="tariff_id"
                required
                value={value}
                onChange={onChange}
                options={tariffs.map((tariff) => ({
                    value: String(tariff.id),
                    label: tariff.categoryLabel,
                    hint: `${formatAmount(tariff.rate)} ش/ك.و`,
                }))}
                placeholder="اختر نوع الاشتراك"
                searchPlaceholder="بحث في أنواع الاشتراك..."
                emptyLabel="لا توجد أنواع مطابقة"
                active={Boolean(value)}
            />
        </FormField>
    );
}

export function SubscriptionAccountingField({ data, errors, setData }) {
    return (
        <FormField id="accounting_type" label="نوع المحاسبة" error={errors.accounting_type} span="sm:col-span-2">
            <ChoiceChips
                label="نوع المحاسبة"
                value={data.accounting_type}
                onChange={(value) => setData('accounting_type', value)}
                options={ACCOUNTING_TYPE_OPTIONS}
            />
        </FormField>
    );
}

export function SubscriptionSegmentField({ data, errors, segments, setData }) {
    return segments.length > 0 && (
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
    );
}
