import { Chip } from '@heroui/react';
import { Head, usePage } from '@inertiajs/react';
import LoginForm from '@/Components/Auth/LoginForm';
import GuestLayout from '@/Layouts/GuestLayout';

/** The website's sign-in page (the form is Components/Auth/LoginForm). */
export default function Login() {
    const { branchContext } = usePage().props;

    return (
        <GuestLayout>
            <Head title="تسجيل الدخول" />

            {branchContext?.current && (
                <Chip className="gl-auth-branch">تسجيل الدخول إلى {branchContext.current.name}</Chip>
            )}

            <LoginForm action="/login" />
        </GuestLayout>
    );
}
