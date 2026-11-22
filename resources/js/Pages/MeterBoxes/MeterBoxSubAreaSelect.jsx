import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { router, useHttp } from '@inertiajs/react';
import FormSelect from '@/Components/Form/FormSelect';
import FormField from '@/Components/Form/FormField';
import { Notice, PrimaryKey, SecondaryKey, TextInput } from '@/Components/UI';

export default function MeterBoxSubAreaSelect({ id, value, onChange, onCreated, subAreas, areaId, canCreate, blockedMessage, error }) {
    const http = useHttp({ name: '' });
    const [adding, setAdding] = useState(false);
    const [failed, setFailed] = useState(false);
    const current = useRef(true);
    const options = [...subAreas]
        .sort((first, second) => first.name.localeCompare(second.name, 'ar'))
        .map((item) => ({ value: item.id, label: item.name, hint: item.isNew ? 'جديدة' : undefined }));

    const cancelSaving = useEffectEvent(() => http.cancel());

    useEffect(() => {
        current.current = true;
        return () => { current.current = false; cancelSaving(); };
    }, []);

    function startAdding(name) {
        http.clearErrors();
        http.setData('name', name);
        setFailed(false);
        setAdding(true);
    }

    async function save() {
        if (http.processing || !http.data.name.trim()) {
            return;
        }

        setFailed(false);
        http.transform((data) => ({ name: data.name.trim(), area_id: areaId }));
        try {
            const subArea = await http.post('/sub-areas');
            if (current.current && subArea) {
                onCreated(subArea);
                setAdding(false);
                http.reset();
                router.reload({ only: ['subAreas', 'filterOptions'] });
            }
        } catch (error) {
            if (current.current && error.response?.status !== 422) {
                setFailed(true);
            }
        }
    }

    return (
        <div className="space-y-2">
            <FormSelect
                id={id}
                label="منطقة الطبلون (منطقة 2)"
                searchable
                value={value}
                onChange={onChange}
                options={options}
                placeholder="— بلا منطقة 2 —"
                blockedMessage={blockedMessage}
                emptyMessage="لا توجد منطقة 2 في هذه المنطقة بعد"
                error={error}
                onCreate={canCreate && areaId && !blockedMessage ? startAdding : null}
                createLabel="إضافة منطقة جديدة"
            />
            {adding && <div className="ma-inline-add" role="group" aria-label="إضافة منطقة الطبلون">
                <FormField id={`${id}-new`} label="منطقة جديدة ضمن منطقة الفرع المختار" error={http.errors.name || http.errors.area_id || (failed ? 'تعذّر إضافة المنطقة. حاول مرة أخرى.' : null)}>
                    <TextInput
                        value={http.data.name}
                        onChange={(event) => { http.setData('name', event.target.value); http.clearErrors('name'); }}
                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); save(); } }}
                        disabled={http.processing}
                        maxLength={255}
                        autoFocus
                        placeholder="اسم المنطقة الجديدة"
                        className="block w-full"
                    />
                </FormField>
                <div className="flex flex-wrap justify-end gap-2">
                    <SecondaryKey onClick={() => setAdding(false)} disabled={http.processing}>إلغاء</SecondaryKey>
                    <PrimaryKey type="button" onClick={save} disabled={http.processing || !http.data.name.trim()}>{http.processing ? 'جارٍ الإضافة...' : 'إضافة واختيار المنطقة'}</PrimaryKey>
                </div>
            </div>}
            {!adding && subAreas.some((item) => item.isNew && String(item.id) === String(value)) && <Notice tone="success" role="status">أُضيفت المنطقة واختيرت للطبلون.</Notice>}
        </div>
    );
}
