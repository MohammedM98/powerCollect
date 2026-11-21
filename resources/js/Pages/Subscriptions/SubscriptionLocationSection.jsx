import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import InputLabel from '@/Components/InputLabel';
import Icon from '@/Components/Icon';
import { ChoiceSelect, SearchableSelect, TextInput } from '@/Components/UI';

function ReadOnlyField({ id, label, value, dir }) {
    return (
        <div>
            <InputLabel htmlFor={id} value={label} />
            <div className="relative mt-1" dir={dir}>
                <TextInput id={id} readOnly value={value} title="للقراءة فقط" className="w-full bg-gray-50 field-room-end text-gray-600" />
                <FieldLock />
            </div>
        </div>
    );
}

/** Where the subscription is: governorate, area, sub-area and meter box, and the meter's first reading. */
export default function SubscriptionLocationSection({
    branches,
    canChooseBranch,
    data,
    errors,
    isEdit,
    loadMeterBoxes,
    onBranchChange,
    onMeterBoxChange,
    onSubAreaChange,
    resolvedAreaId,
    resolvedAreaName,
    selectedBox,
    showMeterBoxField,
    subAreaId,
    subAreasInArea,
}) {
    return (
        <FormSection icon="pin" title="الموقع والعداد" description="الفرع والمنطقة والطبلون">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-3">
                {canChooseBranch && (
                    <FormField id="branch_id" label="الفرع" required error={errors.branch_id}>
                        {branches.length === 0 ? (
                            <p className="text-sm text-gray-500">لا توجد فروع بعد — أنشئ فرعًا أولاً.</p>
                        ) : (
                            <ChoiceSelect required className="block w-full" value={data.branch_id} onChange={(e) => onBranchChange(e.target.value)}>
                                <option value="">— اختر فرعًا —</option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.name}
                                    </option>
                                ))}
                            </ChoiceSelect>
                        )}
                    </FormField>
                )}

                {canChooseBranch && <ReadOnlyField id="branch_area" label="المنطقة" value={resolvedAreaName || 'اختر فرعًا أولاً لعرض منطقته.'} />}

                {Boolean(resolvedAreaId) && (
                    <FormField id="sub_area_id" label="منطقة 2" error={errors.sub_area_id}>
                        {subAreasInArea.length === 0 ? (
                            <p className="text-sm text-gray-500">لا توجد منطقة 2 في هذه المنطقة بعد.</p>
                        ) : (
                            <SearchableSelect
                                id="sub_area_id"
                                value={subAreaId}
                                onChange={onSubAreaChange}
                                options={subAreasInArea.map((subArea) => ({ value: String(subArea.id), label: subArea.name }))}
                                placeholder={isEdit ? '— بلا منطقة 2 —' : '— اختر منطقة 2 —'}
                                searchPlaceholder="بحث في المناطق..."
                                emptyLabel="لا توجد مناطق مطابقة"
                                active={Boolean(subAreaId)}
                            />
                        )}
                    </FormField>
                )}

                {showMeterBoxField && (
                    <FormField id="meter_box_id" label="الطبلون (الاسم والرقم)" error={errors.meter_box_id}>
                        <SearchableSelect
                            value={data.meter_box_id}
                            onChange={onMeterBoxChange}
                            options={selectedBox ? [selectedBox] : []}
                            loadOptions={loadMeterBoxes}
                            searchPlaceholder="بحث عن طبلون..."
                            emptyLabel="لا توجد طبلونات مطابقة"
                        />
                    </FormField>
                )}
            </div>
        </FormSection>
    );
}

// A value the form shows but never lets the user edit directly (it's
// derived from another selection, like the branch's area).
export function FieldLock() {
    return (
        <span className="pointer-events-none absolute inset-y-0 inset-e-3 flex items-center text-gray-400" aria-hidden="true">
            <Icon name="lock" className="h-4 w-4" />
        </span>
    );
}
