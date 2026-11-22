import { useState } from 'react';
import { useForm, useHttp } from '@inertiajs/react';
import FormModal from '@/Components/Form/FormModal';
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import { plainDigits } from '@/lib/formValidation';
import { Notice, TextInput } from '@/Components/UI';

/** An empty value of a field, as it reads in the history. */
const EMPTY = '—';

/**
 * Who changed this person's details, when, and what each was before; it
 * loads when first opened. The details are shared by all their
 * subscriptions, so a change made from another branch is listed here too.
 */
function ChangeHistory({ subscriptionId }) {
    const http = useHttp();
    const [failed, setFailed] = useState(false);

    function load(event) {
        if (event.currentTarget.open && !http.response && !http.processing) {
            setFailed(false);
            http.get(`/subscriptions/${subscriptionId}/personal-details/history`).catch(() => setFailed(true));
        }
    }

    const changes = http.response?.data;

    return (
        <details onToggle={load} className="rounded-[14px] bg-(--ma-tile) px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold text-(--ma-ink)">سجل تعديل البيانات</summary>
            <div className="mt-2" aria-busy={http.processing}>
                {failed ? (
                    <p role="alert" className="text-(--ma-owe)">تعذّر تحميل السجل، أغلقه وافتحه مرة أخرى.</p>
                ) : changes === undefined ? (
                    <p className="text-(--ma-muted)">جارٍ التحميل...</p>
                ) : changes.length === 0 ? (
                    <p className="text-(--ma-muted)">لم تُعدَّل هذه البيانات منذ تسجيلها.</p>
                ) : (
                    <ol className="max-h-64 space-y-3 overflow-y-auto">
                        {changes.map((change) => (
                            <li key={change.id} className="border-b border-(--ma-line) pb-2 last:border-0">
                                <p className="text-xs text-(--ma-muted)">
                                    <span dir="ltr" className="font-display">{change.at}</span>
                                    {'، '}
                                    {change.userName ?? 'النظام'}
                                    {change.branchName ? ` (${change.branchName})` : ''}
                                </p>
                                <ul className="mt-1 space-y-1">
                                    {change.changes.map((field) => (
                                        <li key={field.field}>
                                            <span className="text-(--ma-muted)">{field.label}: </span>
                                            {/* Isolated, so names in another script do not turn the from → to order around. */}
                                            <bdi className="text-(--ma-muted) line-through">{field.from || EMPTY}</bdi>
                                            {' ← '}
                                            <bdi className="font-bold text-(--ma-ink)">{field.to || EMPTY}</bdi>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </details>
    );
}

/**
 * The quick "personal details" form from a subscription's row menu: name,
 * identity number, mobile number and address only. They belong to the
 * person, so the change reaches every subscription of theirs.
 */
export default function PersonalDetailsModal({ subscription, onClose }) {
    const form = useForm({
        full_name: subscription.full_name ?? '',
        national_id: subscription.national_id ?? '',
        phone: subscription.phone ?? '',
        address: subscription.address ?? '',
    });
    const save = (options) => form.patch(`/subscriptions/${subscription.id}/personal-details`, options);
    const subscriptions = subscription.subscriptionCount ?? 1;

    return (
        <FormModal show onClose={onClose} form={{ ...form, isEdit: true, save }} title="تعديل البيانات الشخصية" icon="pencil" maxWidth="lg">
            {subscriptions > 1 && (
                <Notice tone="info">
                    هذه البيانات مشتركة بين اشتراكات هذا الشخص (<bdi dir="ltr">{subscriptions}</bdi>)، وتتغير فيها كلها.
                </Notice>
            )}

            <FormSection icon="user" title="البيانات الشخصية" description="الاسم والهوية والجوال والعنوان" columns={2}>
                <FormField id="personal_full_name" label="الاسم الكامل" required error={form.errors.full_name} span="sm:col-span-2">
                    <TextInput
                        name="full_name"
                        required
                        className="block w-full"
                        value={form.data.full_name}
                        onChange={(event) => form.setData('full_name', event.target.value)}
                    />
                </FormField>

                <FormField id="personal_national_id" label="رقم الهوية" error={form.errors.national_id}>
                    <TextInput
                        name="national_id"
                        dir="ltr"
                        inputMode="numeric"
                        maxLength={9}
                        pattern="[0-9]{9}"
                        data-feedback
                        title="رقم الهوية يجب أن يتكون من 9 أرقام"
                        placeholder="9 أرقام"
                        className="block w-full"
                        value={form.data.national_id}
                        onChange={(event) => form.setData('national_id', plainDigits(event.target.value))}
                    />
                </FormField>

                <FormField id="personal_phone" label="رقم الجوال" error={form.errors.phone}>
                    <TextInput
                        name="phone"
                        type="tel"
                        dir="ltr"
                        inputMode="numeric"
                        maxLength={10}
                        pattern="05[69][0-9]{7}"
                        data-feedback
                        title="رقم الجوال يجب أن يتكون من 10 أرقام ويبدأ بـ 059 أو 056"
                        placeholder="059XXXXXXX"
                        className="block w-full"
                        value={form.data.phone}
                        onChange={(event) => form.setData('phone', plainDigits(event.target.value))}
                    />
                </FormField>

                <FormField id="personal_address" label="العنوان" error={form.errors.address} span="sm:col-span-2">
                    <TextInput
                        name="address"
                        className="block w-full"
                        value={form.data.address}
                        onChange={(event) => form.setData('address', event.target.value)}
                    />
                </FormField>
            </FormSection>

            <ChangeHistory subscriptionId={subscription.id} />
        </FormModal>
    );
}
