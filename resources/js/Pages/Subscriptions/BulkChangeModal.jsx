import { useCallback, useId, useRef, useState } from 'react';
import { router, useHttp, usePage } from '@inertiajs/react';
import DialogFrame from '@/Components/UI/DialogFrame';
import FormField from '@/Components/Form/FormField';
import Icon from '@/Components/UI/Icon';
import ChoiceChips from '@/Components/UI/ChoiceChips';
import InputError from '@/Components/UI/InputError';
import { normalizeDecimalInput } from '@/lib/format';
import { Notice, PrimaryKey, SearchableSelect, SecondaryKey, TextInput } from '@/Components/UI';

const TITLES = {
    minimum_charge: { title: 'تغيير الحد الأدنى', icon: 'wallet' },
    status: { title: 'تغيير الحالة', icon: 'flag' },
    meter_box_id: { title: 'نقل إلى طبلون آخر', icon: 'grid' },
};

const MINIMUM_MODES = [
    { value: 'amount', label: 'مبلغ محدد', icon: 'dollar' },
    { value: 'circuit_breaker', label: 'حد القاطع لكل مشترك', icon: 'bolt' },
];

const STATUS_ICONS = { active: 'check', suspended: 'clock', disconnected: 'power' };

/**
 * Set one field — the weekly minimum charge or the status — for every
 * chosen subscription (`selection`: the ticked ids, or every match of the
 * list's filters), after saying how many it reaches. The change is kept
 * in the bulk changes log and can be undone from there.
 */
export default function BulkChangeModal({ field, selection, count, statusOptions, selectionLabel = '', onClose, onDone }) {
    const id = useId();
    const { errors } = usePage().props;
    const [mode, setMode] = useState('amount');
    const [value, setValue] = useState(field === 'status' ? (statusOptions[0]?.value ?? '') : '');
    const [saving, setSaving] = useState(false);
    const [reviewing, setReviewing] = useState(false);
    const [selectedBox, setSelectedBox] = useState(null);
    const http = useHttp();
    const httpRef = useRef(http);
    httpRef.current = http;
    const loadMeterBoxes = useCallback(async (search) => {
        const response = await httpRef.current.get(`/meter-boxes/options?${new URLSearchParams({ search })}`);
        return { options: response.data, hasMore: response.hasMore };
    }, []);
    const { title, icon } = TITLES[field];
    const needsValue = field !== 'minimum_charge' || mode === 'amount';
    const validValue = field !== 'minimum_charge' || mode !== 'amount' || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 100000);

    function apply(event) {
        event.preventDefault();
        if (saving || !validValue || (needsValue && value === '')) {
            return;
        }
        if (!reviewing) {
            setReviewing(true);
            return;
        }
        setSaving(true);
        router.post(
            '/subscriptions/bulk-changes',
            { field, mode: field === 'minimum_charge' ? mode : undefined, value: needsValue ? value : undefined, expected_count: count, ...selection },
            { preserveScroll: true, onSuccess: onDone, onError: () => setReviewing(false), onFinish: () => setSaving(false) },
        );
    }

    const footer = (
        <>
            <SecondaryKey disabled={saving} onClick={onClose}>إلغاء</SecondaryKey>
            {reviewing && <SecondaryKey disabled={saving} onClick={() => setReviewing(false)}>تعديل القيمة</SecondaryKey>}
            <PrimaryKey type="submit" form={id} disabled={saving || !validValue || (needsValue && value === '')} aria-busy={saving}>
                <Icon name="check" className="h-4 w-4" />
                {saving ? 'جارٍ التطبيق...' : reviewing ? `تأكيد التطبيق على ${count.toLocaleString('en')} اشتراك` : 'مراجعة التعديل'}
            </PrimaryKey>
        </>
    );

    const reach = (
        <>
            يُطبَّق على <bdi dir="ltr" className="font-bold text-(--ma-ink)">{count.toLocaleString('en')}</bdi> اشتراك
            {selection.all ? ' (كل النتائج المطابقة للبحث والفلاتر)' : ' محدد'}. من كانت قيمته نفسها لا يتغير.
        </>
    );

    return (
        <DialogFrame show onClose={onClose} title={title} description={reach} icon={icon} maxWidth="lg" busy={saving} footer={footer}>
            <form id={id} onSubmit={apply} className="ma-form space-y-4">
                {selectionLabel && <Notice tone="brand">{selectionLabel}</Notice>}
                {reviewing ? (
                    <Notice
                        tone="info"
                        title="مراجعة التعديل"
                    >
                        <p className="text-base leading-8">{field === 'meter_box_id' ? `الطبلون الجديد: ${selectedBox?.label}` : field === 'minimum_charge' ? mode === 'amount' ? `الحد الأدنى الأسبوعي الجديد: ${value} شيكل` : 'الحد الأدنى الجديد: حد القاطع الخاص بكل اشتراك' : `الحالة الجديدة: ${statusOptions.find((option) => option.value === value)?.label}`}</p>
                        {field === 'meter_box_id' && <p className="text-sm text-(--ma-muted)">{selectedBox?.hint}</p>}
                        <p className="mt-2 text-sm leading-7 text-(--ma-muted)">سيُحفظ التعديل في سجل التعديلات الجماعية، مع القيمة السابقة والجديدة لكل اشتراك.{field === 'minimum_charge' && ' الفواتير والحركات السابقة تبقى كما هي.'}{field === 'meter_box_id' && ' الأرصدة والقراءات والحركات المالية تبقى كما هي.'}</p>
                    </Notice>
                ) : field === 'meter_box_id' ? (
                    <FormField
                        id={`${id}-box`}
                        label="الطبلون الجديد"
                        error={errors.value}
                        hint="اختر طبلونًا من فرع الاشتراكات المحددة. الاشتراكات الموجودة فيه بالفعل تبقى كما هي."
                    >
                        <SearchableSelect
                            portal
                            value={value}
                            onChange={(next, option) => { setValue(next); setSelectedBox(option ?? null); }}
                            options={selectedBox ? [selectedBox] : []}
                            loadOptions={loadMeterBoxes}
                            placeholder="اختر الطبلون الجديد"
                            searchPlaceholder="ابحث باسم الطبلون أو رقمه..."
                        />
                    </FormField>
                ) : field === 'minimum_charge' ? (
                    <>
                        <ChoiceChips options={MINIMUM_MODES} value={mode} onChange={setMode} label="طريقة تحديد الحد الأدنى" />
                        {mode === 'amount' ? (
                            <FormField id={`${id}-value`} label="الحد الأدنى الأسبوعي الجديد (شيكل)" error={errors.value}>
                                <TextInput
                                    type="text"
                                    inputMode="decimal"
                                    dir="ltr"
                                    value={value}
                                    onChange={(e) => setValue(normalizeDecimalInput(e.target.value))}
                                    className="block w-full"
                                    autoFocus
                                />
                            </FormField>
                        ) : (
                            <Notice>يأخذ كل مشترك الحد الأدنى لقاطعه. من ليس له قاطع لا يتغير.</Notice>
                        )}
                        <p className="ma-field-hint">يسري على القراءات القادمة فقط؛ القراءات المسجلة تبقى كما هي.</p>
                    </>
                ) : (
                    <ChoiceChips
                        options={statusOptions.map((option) => ({ ...option, icon: STATUS_ICONS[option.value] }))}
                        value={value}
                        onChange={setValue}
                        label="الحالة الجديدة"
                    />
                )}
                <InputError message={errors.ids} />
                <InputError message={errors.expected_count} />
            </form>
        </DialogFrame>
    );
}
