import { Head, useForm } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PasswordInput from '@/Components/PasswordInput';
import PrimaryButton from '@/Components/PrimaryButton';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({ password: '' });

    function submit(e) {
        e.preventDefault();
        post('/confirm-password', {
            onFinish: () => reset('password'),
        });
    }

    return (
        <GuestLayout subtitle="هذه منطقة آمنة. أكّد كلمة المرور قبل المتابعة.">
            <Head title="تأكيد كلمة المرور" />

            <form onSubmit={submit}>
                <div>
                    <InputLabel htmlFor="password" value="كلمة المرور" />
                    <PasswordInput
                        id="password"
                        className="mt-1.5 block h-11 w-full"
                        value={data.password}
                        autoFocus
                        autoComplete="current-password"
                        onChange={(e) => setData('password', e.target.value)}
                    />
                    <InputError message={errors.password} className="mt-2" />
                </div>

                <PrimaryButton disabled={processing} className="gl-lg mt-6 w-full">
                    تأكيد
                </PrimaryButton>
            </form>
        </GuestLayout>
    );
}
