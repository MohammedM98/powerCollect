import FormField from '@/Components/Form/FormField';
import FormSelect, { namedOptions } from '@/Components/Form/FormSelect';
import FormSection from '@/Components/Form/FormSection';
import SettingRow from '@/Components/Form/SettingRow';
import InputError from '@/Components/UI/InputError';
import { Switch, TextInput } from '@/Components/UI';

/**
 * The form's starting values: the branch's own when editing, otherwise
 * blank (and active).
 */
export function branchFormData(branch) {
    return {
        name: branch?.name ?? '',
        phone: branch?.phone ?? '',
        is_active: branch?.is_active ?? true,
        governorate_id: branch?.governorate_id ?? '',
        area_id: branch?.area_id ?? '',
    };
}

export default function BranchForm({ data, setData, errors, governorates, areas }) {
    const areasInGovernorate = data.governorate_id ? areas.filter((area) => String(area.governorate_id) === String(data.governorate_id)) : [];

    function onGovernorateChange(value) {
        setData((prev) => ({ ...prev, governorate_id: value, area_id: '' }));
    }

    return (
        <div className="space-y-6">
            <FormSection icon="building" title="بيانات الفرع" description="الاسم ورقم الهاتف" columns={2}>
                <FormField id="name" label="الاسم" required error={errors.name}>
                    <TextInput className="block w-full" value={data.name} autoFocus onChange={(e) => setData('name', e.target.value)} />
                </FormField>

                <FormField id="phone" label="الهاتف" error={errors.phone} hint="يظهر على الإيصالات المطبوعة.">
                    <TextInput dir="ltr" inputMode="tel" placeholder="059 000 0000" className="block w-full" value={data.phone} onChange={(e) => setData('phone', e.target.value)} />
                </FormField>
            </FormSection>

            <FormSection icon="pin" title="الموقع" description="المحافظة ثم المنطقة التابعة لها" columns={2}>
                <FormSelect
                    id="governorate_id"
                    label="المحافظة"
                    value={data.governorate_id}
                    onChange={onGovernorateChange}
                    options={namedOptions(governorates)}
                    placeholder="— بلا محافظة —"
                    emptyMessage="لا توجد محافظات بعد"
                    error={errors.governorate_id}
                />

                <FormSelect
                    id="area_id"
                    label="المنطقة"
                    value={data.area_id}
                    onChange={(value) => setData('area_id', value)}
                    options={namedOptions(areasInGovernorate)}
                    placeholder="— بلا منطقة —"
                    blockedMessage={data.governorate_id ? null : 'اختر محافظة أولاً'}
                    emptyMessage="لا توجد مناطق في هذه المحافظة بعد"
                    error={errors.area_id}
                />
            </FormSection>

            <div>
                <SettingRow title="فرع نشط" description="الفرع المتوقف لا يظهر بين الفروع ولا تُسجّل عليه دفعات.">
                    <Switch checked={data.is_active} onChange={(checked) => setData('is_active', checked)} ariaLabel="فرع نشط" />
                </SettingRow>
                <InputError message={errors.is_active} className="mt-1" />
            </div>
        </div>
    );
}
