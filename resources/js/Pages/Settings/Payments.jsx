import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Chip } from '@heroui/react';
import SettingsLayout from '@/Layouts/SettingsLayout';
import PageHeader from '@/Components/PageHeader';
import InputError from '@/Components/UI/InputError';
import { SaveButton, SettingRow, SettingsSection, SettingsSelect, SettingsStatus } from '@/Components/Settings/SettingsKit';
import CurrencyRatesSection from './CurrencyRatesSection';
import BanksSection from './BanksSection';

const weekdays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** The week a box period covers, from its first day: each day a pill, the first and the closing day marked. */
function WeekStrip({ startsOn }) {
    const days = Array.from({ length: 7 }, (_, offset) => (Number(startsOn) + offset) % 7);

    return (
        <ol className="gl-set-week" aria-label={`الفترة من ${weekdays[days[0]]} إلى ${weekdays[days[6]]}`}>
            {days.map((day, index) => (
                <li key={day} data-edge={index === 0 ? 'start' : index === 6 ? 'end' : undefined}>
                    <b>{weekdays[day]}</b>
                    {index === 0 && <small>البداية</small>}
                    {index === 6 && <small>الإغلاق</small>}
                </li>
            ))}
        </ol>
    );
}

export default function Payments({ currencies, banks, storeUrl, boxPeriod, canManagePaymentCatalog }) {
    const { status } = usePage().props;
    const form = useForm({ week_starts_on: boxPeriod.week_starts_on, branch_id: boxPeriod.branch?.id ?? null });
    const scopeLabel = boxPeriod.branch ? `لفرع ${boxPeriod.branch.name} فقط` : 'الإعداد الافتراضي للفروع التي ليس لها إعداد خاص';

    function savePeriod(event) {
        event.preventDefault();
        form.put(boxPeriod.updateUrl, { preserveScroll: true, onSuccess: () => form.setDefaults() });
    }

    return <SettingsLayout header={<PageHeader title="إعدادات الدفعات" info="فترات الصناديق المالية، وأسعار صرف العملات، والبنوك والمحافظ التي تُستلم بها الدفعات." />}>
        <Head title="إعدادات الدفعات" />
        <div className="gl-set-page">
            <SettingsStatus message={status} />

            <SettingsSection
                id="box-period"
                icon="calendar"
                tone="clr"
                title="فترات الصناديق المالية"
                description="تُعرض الصناديق المغلقة في فترات أسبوعية حسب تاريخ إغلاقها، دون تغيير حركاتها أو مبالغها. عند بداية الفترة الجديدة تُغلق صناديق الفترة المنتهية تلقائيًا وتظهر لقسم التدقيق، دون اعتماد التدقيق تلقائيًا."
                aside={<Chip size="sm" variant="soft" className="gl-set-chip">{boxPeriod.branch ? `فرع ${boxPeriod.branch.name}` : 'الإعداد الافتراضي للشركة'}</Chip>}
            >
                <form onSubmit={savePeriod} className="gl-set-form">
                    {boxPeriod.canSelectBranch ? (
                        <SettingRow label="نطاق الإعداد" hint="اختر فرعًا ليكون له يوم بداية خاص، أو اترك الإعداد الافتراضي للشركة.">
                            <SettingsSelect
                                label="نطاق الإعداد"
                                value={boxPeriod.branch?.id ?? ''}
                                options={[{ value: '', label: 'الإعداد الافتراضي للشركة' }, ...boxPeriod.branches]}
                                onChange={(value) => router.get(boxPeriod.indexUrl, value === '' ? {} : { branch: value }, { preserveScroll: true })}
                            />
                        </SettingRow>
                    ) : (
                        <SettingRow label="نطاق الإعداد" hint="تُطبّق هذه الإعدادات على فرعك فقط.">
                            <b className="gl-set-value">إعدادات فرع {boxPeriod.branch.name}</b>
                        </SettingRow>
                    )}
                    <SettingRow
                        label="يوم بداية الفترة الأسبوعية"
                        hint={boxPeriod.followsCompany ? 'يتبع هذا الفرع الإعداد الافتراضي للشركة حاليًا. عند الحفظ يُصبح له يوم بداية خاص به.' : `من ${weekdays[form.data.week_starts_on]} إلى ${weekdays[(Number(form.data.week_starts_on) + 6) % 7]}، ${scopeLabel}.`}
                    >
                        <SettingsSelect label="يوم بداية الفترة الأسبوعية" name="week_starts_on" value={form.data.week_starts_on} options={weekdays.map((label, value) => ({ value, label }))} onChange={(value) => form.setData('week_starts_on', Number(value))} />
                        <InputError message={form.errors.week_starts_on} className="mt-2" />
                    </SettingRow>
                    <WeekStrip startsOn={form.data.week_starts_on} />
                    <div className="gl-set-actions">
                        <SaveButton processing={form.processing} isDisabled={!form.isDirty && !boxPeriod.followsCompany}>حفظ بداية الفترة</SaveButton>
                    </div>
                </form>
            </SettingsSection>

            {canManagePaymentCatalog && <>
                <CurrencyRatesSection currencies={currencies} />
                <BanksSection banks={banks} storeUrl={storeUrl} />
            </>}
        </div>
    </SettingsLayout>;
}
