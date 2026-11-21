import { Head } from '@inertiajs/react';
import { useBrand } from '@/hooks/useBrand';
import { Alert, Chip } from '@heroui/react';
import SettingsLayout from '@/Layouts/SettingsLayout';
import PageHeader from '@/Components/PageHeader';
import Icon from '@/Components/Icon';
import { SettingsSection } from '@/Components/Settings/SettingsKit';

const STEPS = [
    ['افتح هذه الصفحة من هاتف Android', 'ثم اضغط «تحميل تطبيق Android».'],
    ['افتح الملف المحمّل', 'إذا طلب الهاتف إذن التثبيت لهذا المتصفح، اسمح به لإتمام التثبيت، ويمكنك إلغاؤه بعد ذلك.'],
    ['سجّل الدخول', 'افتح التطبيق وسجّل الدخول باسم المستخدم وكلمة المرور الخاصين بالموقع.'],
];

/** The field app's page: the release on the charcoal card with its download key, then how to install it. */
export default function MobileApp({ release }) {
    const brand = useBrand();

    return <SettingsLayout header={<PageHeader title="تحميل تطبيق الهاتف" info={`تطبيق ${brand.name} للمحصّلين وقرّاء العدادات: الطبلونات المخصصة، والقراءات، والتحصيل من الهاتف.`} />}>
        <Head title="تحميل تطبيق الهاتف" />
        <div className="gl-app-page">
            <section className="gl-app-hero" aria-labelledby="app-title">
                <span className="gl-app-icon" aria-hidden="true"><Icon name="phone" /></span>
                <div className="min-w-0">
                    <small>تطبيق Android</small>
                    <h2 id="app-title">تطبيق {brand.name}</h2>
                    <p>اطّلع على الطبلونات المخصصة لك، وسجّل القراءات والتحصيل حسب صلاحيات حسابك. يتصل التطبيق بنفس بيانات الموقع عند توفر الإنترنت.</p>
                </div>
                {release ? (
                    <div className="gl-app-release">
                        <div className="gl-app-facts">
                            <Chip size="sm" variant="soft" className="gl-app-chip">الإصدار <bdi dir="ltr">{release.version}</bdi></Chip>
                            <Chip size="sm" variant="soft" className="gl-app-chip">الحجم <bdi dir="ltr">{release.sizeMb} MB</bdi></Chip>
                            <Chip size="sm" variant="soft" className="gl-app-chip">Android 7.0 أو أحدث</Chip>
                        </div>
                        <a href={release.downloadUrl} className="gl-app-download">
                            <Icon name="arrow-down-tray" className="h-5 w-5" />
                            تحميل تطبيق Android
                        </a>
                        <p className="gl-app-note">ملف APK موقّع. يُنزَّل مباشرة من GitHub، ولا يحتاج إلى حساب Google Play.</p>
                    </div>
                ) : (
                    <p role="status" className="gl-app-missing">نسخة التطبيق غير متاحة للتحميل حاليًا. يرجى المحاولة لاحقًا.</p>
                )}
            </section>

            <SettingsSection id="app-install" icon="check" tone="pay" title="التثبيت والبدء" description="ثلاث خطوات، مرة واحدة لكل هاتف.">
                <ol className="gl-app-steps">
                    {STEPS.map(([title, text], index) => (
                        <li key={title}>
                            <span className="gl-app-step-no">{index + 1}</span>
                            <div>
                                <b>{title}</b>
                                <p>{text}</p>
                            </div>
                        </li>
                    ))}
                </ol>
                <Alert status="default" className="gl-app-alert">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>الأجهزة والقراءات دون اتصال</Alert.Title>
                        <Alert.Description>إذا بلغ الحساب حد الأجهزة المسموح، يُسجّل خروج الجهاز الأقدم تلقائيًا. إدخال القراءات متاح في يوم القراءة المحدد فقط، وتبقى القراءات المحفوظة دون اتصال بانتظار مراجعتك وتأكيد رفعها.</Alert.Description>
                    </Alert.Content>
                </Alert>
            </SettingsSection>
        </div>
    </SettingsLayout>;
}
