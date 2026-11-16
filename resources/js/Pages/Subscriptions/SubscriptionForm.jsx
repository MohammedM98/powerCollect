import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHttp } from '@inertiajs/react';
import Affix from '@/Components/Affix';
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import SettingRow from '@/Components/Form/SettingRow';
import InputError from '@/Components/InputError';
import Switch from '@/Components/Switch';
import TextInput from '@/Components/TextInput';
import DateInput from '@/Components/DateInput';
import SubscriptionTariffSection from './SubscriptionTariffSection';
import SubscriptionLocationSection from './SubscriptionLocationSection';
import SubscriberSection from './SubscriberSection';
import { SubscriptionPreview } from './SubscriptionPreview';

const STATUS_OPTIONS = [
    { value: 'active', label: 'نشط', dot: 'green' },
    { value: 'suspended', label: 'قيد الانتظار', dot: 'amber' },
    { value: 'disconnected', label: 'مفصول', dot: 'gray' },
];

/**
 * The fields the server requires of every subscription; a Super Admin also
 * picks the branch, and an active subscription needs their starting reading.
 */
const REQUIRED_FIELDS = ['full_name', 'status', 'tariff_id', 'minimum_charge'];

/** The form's sections, for the index down the side of its window (FormModal `outline`). */
export const SUBSCRIPTION_OUTLINE = [
    { id: 'subscription-subscriber', title: 'بيانات المشترك', icon: 'user' },
    { id: 'subscription-tariff', title: 'الاشتراك والقاطع', icon: 'bolt' },
    { id: 'subscription-location', title: 'الموقع والعداد', icon: 'pin' },
    { id: 'subscription-fees', title: 'الرسوم والتاريخ', icon: 'calendar' },
    { id: 'subscription-extra', title: 'معلومات إضافية', icon: 'note' },
];

export default function SubscriptionForm({
    data,
    setData,
    errors,
    clearErrors,
    meterBox = null,
    tariffs,
    segments = [],
    circuitBreakers,
    branches,
    subAreas,
    canChooseBranch,
    currentBranchAreaId,
    canEditMinimumCharge,
    canEditKilowattPrice = false,
    sharedPersonalDetails = false,
    isEdit = false,
    subscriptionCount = 1,
}) {
    // What the subscription had when the form opened, which choosing the old status again brings back.
    const original = useRef(data).current;
    const independentContactDetails = sharedPersonalDetails || isEdit;
    const nameField = independentContactDetails ? 'subscription_name' : 'full_name';
    const phoneField = independentContactDetails ? 'subscription_phone' : 'phone';
    const [minimumChargeUnlocked, setMinimumChargeUnlocked] = useState(false);
    const [confirmingMinimumChargeUnlock, setConfirmingMinimumChargeUnlock] = useState(false);

    const [kilowattPriceUnlocked, setKilowattPriceUnlocked] = useState(false);
    const [confirmingKilowattPriceUnlock, setConfirmingKilowattPriceUnlock] = useState(false);

    function unlockMinimumCharge() {
        setConfirmingMinimumChargeUnlock(false);
        setMinimumChargeUnlocked(true);
    }
    const selectedBranch = canChooseBranch ? branches.find((branch) => String(branch.id) === String(data.branch_id)) : null;

    // The branch's area scopes the selectable sub-areas ("منطقة 2"). A Super
    // Admin also sees the chosen branch's area as a read-only value; branch
    // staff do not need to see or choose the area already fixed by their branch.
    const resolvedAreaId = canChooseBranch ? (selectedBranch?.area_id ?? '') : (currentBranchAreaId ?? '');
    const resolvedAreaName = selectedBranch?.area?.name ?? '';

    // The meter box chosen (the subscription's own when editing, which the page carries) and its sub-area:
    // seeding the sub-area from it shows an edited subscription's box pre-selected instead of
    // hiding it behind an unmade sub-area choice. The other boxes are found as the user types.
    const [selectedBox, setSelectedBox] = useState(meterBox);
    const [subAreaId, setSubAreaId] = useState(() => (meterBox?.sub_area_id ? String(meterBox.sub_area_id) : ''));

    const subAreasInArea = useMemo(
        () => (resolvedAreaId ? subAreas.filter((subArea) => String(subArea.area_id) === String(resolvedAreaId)) : []),
        [resolvedAreaId, subAreas],
    );

    // A Super Admin's boxes are those of the branch chosen; a branch's staff already get only their own.
    const boxBranchId = canChooseBranch ? data.branch_id : '';
    const http = useHttp();
    const httpRef = useRef(http);
    httpRef.current = http;
    const loadMeterBoxes = useCallback(
        async (search) => {
            const query = new URLSearchParams({ search, ...(boxBranchId ? { branch_id: boxBranchId } : {}), ...(subAreaId ? { sub_area_id: subAreaId } : {}) });
            const response = await httpRef.current.get(`/meter-boxes/options?${query}`);

            return { options: response.data, hasMore: response.hasMore };
        },
        [boxBranchId, subAreaId],
    );

    const showMeterBoxField = !canChooseBranch || Boolean(data.branch_id);

    useEffect(() => {
        if (!isEdit && !subAreaId && subAreasInArea.length === 1) {
            setSubAreaId(String(subAreasInArea[0].id));
        }
    }, [isEdit, subAreaId, subAreasInArea]);

    const selectedTariff = tariffs.find((tariff) => String(tariff.id) === String(data.tariff_id));
    const selectedCircuitBreaker = circuitBreakers.find((circuitBreaker) => String(circuitBreaker.id) === String(data.circuit_breaker_id));
    const minimumChargeLocked = !canEditMinimumCharge || !minimumChargeUnlocked;
    const tariffRate = selectedTariff ? Number(selectedTariff.rate) : null;
    const kilowattPriceLocked = !canEditKilowattPrice || !kilowattPriceUnlocked;
    const hasOwnKilowattPrice = data.kilowatt_price !== '';
    // An edited subscriber's own price does not fit another tariff, so choosing one drops it.
    const kilowattPriceDropped = isEdit && original.kilowatt_price !== '' && !hasOwnKilowattPrice && !kilowattPriceUnlocked;
    // A fee already on the account is that line's amount: it is changed from the transactions, not here.
    const subscriptionFeeCharged = original.subscription_fee_charged;
    const subscriptionFeeLocked = subscriptionFeeCharged || ('charge_subscription_fee' in data && !data.charge_subscription_fee);

    const contactRequiredFields = REQUIRED_FIELDS.map((field) => field === 'full_name' ? nameField : field === 'phone' ? phoneField : field);
    // Once active, a subscription is disconnected rather than put back to waiting.
    const statusOptions = STATUS_OPTIONS.map((option) =>
        isEdit && (original.status === 'active' || original.has_been_active) && option.value === 'suspended'
            ? { ...option, disabled: true, title: 'لا يمكن إعادة مشترك سبق تفعيله إلى قيد الانتظار؛ غيّر حالته إلى مفصول.' }
            : option,
    );
    const readingRequired = data.status === 'active';
    const requiredFields = [...contactRequiredFields, ...(canChooseBranch ? ['branch_id'] : []), ...(readingRequired ? ['initial_reading'] : [])];
    const filledRequiredFields = requiredFields.filter((field) => String(data[field] ?? '').trim() !== '').length;

    /** A choice made with a chip: no input event fires, so clear its error here. */
    function choose(field, value) {
        setData(field, value);
        clearErrors?.(field);
    }

    /**
     * The starting reading is entered only for an active subscription.
     * Activating one who is not active yet starts their subscription today,
     * from a reading entered now; one who had been active keeps the day they
     * first subscribed. Choosing their old status again puts back what they had.
     */
    function chooseStatus(value) {
        const activating = isEdit && original.status !== 'active' && value === 'active';

        setData((current) => ({
            ...current,
            status: value,
            initial_reading: value === 'active' ? (activating ? '' : current.initial_reading) : isEdit ? original.initial_reading : '',
            ...(isEdit && original.status !== 'active'
                ? { subscription_date: activating && !original.has_been_active ? new Date().toLocaleDateString('en-CA') : original.subscription_date }
                : {}),
        }));
        clearErrors?.('status', 'initial_reading', 'subscription_date');
    }

    function onBranchChange(value) {
        setSubAreaId('');
        setSelectedBox(null);
        setData((current) => ({ ...current, branch_id: value, meter_box_id: '' }));
    }

    function onSubAreaChange(value) {
        setSubAreaId(value);

        if (selectedBox && value && String(selectedBox.sub_area_id) !== String(value)) {
            setSelectedBox(null);
            setData('meter_box_id', '');
        }
    }

    function onMeterBoxChange(value, option) {
        setData('meter_box_id', value);
        setSelectedBox(option ? { value: option.value, label: option.label, sub_area_id: option.sub_area_id } : null);

        if (option?.sub_area_id) {
            setSubAreaId(String(option.sub_area_id));
        }
    }

    function onTariffChange(value) {
        setData((current) => ({ ...current, tariff_id: value, ...(String(current.tariff_id) !== String(value) ? { kilowatt_price: '' } : {}) }));
        setKilowattPriceUnlocked(false);
        clearErrors?.('tariff_id', 'kilowatt_price');
    }

    /** Opens the price for editing, starting from what the subscriber pays now. */
    function unlockKilowattPrice() {
        setConfirmingKilowattPriceUnlock(false);
        setKilowattPriceUnlocked(true);
        setData('kilowatt_price', hasOwnKilowattPrice ? data.kilowatt_price : tariffRate);
    }

    /** Closes the price again, back to what the form opened with (or the tariff's price for a new subscriber). */
    function lockKilowattPrice() {
        setKilowattPriceUnlocked(false);
        setData('kilowatt_price', String(original.tariff_id) === String(data.tariff_id) ? original.kilowatt_price : '');
        clearErrors?.('kilowatt_price');
    }

    function onCircuitBreakerChange(value) {
        const match = circuitBreakers.find((circuitBreaker) => String(circuitBreaker.id) === value);
        setData((current) => ({
            ...current,
            circuit_breaker_id: value,
            minimum_charge: match ? Number(match.minimum_payment) : current.minimum_charge,
        }));
        clearErrors?.('circuit_breaker_id');
    }

    const preview = (
        <SubscriptionPreview
            data={data}
            tariff={selectedTariff}
            circuitBreaker={selectedCircuitBreaker}
            filled={filledRequiredFields}
            total={requiredFields.length}
        />
    );

    return (
        <div className="space-y-5">
            {preview}

            {(sharedPersonalDetails || subscriptionCount > 1) && (
                <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800">
                    {sharedPersonalDetails
                        ? 'سيُضاف اشتراك جديد بنفس الهوية. يمكنك إضافة وصف إلى الاسم وتغيير رقم الجوال لهذا الاشتراك.'
                        : 'الاسم ورقم الجوال قابلان للتعديل لهذا الاشتراك فقط. الهوية والعنوان مشتركان بين الاشتراكات.'}
                    <InputError message={errors.source_subscription_id} className="mt-1" />
                </div>
            )}

            <div id="subscription-subscriber" className="scroll-mt-4">
                <SubscriberSection
                    chooseStatus={chooseStatus}
                    data={data}
                    errors={errors}
                    independentContactDetails={independentContactDetails}
                    isEdit={isEdit}
                    nameField={nameField}
                    original={original}
                    phoneField={phoneField}
                    setData={setData}
                    sharedPersonalDetails={sharedPersonalDetails}
                    statusOptions={statusOptions}
                />
            </div>

            <div id="subscription-tariff" className="scroll-mt-4">

                <SubscriptionTariffSection
                    canEditKilowattPrice={canEditKilowattPrice}
                    canEditMinimumCharge={canEditMinimumCharge}
                    circuitBreakers={circuitBreakers}
                    confirmingKilowattPriceUnlock={confirmingKilowattPriceUnlock}
                    confirmingMinimumChargeUnlock={confirmingMinimumChargeUnlock}
                    data={data}
                    errors={errors}
                    hasOwnKilowattPrice={hasOwnKilowattPrice}
                    kilowattPriceDropped={kilowattPriceDropped}
                    kilowattPriceLocked={kilowattPriceLocked}
                    kilowattPriceUnlocked={kilowattPriceUnlocked}
                    lockKilowattPrice={lockKilowattPrice}
                    minimumChargeLocked={minimumChargeLocked}
                    minimumChargeUnlocked={minimumChargeUnlocked}
                    onCircuitBreakerChange={onCircuitBreakerChange}
                    onTariffChange={onTariffChange}
                    segments={segments}
                    selectedTariff={selectedTariff}
                    setConfirmingKilowattPriceUnlock={setConfirmingKilowattPriceUnlock}
                    setConfirmingMinimumChargeUnlock={setConfirmingMinimumChargeUnlock}
                    setData={setData}
                    tariffRate={tariffRate}
                    tariffs={tariffs}
                    unlockKilowattPrice={unlockKilowattPrice}
                    unlockMinimumCharge={unlockMinimumCharge}
                />
            </div>

            <div id="subscription-location" className="scroll-mt-4">

                <SubscriptionLocationSection
                    branches={branches}
                    canChooseBranch={canChooseBranch}
                    data={data}
                    errors={errors}
                    isEdit={isEdit}
                    loadMeterBoxes={loadMeterBoxes}
                    onBranchChange={onBranchChange}
                    onMeterBoxChange={onMeterBoxChange}
                    onSubAreaChange={onSubAreaChange}
                    resolvedAreaId={resolvedAreaId}
                    resolvedAreaName={resolvedAreaName}
                    selectedBox={selectedBox}
                    showMeterBoxField={showMeterBoxField}
                    subAreaId={subAreaId}
                    subAreasInArea={subAreasInArea}
                />
            </div>

            <div id="subscription-fees" className="scroll-mt-4">
                <FormSection icon="calendar" title="معلومات الاشتراك">
                    <FormField
                        id="initial_reading"
                        label="القراءة السابقة"
                        required={readingRequired}
                        error={errors.initial_reading}
                        hint={readingRequired ? 'منها يبدأ حساب الاستهلاك.' : 'تُدخل القراءة عند تفعيل المشترك، منها يبدأ حساب استهلاكه.'}
                    >
                        <Affix unit="ك.و.س">
                            <TextInput
                                type="number"
                                required={readingRequired}
                                disabled={!readingRequired}
                                min={0}
                                step="0.01"
                                className={`block w-full disabled:opacity-100 ${readingRequired ? '' : 'bg-gray-50 text-gray-600'}`}
                                value={data.initial_reading}
                                onChange={(event) => setData('initial_reading', event.target.value)}
                            />
                        </Affix>
                    </FormField>

                    <FormField id="subscription_fee" label="رسوم الاشتراك" required={data.charge_subscription_fee} error={errors.subscription_fee}>
                        <Affix unit="₪">
                            <TextInput
                                type="number"
                                step="0.01"
                                disabled={subscriptionFeeLocked}
                                title={subscriptionFeeCharged ? 'حُمّلت الرسوم على الحساب؛ عدّلها من سجل المعاملات.' : subscriptionFeeLocked ? 'فعّل تحميل رسوم اشتراك لإدخال المبلغ' : undefined}
                                className={`block w-full disabled:opacity-100 ${subscriptionFeeLocked ? 'bg-gray-50 text-gray-600' : ''}`}
                                required={data.charge_subscription_fee}
                                min={data.charge_subscription_fee ? '0.01' : '0'}
                                value={data.subscription_fee}
                                onChange={(e) => setData('subscription_fee', e.target.value)}
                            />
                        </Affix>
                    </FormField>

                    <FormField id="subscription_date" label="تاريخ الاشتراك" error={errors.subscription_date}>
                        <DateInput
                            // The server accepts no date before 2000 or after today.
                            min="2000-01-01"
                            max={new Date().toLocaleDateString('en-CA')}
                            value={data.subscription_date}
                            onChange={(value) => setData('subscription_date', value)}
                        />
                    </FormField>

                    {'charge_subscription_fee' in data && (
                        <div className="sm:col-span-2 lg:col-span-3">
                            <SettingRow
                                title="تحميل رسوم اشتراك"
                                description={
                                    data.charge_subscription_fee
                                        ? 'تُضاف رسوم الاشتراك إلى الرصيد وسجل المعاملات عند حفظ المشترك.'
                                        : 'لن تُضاف الرسوم إلى الرصيد أو سجل المعاملات. يمكنك تحميلها لاحقًا من سجل المعاملات.'
                                }
                            >
                                <Switch
                                    checked={data.charge_subscription_fee}
                                    onChange={(checked) => choose('charge_subscription_fee', checked)}
                                    ariaLabel="تحميل رسوم اشتراك"
                                />
                            </SettingRow>
                            <InputError message={errors.charge_subscription_fee} className="mt-1" />
                        </div>
                    )}
                </FormSection>
            </div>

            <div id="subscription-extra" className="scroll-mt-4">
                <FormSection icon="note" title="معلومات إضافية">
                    <FormField id="address" label="العنوان" error={errors.address} span="sm:col-span-2 lg:col-span-3">
                        <textarea
                            rows={2}
                            className="block w-full"
                            value={data.address}
                            readOnly={sharedPersonalDetails}
                            onChange={(e) => setData('address', e.target.value)}
                        />
                    </FormField>

                    <FormField id="notes" label="معلومات أخرى" error={errors.notes} span="sm:col-span-2 lg:col-span-3">
                        <textarea rows={2} className="block w-full" value={data.notes} onChange={(e) => setData('notes', e.target.value)} />
                    </FormField>
                </FormSection>
            </div>
        </div>
    );
}
