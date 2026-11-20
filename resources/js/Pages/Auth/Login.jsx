import CheckBox from '@/Components/CheckBox';
import { Head, useForm, usePage } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import PasswordInput from '@/Components/PasswordInput';
import PrimaryButton from '@/Components/PrimaryButton';

export default function Login() {
    const { branchContext } = usePage().props;
    const { data, setData, post, processing, errors, reset } = useForm({
        username: '',
        password: '',
        remember: false,
    });

    function submit(e) {
        e.preventDefault();
        post('/login', {
            onFinish: () => reset('password'),
        });
    }

    return (
        <GuestLayout>
            <Head title="تسجيل الدخول" />

            {branchContext?.current && <p className="gl-pill gl-info self-center">تسجيل الدخول إلى {branchContext.current.name}</p>}

            <form onSubmit={submit} className="flex flex-col gap-4">
                <div>
                    <InputLabel htmlFor="username" value="اسم المستخدم" />
                    <TextInput
                        id="username"
                        className="mt-1.5 block h-11 w-full text-right"
                        dir="auto"
                        value={data.username}
                        autoFocus
                        autoComplete="username"
                        onChange={(e) => setData('username', e.target.value)}
                    />
                    <InputError message={errors.username} className="mt-1.5" />
                </div>

                <div>
                    <InputLabel htmlFor="password" value="كلمة المرور" />
                    <PasswordInput
                        id="password"
                        className="mt-1.5 block h-11 w-full text-right"
                        value={data.password}
                        autoComplete="current-password"
                        onChange={(e) => setData('password', e.target.value)}
                    />
                    <InputError message={errors.password} className="mt-1.5" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2.5 font-semibold">
                        <CheckBox
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                        />
                        تذكّرني على هذا الجهاز
                    </label>
                    <span className="gl-sub">نسيت كلمة المرور؟ اطلبها من مدير النظام</span>
                </div>

                <PrimaryButton disabled={processing} className="gl-lg mt-2 w-full">
                    {processing ? <><span className="gl-spin" aria-hidden="true" />جارٍ الدخول</> : 'تسجيل الدخول'}
                </PrimaryButton>
            </form>
        </GuestLayout>
    );
}
