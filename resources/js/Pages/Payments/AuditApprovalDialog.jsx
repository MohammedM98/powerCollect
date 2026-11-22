import { useForm } from '@inertiajs/react';
import DialogFrame from '@/Components/UI/DialogFrame';
import HoldToConfirm from '@/Components/UI/HoldToConfirm';
import InputError from '@/Components/UI/InputError';
import { formatMoney } from '@/lib/format';
import { CheckBox, Notice, SecondaryKey } from '@/Components/UI';

/** Final financial approval, scoped to the full box or branch week shown here. */
export default function AuditApprovalDialog({ title, scope, summary, url, payload = {}, onClose }) {
    const form = useForm({ ...payload, confirmed: false });

    return <DialogFrame show onClose={onClose} busy={form.processing} title={title} description={scope} icon="check" maxWidth="3xl" role="alertdialog" footer={<SecondaryKey disabled={form.processing} onClick={onClose}>العودة للمراجعة</SecondaryKey>}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-(--ma-line) pb-4">
            {[['الصناديق', summary.boxes], ['الحوالات', summary.transfers], ['حوالات فيها فروق', summary.exceptions], ['ستُعتمد مطابقة تلقائيًا', summary.automaticMatches]].map(([label, value]) => <div key={label}><dt className="text-base text-(--ma-muted)">{label}</dt><dd className="mt-1 font-display text-2xl font-bold text-(--ma-ink)">{value}</dd></div>)}
        </dl>
        <section aria-label="الأثر المالي" className="space-y-3">
            <h3 className="text-lg font-bold text-(--ma-ink)">الأثر على حسابات المشتركين</h3>
            <dl className="divide-y divide-(--ma-line) rounded-control bg-(--ma-tile) px-4">
                <div className="flex flex-wrap items-center justify-between gap-2 py-4"><dt className="text-base text-(--ma-ink)">تحميل على المشتركين</dt><dd className="font-display text-2xl font-bold text-(--ma-owe)"><bdi dir="ltr">{formatMoney(summary.debit)}</bdi> <span className="text-base font-normal">₪</span></dd></div>
                <div className="flex flex-wrap items-center justify-between gap-2 py-4"><dt className="text-base text-(--ma-ink)">إضافة لصالح المشتركين</dt><dd className="font-display text-2xl font-bold text-(--ma-pay)"><bdi dir="ltr">{formatMoney(summary.credit)}</bdi> <span className="text-base font-normal">₪</span></dd></div>
            </dl>
        </section>
        <Notice tone="warn">الاعتماد نهائي، ويقفل قرارات التدقيق.</Notice>
        <details className="text-base">
            <summary className="cursor-pointer font-semibold text-(--ma-ink)">ماذا يشمل الاعتماد؟</summary>
            <ul className="mt-3 list-inside list-disc space-y-2">
                <li>كل الصناديق الموضحة أعلاه، بما فيها المخفية بالبحث أو الفلاتر.</li>
                <li>ترحيل الفروق المسجّلة إلى حسابات المشتركين.</li>
                <li>اعتماد بقية الحوالات كمطابقة لكشف البنك.</li>
            </ul>
        </details>
        <label className="flex cursor-pointer items-start gap-3 rounded-control border border-(--ma-line) p-4 text-base leading-8 text-(--ma-ink)"><CheckBox checked={form.data.confirmed} onChange={(event) => form.setData('confirmed', event.target.checked)} disabled={form.processing} /><span>راجعت جميع الحوالات وسجّلت الفروق، والبقية مطابقة لكشف البنك.</span></label>
        <InputError message={form.errors.confirmed || form.errors.action || form.errors.snapshot || form.errors.box_ids || form.errors.week || form.errors.branch_id} />
        <HoldToConfirm count={summary.boxes} noun="الصناديق" tone="primary" icon="check" disabled={!form.data.confirmed || summary.boxes === 0} busy={form.processing} label="اضغط ٣ ثوانٍ لاعتماد التدقيق" confirmLabel="اعتماد التدقيق نهائيًا" onConfirm={() => form.post(url, { preserveScroll: true, onSuccess: onClose })} />
    </DialogFrame>;
}
