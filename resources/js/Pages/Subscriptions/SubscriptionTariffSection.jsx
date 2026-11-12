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
    return (
        <FormSection icon="bolt" title="نوع الاشتراك والقاطع" info="سعر الكيلو والحد الأدنى يُحسبان تلقائيًا من اختيارك">
            <FormField id="accounting_type" label="نوع المحاسبة" error={errors.accounting_type} span="sm:col-span-2 lg:col-span-3">
                <ChoiceChips
                    label="نوع المحاسبة"
                    value={data.accounting_type}
                    onChange={(value) => setData('accounting_type', value)}
                    options={ACCOUNTING_TYPE_OPTIONS}
                />
            </FormField>

            <FormField id="tariff_id" label="نوع الاشتراك" required error={errors.tariff_id} span="sm:col-span-2">
                <SearchableSelect
                    name="tariff_id"
                    required
                    value={data.tariff_id}
                    onChange={onTariffChange}
                    options={tariffs.map((tariff) => ({
                        value: String(tariff.id),
                        label: tariff.categoryLabel,
                        hint: `${formatAmount(tariff.rate)} ش/ك.و`,
                    }))}
                    placeholder="اختر نوع الاشتراك"
                    searchPlaceholder="بحث في أنواع الاشتراك..."
                    emptyLabel="لا توجد أنواع مطابقة"
                    active={Boolean(data.tariff_id)}
                />
            </FormField>

            <div>
                <div className="flex items-center justify-between">
                    <InputLabel htmlFor="tariff_rate" value="سعر الكيلو" />
                    {canEditKilowattPrice && selectedTariff && !kilowattPriceUnlocked && (
                        <button
                            type="button"
                            onClick={() => setConfirmingKilowattPriceUnlock(true)}
                            className="text-xs font-semibold text-brand-600 hover:underline"
                        >
                            تعديل السعر
                        </button>
                    )}
                    {kilowattPriceUnlocked && (
                        <button type="button" onClick={lockKilowattPrice} className="text-xs font-semibold text-gray-500 hover:underline">
                            إلغاء التعديل
                        </button>
                    )}
                </div>
                <div className="mt-1">
                    <Affix unit="₪">
                        <TextInput
                            id="tariff_rate"
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
                            className={`block w-full ${kilowattPriceLocked ? 'bg-gray-50 text-gray-600' : ''}`}
                        />
                    </Affix>
                </div>
                {kilowattPriceUnlocked ? (
                    <p className="mt-1 text-xs text-gray-500">سعر التعرفة {formatAmount(tariffRate)} شيكل؛ يمكن أن يكون أقل منه أو أكثر.</p>
                ) : hasOwnKilowattPrice ? (
                    <p className="mt-1 text-xs font-semibold text-brand-600">سعر خاص بهذا المشترك — سعر التعرفة {formatAmount(tariffRate)} شيكل.</p>
                ) : kilowattPriceDropped ? (
                    <p className="mt-1 text-xs text-amber-600">أُلغي السعر الخاص بهذا المشترك لتغيير نوع الاشتراك.</p>
                ) : null}
                <InputError message={errors.kilowatt_price} className="mt-1" />
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

            <FormField id="circuit_breaker_id" label="القاطع" error={errors.circuit_breaker_id} span="sm:col-span-2">
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

            <div>
                <div className="flex items-center justify-between">
                    <InputLabel htmlFor="minimum_charge">
                        الحد الأدنى
                        <span className="text-red-500"> *</span>
                    </InputLabel>
                    {canEditMinimumCharge && !minimumChargeUnlocked && (
                        <button
                            type="button"
                            onClick={() => setConfirmingMinimumChargeUnlock(true)}
                            className="text-xs font-semibold text-brand-600 hover:underline"
                        >
                            تعديل يدوي
                        </button>
                    )}
                </div>
                <div className="mt-1">
                    <Affix unit="₪">
                        <TextInput
                            id="minimum_charge"
                            type="number"
                            step="0.01"
                            disabled={minimumChargeLocked}
                            className={`block w-full disabled:opacity-100 ${minimumChargeLocked ? 'bg-gray-50 text-gray-600' : ''}`}
                            value={data.minimum_charge}
                            onChange={(e) => setData('minimum_charge', e.target.value)}
                        />
                    </Affix>
                </div>
                <InputError message={errors.minimum_charge} className="mt-1" />
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
            {segments.length > 0 && (
                <FormField id="tariff_segment_id" label="تصنيف الزبائن" error={errors.tariff_segment_id} span="sm:col-span-2">
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
        </FormSection>
    );
}
