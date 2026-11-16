import ChoiceChips from '@/Components/ChoiceChips';
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import Switch from '@/Components/Switch';
import TextInput from '@/Components/TextInput';
import { plainDigits } from '@/lib/formValidation';

/** The subscriber's own details: name, national ID, phones and address. */
export default function SubscriberSection({
    chooseStatus,
    compact = false,
    data,
    errors,
    independentContactDetails,
    isEdit,
    nameField,
    original,
    phoneField,
    setData,
    sharedPersonalDetails,
    statusOptions,
}) {
    return (
        <FormSection icon="user" title="بيانات المشترك" bare={compact}>
            <FormField
                id={nameField}
                label={compact ? "الاسم الكامل" : "الاسم"}
                span={compact ? "col-span-full" : undefined}
                required
                error={errors[nameField]}
                hint={independentContactDetails ? 'يمكنك إضافة وصف إلى الاسم مثل: محمد حمدان — المنزل.' : undefined}
            >
                <TextInput
                    required
                    className="block w-full"
                    placeholder={compact ? "مثال: محمود سالم أبو ريدة" : "الاسم الرباعي"}
                    maxLength={255}
                    value={data[nameField]}
                    autoFocus
                    onChange={(e) => setData(nameField, e.target.value)}
                />
            </FormField>

            <FormField id={phoneField} label="رقم الجوال" error={errors[phoneField]}>
                <TextInput
                    type="tel"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="05[69][0-9]{7}"
                    data-feedback
                    title="رقم الجوال يجب أن يتكون من 10 أرقام ويبدأ بـ 059 أو 056"
                    placeholder={compact ? "059 000 0000" : "059XXXXXXX"}
                    className="block w-full"
                    value={data[phoneField]}
                    onChange={(e) => setData(phoneField, plainDigits(e.target.value).replace(/[^0-9]/g, ''))}
                />
            </FormField>

            <FormField id="national_id" label="رقم الهوية" error={errors.national_id}>
                <TextInput
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={9}
                    pattern="[0-9]{9}"
                    data-feedback
                    title="رقم الهوية يجب أن يتكون من 9 أرقام"
                    placeholder="9 أرقام"
                    className="block w-full"
                    value={data.national_id ?? ''}
                    readOnly={sharedPersonalDetails}
                    onChange={(event) => setData('national_id', plainDigits(event.target.value).replace(/[^0-9]/g, ''))}
                />
            </FormField>

            {!compact && <SubscriptionStatusField {...{ chooseStatus, data, errors, isEdit, original, statusOptions }} />}
        </FormSection>
    );
}


export function SubscriptionStatusField({ chooseStatus, compact = false, data, errors, isEdit, original, statusOptions }) {
    if (compact) {
        return (
            <FormField id="status" label="الحالة" error={errors.status}>
                <div className="flex min-h-[var(--control-h)] items-center">
                    <Switch
                        checked={data.status === 'active'}
                        onChange={(checked) => chooseStatus(checked ? 'active' : 'suspended')}
                        label={data.status === 'active' ? 'فعّال · تُدخل له القراءات' : statusOptions.find((option) => option.value === data.status)?.label}
                        ariaLabel="تفعيل المشترك"
                    />
                </div>
            </FormField>
        );
    }

    return (
        <FormField
                id="status"
                label="الحالة"
                required
                error={errors.status}
                span="col-span-full"
                hint={
                    isEdit && original.status !== 'active' && data.status === 'active'
                        ? original.has_been_active
                            ? 'عند إعادة التوصيل أدخل القراءة السابقة للعدّاد؛ يبقى تاريخ الاشتراك الأصلي ويُسجَّل اليوم كتاريخ إعادة التوصيل.'
                            : 'عند التفعيل أدخل القراءة السابقة للعدّاد، ويُحدَّث تاريخ الاشتراك إلى تاريخ اليوم.'
                        : undefined
                }
            >
                <ChoiceChips label="الحالة" value={data.status} onChange={chooseStatus} options={statusOptions} />
            </FormField>
    );
}
