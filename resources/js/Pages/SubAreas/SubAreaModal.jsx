import FormModal from '@/Components/Form/FormModal';
import { useResourceForm } from '@/hooks/useResourceForm';
import SubAreaForm, { subAreaFormData } from './SubAreaForm';

export default function SubAreaModal({ show, onClose, subArea, areas, defaultAreaId = '', allowNoArea = true }) {
    const form = useResourceForm('/sub-areas', subArea, subAreaFormData(subArea, defaultAreaId));

    return (
        <FormModal show={show} onClose={onClose} form={form} title={form.isEdit ? 'تعديل منطقة 2' : 'منطقة 2 جديدة'} icon="map" maxWidth="md" description="تظهر عند تسجيل المشتركين والطبلونات.">
            <SubAreaForm data={form.data} setData={form.setData} errors={form.errors} areas={areas} allowNoArea={allowNoArea} />
        </FormModal>
    );
}
