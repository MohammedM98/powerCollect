import { useForm } from '@inertiajs/react';
import FormModal from '@/Components/Form/FormModal';
import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import SettingRow from '@/Components/Form/SettingRow';
import { Notice, Switch, TextInput } from '@/Components/UI';

export default function DomainModal({ branch, onClose, routingEnabled }) {
    const form = useForm({ domain: branch.domain ?? '', domain_enabled: Boolean(branch.domain_enabled) });
    return <FormModal show onClose={onClose} form={{ ...form, isEdit: true, save: (options) => form.put(`/branch-domains/${branch.id}`, options) }} title={`رابط الفرع، ${branch.name}`} icon="building" maxWidth="2xl">
        <FormSection icon="building" title="دومين الفرع" description="العنوان الذي يدخل منه موظفو هذا الفرع" columns={1}>
            <FormField id="domain" label="اسم الدومين" error={form.errors.domain} hint="مثل jenin.company.com — دون https أو مسار.">
                <TextInput dir="ltr" className="w-full" value={form.data.domain} onChange={(e) => form.setData('domain', e.target.value)} placeholder="jenin.company.com" autoComplete="off" />
            </FormField>
            <SettingRow title="السماح بالدخول من هذا الرابط" description={form.data.domain_enabled ? 'مفعّل: يفتح الرابط صفحة دخول هذا الفرع.' : 'متوقف: الرابط لا يفتح صفحة الدخول.'}>
                <Switch checked={form.data.domain_enabled} onChange={(value) => form.setData('domain_enabled', value)} ariaLabel="السماح بالدخول من هذا الرابط" />
            </SettingRow>
            <Notice tone="info">بعد الحفظ، اربط الدومين بالاستضافة وفعّل HTTPS. {routingEnabled ? 'توجيه الفروع مفعّل على هذا النظام.' : 'توجيه الدومينات غير مفعّل على هذا النظام بعد؛ يمكنك تجهيز الروابط قبل النشر.'}</Notice>
        </FormSection>
    </FormModal>;
}
