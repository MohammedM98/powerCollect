import { useForm } from '@inertiajs/react';
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import PasswordInput from '@/Components/UI/PasswordInput';
import Icon from '@/Components/UI/Icon';
import { PrimaryKey } from '@/Components/UI';
import { passwordStrength } from '@/lib/profilePassword';

const STRENGTH_LABELS = ['—', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية'];

export default function UpdatePasswordForm() {
    const { data, setData, put, processing, errors, reset, recentlySuccessful } = useForm({
        current_password: '', password: '', password_confirmation: '',
    });
    const bag = errors.updatePassword ?? errors;
    const strength = passwordStrength(data.password, data.current_password);
    const matching = Boolean(data.password_confirmation) && data.password_confirmation === data.password;
    const mismatch = data.password_confirmation && !matching ? 'كلمتا المرور غير متطابقتين.' : undefined;

    function submit(event) {
        event.preventDefault();
        put('/password', { preserveScroll: true, onSuccess: () => reset() });
    }

    return (
        <form onSubmit={submit}>
            <FormSection icon="key" title="تغيير كلمة المرور" description="8 خانات على الأقل، ويمكن استخدام حروف فقط أو أرقام فقط." columns={1}>
                <FormField id="current_password" label="كلمة المرور الحالية" required error={bag.current_password}>
                    <PasswordInput dir="ltr" toggleTabIndex={0} className="w-full" value={data.current_password} autoComplete="current-password" onChange={(e) => setData('current_password', e.target.value)} required />
                </FormField>
                <div className="space-y-2">
                    <FormField id="password" label="كلمة المرور الجديدة" required error={bag.password}>
                        <PasswordInput dir="ltr" toggleTabIndex={0} className="w-full" value={data.password} autoComplete="new-password" onChange={(e) => setData('password', e.target.value)} required />
                    </FormField>
                    <div className={`pp-strength level-${strength.score}`} aria-live="polite">
                        <div className="bars">{[1, 2, 3, 4].map((level) => <i key={level} className={level <= strength.score ? 'filled' : ''} />)}</div>
                        <div className="lbl"><span>قوة كلمة المرور (إرشادية فقط)</span><b>{STRENGTH_LABELS[strength.score]}</b></div>
                    </div>
                    <ul className="pp-rules" aria-label="الحد الأدنى لكلمة المرور"><li className={strength.checks[0] ? 'on' : ''}><i><Icon name="check" /></i>8 خانات على الأقل</li></ul>
                </div>
                <FormField
                    id="password_confirmation"
                    label="تأكيد كلمة المرور الجديدة"
                    required
                    error={bag.password_confirmation ?? mismatch}
                    hint={matching ? <span className="pp-match">✓ كلمتا المرور متطابقتان</span> : undefined}
                >
                    <PasswordInput dir="ltr" toggleTabIndex={0} className="w-full" value={data.password_confirmation} autoComplete="new-password" onChange={(e) => setData('password_confirmation', e.target.value)} required />
                </FormField>
                <div className="pp-actions">
                    <span className="pp-note" role="status">{recentlySuccessful ? 'تم تغيير كلمة المرور' : 'بعد التغيير يبقى هذا الجهاز مسجّل الدخول.'}</span>
                    <PrimaryKey disabled={processing}><Icon name="key" className="h-4 w-4" />{processing ? 'جارٍ الحفظ…' : 'تغيير كلمة المرور'}</PrimaryKey>
                </div>
            </FormSection>
        </form>
    );
}
