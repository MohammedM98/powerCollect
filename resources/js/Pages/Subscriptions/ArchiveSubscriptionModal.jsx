import { useId } from 'react';
import { useForm } from '@inertiajs/react';
import DialogFrame from '@/Components/UI/DialogFrame';
import FormField from '@/Components/Form/FormField';
import InputError from '@/Components/UI/InputError';
import Balance from '@/Components/Finance/Balance';
import { balanceWord } from '@/lib/balance';
import DateInput from '@/Components/UI/DateInput';
import { CheckBox, Notice, PrimaryKey, SecondaryKey, TextArea } from '@/Components/UI';

export default function ArchiveSubscriptionModal({ subscription, today, onClose }) {
    const id = useId();
    const restoring = Boolean(subscription.archivedAt);
    const { data, setData, post, delete: destroy, errors, processing } = useForm({ service_ended_on: today, reason: '', confirmed: false });
    const title = restoring ? 'استعادة الاشتراك من الأرشيف' : 'أرشفة الاشتراك المنتهي';
    function submit(event) {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };
        const url = `/subscriptions/${subscription.id}/archive`;
        restoring ? destroy(url, options) : post(url, options);
    }
    const footer = (
        <>
            <SecondaryKey onClick={onClose} disabled={processing}>إلغاء</SecondaryKey>
            <PrimaryKey type="submit" form={id} disabled={processing || !data.confirmed || !data.reason.trim()}>{processing ? 'جارٍ الحفظ…' : title}</PrimaryKey>
        </>
    );

    return (
        <DialogFrame
            show
            onClose={onClose}
            title={title}
            icon={restoring ? 'history' : 'folder'}
            busy={processing}
            description="يُطبَّق على هذا الاشتراك فقط. تبقى الاشتراكات الأخرى للشخص كما هي."
            footer={footer}
        >
            <form id={id} onSubmit={submit} className="ma-form space-y-4">
                <div className="rounded-[14px] bg-(--ma-tile) p-4">
                    <p className="font-bold text-(--ma-ink)">{subscription.display_name}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-base text-(--ma-muted)">
                        <span>رقم الاشتراك <bdi dir="ltr" className="font-display font-semibold text-(--ma-ink)">{subscription.account_number}</bdi></span>
                        <span>الرصيد الحالي: <Balance value={subscription.outstandingBalance} /> <small>{balanceWord(subscription.outstandingBalance)}</small></span>
                    </div>
                </div>
                <Notice tone={restoring ? 'info' : 'warn'}>
                    {restoring
                        ? 'سيعود الاشتراك إلى القائمة بحالة «مفصول». إعادة تشغيل الخدمة تحتاج تعديل الحالة لاحقًا بصلاحيتها.'
                        : 'يبقى كشف الحساب والقراءات والمرفقات محفوظًا. الأرشفة لا تسدّد المستحقات ولا تلغي الحركات السابقة.'}
                </Notice>
                {!restoring && (
                    <FormField id={`${id}-date`} label="تاريخ إنهاء الخدمة" error={errors.service_ended_on}>
                        <DateInput name="service_ended_on" value={data.service_ended_on} max={today} required onChange={(value) => setData('service_ended_on', value)} />
                    </FormField>
                )}
                <FormField id={`${id}-reason`} label={restoring ? 'سبب الاستعادة' : 'سبب إنهاء الخدمة والأرشفة'} error={errors.reason}>
                    <TextArea
                        value={data.reason}
                        required
                        maxLength={2000}
                        rows={3}
                        className="block w-full text-base"
                        placeholder={restoring ? 'اكتب سبب استعادة هذا الاشتراك…' : 'مثال: أنهى المشترك الخدمة نهائيًا وطلب إغلاق ملف الاشتراك.'}
                        onChange={(event) => setData('reason', event.target.value)}
                    />
                </FormField>
                <label className="flex cursor-pointer items-start gap-3 rounded-[14px] bg-(--ma-tile) p-4 text-base leading-7 text-(--ma-ink)">
                    <CheckBox checked={data.confirmed} onChange={(event) => setData('confirmed', event.target.checked)} />
                    <span>{restoring ? 'أؤكد استعادة هذا الاشتراك دون إعادة تفعيل الخدمة أو تغيير الرصيد.' : 'أؤكد انتهاء خدمة هذا الاشتراك، وقد راجعت رصيده والقراءات الخاصة به.'}</span>
                </label>
                <InputError message={errors.confirmed} />
                <InputError message={errors.archive} />
            </form>
        </DialogFrame>
    );
}
