import { Button } from '@heroui/react';
import { useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Icon from '@/Components/UI/Icon';
import DialogFrame from '@/Components/UI/DialogFrame';
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import PasswordInput from '@/Components/UI/PasswordInput';
import { useTheme } from '@/hooks/useTheme';
import { ACTION_MESSAGES } from '@/lib/actionMessages';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import './Profile.css';
import PageHeader from '@/Components/PageHeader';
import { DangerKey, Notice, SecondaryKey } from '@/Components/UI';

const THEMES = [
    { value: 'light', label: 'فاتح', colors: ['#eff1f4', '#fff'] },
    { value: 'dark', label: 'داكن', colors: ['#0b0d10', '#14171c'] },
    { value: 'auto', label: 'حسب الجهاز', colors: ['#eff1f4', '#14171c'] },
];

function PermissionGroup({ group }) {
    return <div className="pp-permission-group"><b>{group.label}<span>{group.permissions.filter((permission) => permission.granted).length}/{group.permissions.length}</span></b><div className="pp-chips">{group.permissions.map((permission) => <span key={permission.key} className={permission.granted ? '' : 'no'}>{permission.label}</span>)}</div></div>;
}

function Permissions({ groups }) {
    const coreKeys = ['subscriptions', 'meter_readings', 'collections'];
    const core = coreKeys.map((key) => groups.find((group) => group.key === key)).filter(Boolean);
    const settings = groups.filter((group) => !coreKeys.includes(group.key));
    const granted = settings.filter((group) => group.permissions.some((permission) => permission.granted)).length;

    return <FormSection icon="shield" title="صلاحياتك" description="ما يمكنك فعله في النظام حسب دورك." columns={1}>
        <div className="pp-permissions">
            {core.map((group) => <PermissionGroup key={group.key} group={group} />)}
            <details className="pp-permission-group pp-settings-permissions">
                <summary><b>الإعدادات<span>{granted}/{settings.length}</span></b><div className="pp-chips">{settings.map((group) => <span key={group.key} className={group.permissions.some((permission) => permission.granted) ? '' : 'no'}>{group.label}</span>)}</div><small>عرض تفاصيل الصلاحيات <Icon name="chevron-down" /></small></summary>
                <div className="pp-permissions">{settings.map((group) => <PermissionGroup key={group.key} group={group} />)}</div>
            </details>
        </div>
        <Notice>تُعدَّل الصلاحيات من صفحة <b>الصلاحيات</b>. إن احتجت صلاحية إضافية تواصل مع المدير العام.</Notice>
    </FormSection>;
}

function Devices({ devices, dateLabel }) {
    const [target, setTarget] = useState(null);
    const form = useForm({ password: '', type: 'all', id: null });
    const others = devices.filter((device) => !device.current);

    function open(device) {
        form.reset();
        form.clearErrors();
        form.setData({ password: '', type: device?.type ?? 'all', id: device?.id ?? null });
        setTarget(device ?? { label: 'كل الأجهزة الأخرى' });
    }

    function close() {
        setTarget(null);
        form.reset();
        form.clearErrors();
    }

    function logout(event) {
        event.preventDefault();
        form.delete('/profile/devices', { preserveScroll: true, onSuccess: close, onError: () => form.reset('password') });
    }

    return (
        <FormSection icon="devices" title="الأجهزة والجلسات" description="الأجهزة المسجّل دخولك منها الآن." columns={1}>
            <div className="pp-devices">{devices.map((device) => <div className="pp-device" key={`${device.type}-${device.id}`}>
                <span className="pp-device-icon"><Icon name={device.type === 'mobile' ? 'phone' : 'devices'} /></span>
                <div><b>{device.label}{device.current && <em>هذا الجهاز</em>}</b><small>{device.current ? 'نشط الآن' : <>آخر نشاط <bdi dir="ltr">{dateLabel(device.lastActiveAt)}</bdi></>}</small></div>
                {!device.current && <SecondaryKey onClick={() => open(device)}>تسجيل خروج</SecondaryKey>}
            </div>)}</div>
            <div className="pp-actions"><SecondaryKey disabled={!others.length} onClick={() => open(null)}><Icon name="logout" className="h-4 w-4" />تسجيل الخروج من كل الأجهزة الأخرى</SecondaryKey></div>
            <DialogFrame
                show={target !== null}
                onClose={close}
                title={`تسجيل الخروج من ${target?.label}؟`}
                description="يبقى هذا الجهاز مسجّل الدخول. أدخل كلمة المرور للتأكيد."
                icon="logout"
                tone="danger"
                maxWidth="md"
                busy={form.processing}
                footer={(
                    <>
                        <SecondaryKey disabled={form.processing} onClick={close}>إلغاء</SecondaryKey>
                        <DangerKey form="device-logout-form" disabled={form.processing}><Icon name="logout" className="h-4 w-4" />تسجيل الخروج</DangerKey>
                    </>
                )}
            >
                <form id="device-logout-form" onSubmit={logout}>
                    <FormField id="device_password" label="كلمة المرور" error={form.errors.deviceLogout?.password ?? form.errors.password}>
                        <PasswordInput dir="ltr" toggleTabIndex={0} className="block w-full" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} autoComplete="current-password" autoFocus required />
                    </FormField>
                </form>
            </DialogFrame>
        </FormSection>
    );
}

export default function Edit({ user, permissionGroups, devices, businessTimezone, canUpdatePassword }) {
    const { activity } = usePage().props;
    const { preference, changePreference } = useTheme();
    const initials = user.name.trim().split(/\s+/).filter((word) => !['أبو', 'عبد'].includes(word)).slice(0, 2).map((word) => word.replace(/^ال/, '')[0] || '').join('');
    const dateLabel = (value) => value ? new Intl.DateTimeFormat('ar-u-nu-latn', { timeZone: businessTimezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '—';

    return (
        <AuthenticatedLayout header={<PageHeader title="الملف الشخصي" />}>
            <Head title="الملف الشخصي" />
            <div className="profile-page ma-form ma-form-page" dir="rtl">
                <section className="pp-hero">
                    <span className="pp-avatar">{initials}</span>
                    <div><h2>{user.name}</h2><span className="pp-username">@{user.username}</span>
                        <div className="pp-tags"><span className="pp-tag role"><Icon name="badge" />{user.roleLabel}</span><span className="pp-tag"><Icon name="pin" />{user.branchName}</span><span className="pp-tag"><i className={user.isActive ? 'active' : ''} />حساب {user.isActive ? 'فعّال' : 'متوقف'}</span></div>
                    </div>
                    <div className="pp-facts"><div><small>عضو منذ</small><b><bdi dir="ltr">{user.memberSince}</bdi></b></div><div><small>آخر نشاط</small><b><bdi dir="ltr">{dateLabel(user.lastActiveAt)}</bdi></b></div><div><small>عملياتك هذا الأسبوع</small><b><bdi dir="ltr">{user.weeklyActions.toLocaleString('en')}</bdi></b></div></div>
                </section>
                <div className="pp-grid">
                    <div>
                        <UpdateProfileInformationForm user={user} />
                        {canUpdatePassword ? <UpdatePasswordForm /> : (
                            <FormSection icon="key" title="كلمة المرور" columns={1}>
                                <Notice>لتغيير كلمة المرور، تواصل مع مدير الفرع أو مدير النظام.</Notice>
                            </FormSection>
                        )}
                    </div>
                    <div>
                        <Permissions groups={permissionGroups} />
                        <Devices devices={devices} dateLabel={dateLabel} />
                        <FormSection icon="sun" title="المظهر" columns={1}><div className="pp-theme" role="group" aria-label="مظهر النظام">{THEMES.map((theme) => <Button data-raw="" variant="ghost" key={theme.value} aria-pressed={preference === theme.value} onClick={() => changePreference(theme.value)}><span className="sw">{theme.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>{theme.label}</Button>)}</div></FormSection>
                        <FormSection icon="clock" title="آخر نشاطاتك" columns={1}>
                            <div className="pp-feed">{activity?.recent.length ? activity.recent.slice(0, 5).map((item) => <div className="pp-feed-item" key={item.id}><span className={`pp-feed-icon ${item.action.includes('password') ? 'warn' : item.action.includes('reading') ? 'info' : item.action.includes('payment') ? 'success' : ''}`}><Icon name={item.action.includes('password') ? 'key' : item.action.includes('reading') ? 'gauge' : item.action.includes('payment') ? 'cash' : 'pencil'} /></span><div><b>{ACTION_MESSAGES[item.action] ?? 'إجراء محفوظ'}</b>{item.subject && <small>{item.subject}</small>}</div><time dateTime={item.createdAt} dir="ltr">{dateLabel(item.createdAt)}</time></div>) : <p className="pp-empty">لا توجد نشاطات محفوظة بعد.</p>}</div>
                        </FormSection>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
