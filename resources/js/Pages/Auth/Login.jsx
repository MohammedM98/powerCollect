import { useState } from 'react';
import { Alert, Button, Chip, Description, FieldError, InputGroup, Label, Popover, Spinner, TextField } from '@heroui/react';
import { Form, Head, usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import { CheckBox } from '@/Components/UI';
import GuestLayout from '@/Layouts/GuestLayout';

/**
 * The sign-in form, all HeroUI: the username and password fields (the
 * password with a show key and a Caps Lock warning), «remember me» (Laravel's
 * remember token), a note on a forgotten password, and the sign-in key.
 * A refused sign-in (wrong details, a stopped account, too many tries) shows
 * above the fields; the password is cleared for the next try.
 */
export default function Login() {
    const { branchContext } = usePage().props;
    const [remember, setRemember] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    // A new key empties the password field after a refused try.
    const [attempt, setAttempt] = useState(0);

    function readCapsLock(event) {
        setCapsLock(Boolean(event.getModifierState?.('CapsLock')));
    }

    return (
        <GuestLayout>
            <Head title="تسجيل الدخول" />

            {branchContext?.current && (
                <Chip className="gl-auth-branch">تسجيل الدخول إلى {branchContext.current.name}</Chip>
            )}

            <Form action="/login" method="post" disableWhileProcessing data-errors-inline className="gl-auth-form" onError={() => setAttempt((count) => count + 1)}>
                {({ errors, processing, clearErrors }) => (
                    <>
                        {errors.username && (
                            <Alert status="danger" className="gl-auth-alert">
                                <Alert.Indicator />
                                <Alert.Content>
                                    <Alert.Title>لم يتم الدخول</Alert.Title>
                                    <Alert.Description>{errors.username}</Alert.Description>
                                </Alert.Content>
                            </Alert>
                        )}

                        <TextField name="username" autoComplete="username" onChange={() => clearErrors('username')} className="gl-auth-field">
                            <Label>اسم المستخدم</Label>
                            <InputGroup className="gl-auth-input">
                                <InputGroup.Prefix>
                                    <Icon name="user" className="h-[18px] w-[18px]" />
                                </InputGroup.Prefix>
                                {/* eslint-disable-next-line local/spacing-scale -- deliberate physical side: the name takes its own direction but keeps to the form's right edge. */}
                                <InputGroup.Input id="username" dir="auto" autoFocus={attempt === 0} spellCheck={false} autoCapitalize="none" className="text-right" />
                            </InputGroup>
                        </TextField>

                        <TextField
                            key={attempt}
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            isInvalid={Boolean(errors.password)}
                            onChange={() => clearErrors('password')}
                            className="gl-auth-field"
                        >
                            <div className="gl-auth-label-row">
                                <Label>كلمة المرور</Label>
                                <Popover>
                                    <Button variant="ghost" size="sm" className="gl-auth-forgot">
                                        نسيت كلمة المرور؟
                                    </Button>
                                    <Popover.Content placement="bottom end" className="gl-auth-pop dark">
                                        <Popover.Dialog aria-label="نسيت كلمة المرور">
                                            <Popover.Heading className="gl-auth-pop-title">إعادة تعيين كلمة المرور</Popover.Heading>
                                            <p>يعيّن مدير النظام كلمة مرور جديدة لك من صفحة المستخدمين. تواصل معه، ثم ادخل بها وغيّرها من ملفك الشخصي.</p>
                                        </Popover.Dialog>
                                    </Popover.Content>
                                </Popover>
                            </div>
                            <InputGroup className="gl-auth-input">
                                <InputGroup.Prefix>
                                    <Icon name="lock" className="h-[18px] w-[18px]" />
                                </InputGroup.Prefix>
                                <InputGroup.Input id="password" autoFocus={attempt > 0} onKeyDown={readCapsLock} onKeyUp={readCapsLock} onBlur={() => setCapsLock(false)} />
                                <InputGroup.Suffix>
                                    <Button
                                        isIconOnly
                                        variant="ghost"
                                        size="sm"
                                        excludeFromTabOrder
                                        onPress={() => setShowPassword((shown) => !shown)}
                                        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                                        className="gl-auth-eye"
                                    >
                                        <Icon name={showPassword ? 'eye-off' : 'eye'} className="h-[18px] w-[18px]" />
                                    </Button>
                                </InputGroup.Suffix>
                            </InputGroup>
                            {capsLock && (
                                <Description className="gl-auth-caps">
                                    <Icon name="warning" className="h-4 w-4" />
                                    زر الأحرف الكبيرة (Caps Lock) مفعّل
                                </Description>
                            )}
                            <FieldError>{errors.password}</FieldError>
                        </TextField>

                        <div className="gl-auth-remember">
                            <CheckBox name="remember" value="1" checked={remember} onChange={(event) => setRemember(event.target.checked)}>
                                تذكّرني على هذا الجهاز
                            </CheckBox>
                            <p>يبقى دخولك محفوظًا على هذا الجهاز حتى تسجّل الخروج.</p>
                        </div>

                        {/* HeroUI's Button in the stage's white look; the kit's PrimaryKey would take the app's primary look. */}
                        <Button type="submit" size="lg" isPending={processing} className="gl-auth-submit">
                            {processing ? <><Spinner size="sm" color="current" />جارٍ الدخول</> : 'تسجيل الدخول'}
                        </Button>
                    </>
                )}
            </Form>
        </GuestLayout>
    );
}
