import FormField from '@/Components/Form/FormField';
import FormSection from '@/Components/Form/FormSection';
import { ChoiceSelect, Notice, SearchableSelect, TextInput } from '@/Components/UI';

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
            {canChooseBranch && (
                <FormField id="branch_id" label="الفرع" required error={errors.branch_id}>
                    {branches.length === 0 ? (
                        <Notice tone="warn">لا توجد فروع بعد — أنشئ فرعًا أولاً.</Notice>
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

            {canChooseBranch && (
                <FormField id="branch_area" label="المنطقة" lock="locked" hint="تتبع الفرع المختار ولا تُعدَّل من هنا.">
                    <TextInput readOnly value={resolvedAreaName || 'اختر فرعًا أولاً'} className="block w-full" />
                </FormField>
            )}

            {Boolean(resolvedAreaId) && (
                <FormField id="sub_area_id" label="منطقة 2" error={errors.sub_area_id}>
                    {subAreasInArea.length === 0 ? (
                        <Notice>لا توجد منطقة 2 في هذه المنطقة بعد.</Notice>
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
        </FormSection>
    );
}
