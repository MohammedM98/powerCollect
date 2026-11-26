import { Notice } from '@/Components/UI';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Icon from '@/Components/UI/Icon';
import PageHeader from '@/Components/PageHeader';

export default function Access({ branches, routingEnabled }) {
    return <AuthenticatedLayout header={<PageHeader title="اختيار فرع العمل" info="تظهر الفروع المسموحة لك فقط. كل رابط يفتح بيانات فرعه، وقد يتطلب تسجيل الدخول مجددًا لأن جلسة كل دومين مستقلة." />}>
        <Head title="فروع العمل" />
        {!routingEnabled && <Notice tone="warn" className="mb-6">الروابط مجهّزة، وتوجيه الدومينات يحتاج التفعيل عند النشر.</Notice>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{branches.map((branch) => <div key={branch.id} className="space-y-4 rounded-card border border-(--ma-line) bg-(--ma-solid) p-4 shadow-card">
            <div className="flex items-center gap-3"><span className="rounded-xl bg-(--ma-brand-soft) p-3 text-(--ma-brand)"><Icon name="building" /></span><h3 className="text-lg font-bold text-(--ma-ink)">{branch.name}</h3></div>
            <p className="break-all text-sm text-(--ma-muted)"><bdi dir="ltr">{branch.domain}</bdi></p>
            {routingEnabled && <a href={branch.url} className="inline-flex items-center gap-2 rounded-control bg-(--ma-act) px-4 py-2 text-sm font-semibold text-white">دخول الفرع<Icon name="arrow-left" className="h-4 w-4" /></a>}
        </div>)}</div>
        {branches.length === 0 && <p className="rounded-card border border-dashed border-(--ma-line) p-8 text-center text-(--ma-muted)">لا توجد روابط فروع مفعّلة ضمن نطاقك حاليًا. يحدد السوبر أدمن فروع عملك من صفحة الصلاحيات.</p>}
    </AuthenticatedLayout>;
}
