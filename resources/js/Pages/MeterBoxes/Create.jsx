import { useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import FormPage from '@/Components/FormPage';
import SettingsLayout from '@/Layouts/SettingsLayout';
import { useResourceForm } from '@/hooks/useResourceForm';
import MeterBoxForm, { meterBoxFormData } from './MeterBoxForm';

export default function Create({ branches, canChooseBranch, canCreateSubArea, governorates, areas, subAreas, currentBranchAreaId }) {
    const canViewList = Boolean(usePage().props.can?.viewMeterBoxes);
    useEffect(() => {
        if (canViewList) router.get('/meter-boxes', { create: '1' }, { replace: true });
    }, [canViewList]);
    const form = useResourceForm('/meter-boxes', null, meterBoxFormData(null));

    if (canViewList) return <p className="p-5 text-gray-600" role="status">جارٍ فتح النافذة…</p>;

    return (
        <FormPage layout={SettingsLayout} title="إنشاء طبلون" form={form} cancelHref="/meter-boxes" widthClass="max-w-4xl">
            <MeterBoxForm
                data={form.data}
                setData={form.setData}
                errors={form.errors}
                branches={branches}
                canChooseBranch={canChooseBranch}
                canCreateSubArea={canCreateSubArea}
                governorates={governorates}
                areas={areas}
                subAreas={subAreas}
                currentBranchAreaId={currentBranchAreaId}
            />
        </FormPage>
    );
}
