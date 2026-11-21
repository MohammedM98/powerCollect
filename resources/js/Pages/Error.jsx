import { Button } from '@heroui/react';
import { Head, Link, usePage } from '@inertiajs/react';
import Icon from '@/Components/UI/Icon';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import GuestLayout from '@/Layouts/GuestLayout';

/** What each error status says, in plain words, and the icon that goes with it. */
const MESSAGES = {
    403: { icon: 'lock', title: 'لا تملك صلاحية الوصول', text: 'ليست لديك صلاحية لفتح هذه الصفحة أو تنفيذ هذا الإجراء. إن كنت تحتاجه، تواصل مع مدير النظام.' },
    404: { icon: 'search', title: 'الصفحة غير موجودة', text: 'قد يكون الرابط غير صحيح، أو أن السجل الذي تبحث عنه حُذف أو نُقل.' },
    405: { icon: 'alert', title: 'الطلب غير مسموح', text: 'لا يقبل هذا العنوان هذا النوع من الطلبات. ارجع إلى لوحة التحكم وتابع من هناك.' },
    419: { icon: 'clock', title: 'انتهت صلاحية الصفحة', text: 'بقيت الصفحة مفتوحة وقتًا طويلًا. ارجع إلى لوحة التحكم وأعد المحاولة.' },
    429: { icon: 'clock', title: 'محاولات كثيرة', text: 'أرسلت طلبات كثيرة في وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.' },
    500: { icon: 'alert', title: 'حدث خطأ غير متوقع', text: 'لم يكتمل طلبك. حاول مرة أخرى، وإن تكرر الخطأ فأبلغ مدير النظام.' },
    503: { icon: 'cog', title: 'النظام تحت الصيانة', text: 'نجري أعمال صيانة قصيرة. حاول مرة أخرى بعد قليل.' },
};

/**
 * The page an error (no permission, not found, expired, server trouble)
 * shows instead of the framework's plain English one, with a way back.
 * A signed-in user opening a page they may not open (`blank`) sees one quiet
 * line saying it is not open to their account, and the way back home.
 */
export default function Error({ status, blank = false }) {
    const { appName, auth, branchContext } = usePage().props;
    const signedIn = Boolean(auth?.user);

    if (blank && signedIn) {
        return (
            <AuthenticatedLayout>
                <Head title={appName} />
                <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-8 text-center" role="status">
                    <span className="gl-ico h-12! w-12! rounded-full!">
                        <Icon name="lock" className="h-6 w-6" />
                    </span>
                    <p className="text-base font-semibold">هذه الصفحة غير متاحة لحسابك</p>
                    <Link href="/dashboard" className="gl-btn gl-sec">
                        <Icon name="home" className="h-4 w-4" />
                        العودة إلى لوحة التحكم
                    </Link>
                </div>
            </AuthenticatedLayout>
        );
    }

    const message = MESSAGES[status] ?? MESSAGES[500];
    const RecoveryLink = branchContext?.recoveryUrl ? 'a' : Link;

    const body = (
        <div className="mx-auto flex max-w-md flex-col items-center py-8 text-center" role="alert">
            <Head title={message.title} />
            <span className="gl-ico h-16! w-16! rounded-full! text-[rgb(var(--gl-brand))]!">
                <Icon name={message.icon} className="h-8 w-8" />
            </span>
            <p className="gl-num mt-6 text-sm font-semibold gl-text-muted" dir="ltr">
                {status}
            </p>
            <h1 className="mt-2 text-2xl font-extrabold font-(family-name:--gl-head)!">{message.title}</h1>
            <p className="mt-3 text-sm leading-7 gl-text-muted">{message.text}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <RecoveryLink href={branchContext?.recoveryUrl ?? (signedIn ? '/dashboard' : '/login')} className="gl-btn">
                    <Icon name={signedIn ? 'home' : 'enter'} className="h-4 w-4" />
                    {signedIn ? 'العودة إلى لوحة التحكم' : 'تسجيل الدخول'}
                </RecoveryLink>
                <Button data-raw="" variant="ghost" onClick={() => window.history.back()} className="gl-btn gl-sec">
                    رجوع
                </Button>
            </div>
        </div>
    );

    return signedIn ? <AuthenticatedLayout>{body}</AuthenticatedLayout> : <GuestLayout title={null}>{body}</GuestLayout>;
}
