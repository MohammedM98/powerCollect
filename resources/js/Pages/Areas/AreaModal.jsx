import FormModal from '@/Components/Form/FormModal';
import { useResourceForm } from '@/hooks/useResourceForm';
import AreaForm, { areaFormData } from './AreaForm';

export default function AreaModal({ show, onClose, area, governorates, defaultGovernorateId = '' }) {
    const form = useResourceForm('/areas', area, areaFormData(area, defaultGovernorateId));

    return (
        <FormModal show={show} onClose={onClose} form={form} title={form.isEdit ? 'تعديل المنطقة' : 'منطقة جديدة'} icon="map" maxWidth="md" description="تظهر عند تسجيل المشتركين والطبلونات.">
            <AreaForm data={form.data} setData={form.setData} errors={form.errors} governorates={governorates} />
        </FormModal>
    );
}
