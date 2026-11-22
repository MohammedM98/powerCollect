import { useForm } from '@inertiajs/react';
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import Icon from '@/Components/UI/Icon';
import { PrimaryKey, SecondaryKey, TextInput } from '@/Components/UI';

/** The account's own details: the name can be changed here; the rest is shown locked, as a manager sets it. */
export default function UpdateProfileInformationForm({ user }) {
    const { data, setData, patch, processing, errors, reset, clearErrors, isDirty, setDefaults, recentlySuccessful } = useForm({
        name: user.name,
    });

    function submit(e) {
        e.preventDefault();
        patch('/profile', { preserveScroll: true, onSuccess: () => setDefaults() });
    }

    return (
        <form onSubmit={submit}>
            <FormSection icon="user" title="معلومات الحساب" description="يمكنك تعديل اسمك الظاهر. باقي البيانات يعدّلها المدير العام من صفحة المستخدمين." columns={2}>
                <FormField id="name" label="الاسم الكامل" required error={errors.name} span="sm:col-span-2">
                    <TextInput className="w-full" value={data.name} autoComplete="name" onChange={(e) => setData('name', e.target.value)} required maxLength={255} />
                </FormField>
                <FormField id="username" label="اسم المستخدم" lock="locked" hint="يعدّله المدير" span="sm:col-span-2">
                    <TextInput className="w-full" value={user.username} dir="ltr" readOnly />
                </FormField>
                <FormField id="profile_role" label="المسمى الوظيفي" lock="locked" hint="يعدّله المدير">
                    <TextInput className="w-full" value={user.roleLabel} readOnly />
                </FormField>
                <FormField id="profile_branch" label="الفرع" lock="locked" hint="يعدّله المدير">
                    <TextInput className="w-full" value={user.branchName} readOnly />
                </FormField>
                <div className="pp-actions sm:col-span-2">
                    <span className="pp-note" role="status">{isDirty ? 'تغييرات غير محفوظة' : recentlySuccessful ? 'حُفظ الاسم' : ''}</span>
                    {isDirty && <SecondaryKey disabled={processing} onClick={() => { reset(); clearErrors(); }}>تراجع</SecondaryKey>}
                    <PrimaryKey disabled={processing || !isDirty || !data.name.trim()}><Icon name="check" className="h-4 w-4" />{processing ? 'جارٍ الحفظ…' : 'حفظ الاسم'}</PrimaryKey>
                </div>
            </FormSection>
        </form>
    );
}
