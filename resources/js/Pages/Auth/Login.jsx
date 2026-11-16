import { useRef, useState } from 'react';
import { Form, Head, usePage } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import Icon from '@/Components/Icon';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import PasswordInput from '@/Components/PasswordInput';
import PrimaryButton from '@/Components/PrimaryButton';

const REMEMBERED_USERNAME = 'powercollect-remembered-username';

function readUsername() {
    try { return localStorage.getItem(REMEMBERED_USERNAME) ?? ''; } catch { return ''; }
}

export default function Login() {
    const { branchContext } = usePage().props;
    const [savedUsername] = useState(readUsername);
    const [resetHelp, setResetHelp] = useState(false);
    const username = useRef(null);
    const remember = useRef(null);
    const submittedUsername = useRef(null);
    const title = <>أهلًا بعودتك <span>إلى لوحة القيادة</span></>;

    function saveRememberedUsername() {
        try {
            if (submittedUsername.current) {
                localStorage.setItem(REMEMBERED_USERNAME, submittedUsername.current);
            } else {
                localStorage.removeItem(REMEMBERED_USERNAME);
            }
        } catch {
            // The server's remembered session still works when browser storage is unavailable.
        }
    }

    return (
        <GuestLayout title={title} subtitle="سجّل دخولك لتتابع التحصيل والقراءات من مكان واحد.">
            <Head title="تسجيل الدخول" />
            {branchContext?.current && <p className="gl-pill gl-info self-start">تسجيل الدخول إلى {branchContext.current.name}</p>}
            <Form action="/login" method="post" onBefore={() => { submittedUsername.current = remember.current?.checked ? username.current?.value : null; }} onSuccess={saveRememberedUsername} resetOnError={['password']} className="flex flex-col gap-4">
                {({ errors, processing, clearErrors }) => (
                    <>
                        <div>
                            <InputLabel htmlFor="username" value="اسم المستخدم" />
                            <div className="gl-auth-input">
                                <Icon name="user" />
                                <TextInput
                                    ref={username}
                                    id="username"
                                    name="username"
                                    placeholder="اسم المستخدم"
                                    dir="auto"
                                    defaultValue={savedUsername}
                                    autoFocus={!savedUsername}
                                    autoComplete="username"
                                    aria-invalid={Boolean(errors.username)}
                                    aria-describedby={errors.username ? 'login-username-error' : undefined}
                                    onChange={() => clearErrors('username')}
                                />
                            </div>
                            <InputError id="login-username-error" message={errors.username} className="gl-auth-error mt-1.5" />
                        </div>

                        <div>
                            <InputLabel htmlFor="password" value="كلمة المرور" />
                            <div className="gl-auth-input">
                                <Icon name="lock" />
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    className="w-full"
                                    placeholder="••••••••"
                                    autoFocus={Boolean(savedUsername)}
                                    toggleTabIndex={0}
                                    autoComplete="current-password"
                                    aria-invalid={Boolean(errors.password)}
                                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                                    onChange={() => clearErrors('password')}
                                />
                            </div>
                            <InputError id="login-password-error" message={errors.password} className="gl-auth-error mt-1.5" />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-x-3">
                            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 font-semibold">
                                <input ref={remember} type="checkbox" name="remember" value="1" defaultChecked={Boolean(savedUsername)} className="gl-auth-remember" />
                                تذكّرني على هذا الجهاز
                            </label>
                            <button type="button" className="gl-auth-forgot" aria-expanded={resetHelp} onClick={() => setResetHelp(!resetHelp)}>نسيت كلمة المرور؟</button>
                        </div>
                        {resetHelp && <p className="gl-sub" role="status">اطلب إعادة تعيين كلمة المرور من مدير النظام.</p>}
                        <PrimaryButton type="submit" aria-label="تسجيل الدخول إلى النظام" disabled={processing} className="gl-lg mt-2 w-full">
                            {processing ? <><span className="gl-spin" aria-hidden="true" />جارٍ الدخول</> : <>دخول إلى النظام <Icon name="chevron-left" className="h-4 w-4" /></>}
                        </PrimaryButton>
                    </>
                )}
            </Form>
        </GuestLayout>
    );
}
