import ChoiceChips from '@/Components/ChoiceChips';
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import TextInput from '@/Components/TextInput';
import { plainDigits } from '@/lib/formValidation';

/** The subscriber's own details: name, national ID, phones and address. */
export default function SubscriberSection({
    chooseStatus,
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
        <FormSection icon="user" title="بيانات المشترك" description="الاسم والهوية والجوال والحالة">
            <FormField
                id={nameField}
                label="الاسم"
                required
                error={errors[nameField]}
                hint={independentContactDetails ? 'يمكنك إضافة وصف إلى الاسم مثل: محمد حمدان — المنزل.' : undefined}
            >
                <TextInput
                    required
                    className="block w-full"
                    placeholder="الاسم الرباعي"
                    maxLength={255}
                    value={data[nameField]}
                    autoFocus
                    onChange={(e) => setData(nameField, e.target.value)}
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
                    onChange={(event) => setData('national_id', plainDigits(event.target.value))}
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
                    placeholder="059XXXXXXX"
                    className="block w-full"
                    value={data[phoneField]}
                    onChange={(e) => setData(phoneField, plainDigits(e.target.value))}
                />
            </FormField>

            <FormField
                id="status"
                label="الحالة"
                required
                error={errors.status}
                span="sm:col-span-2 lg:col-span-3"
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
        </FormSection>
    );
}
