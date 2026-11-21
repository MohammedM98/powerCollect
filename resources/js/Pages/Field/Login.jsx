import { Chip } from '@heroui/react';
import { Head, usePage } from '@inertiajs/react';
import LoginForm from '@/Components/Auth/LoginForm';
import GuestLayout from '@/Layouts/GuestLayout';
import { FieldManifest } from '@/Layouts/FieldLayout';

/** The field app's sign-in: the company's stage and form, landing on the field home. */
export default function FieldLogin() {
    const { branchContext } = usePage().props;

    return (
        <GuestLayout title="تطبيق الميدان" subtitle="لقرّاء العدادات والمحصّلين. ادخل باسم المستخدم وكلمة المرور اللذين أعطاك إياهما مدير النظام.">
            <Head title="دخول تطبيق الميدان">
                <FieldManifest />
            </Head>

            {branchContext?.current && (
                <Chip className="gl-auth-branch">تسجيل الدخول إلى {branchContext.current.name}</Chip>
            )}

            <LoginForm action="/field/login" />
        </GuestLayout>
    );
}
