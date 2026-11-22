import { TextArea } from '@heroui/react';
import FormModal from '@/Components/Form/FormModal';
import FormField from '@/Components/Form/FormField';
import SettingRow from '@/Components/Form/SettingRow';
import { useResourceForm } from '@/hooks/useResourceForm';
import { consumptionBetween } from '@/lib/readings';
import { formatDate } from '@/lib/format';
import { ChoiceSelect, Notice, SearchableSelect, Switch, TextInput } from '@/Components/UI';

const APPROVED_READING_WARNING = 'هذه القراءة معتمدة. تعديلها يعيدها إلى قيد المراجعة ويزيل مبلغها من المعاملات المالية للمشترك حتى يُعاد اعتمادها.';
const APPROVE_NOW_NOTE = 'هذه القراءة معتمدة. سيُلغى مبلغها السابق بقيد عكسي يبقى في الكشف، وتُعتمد القراءة المصحّحة ويُحمَّل مبلغها الجديد فورًا.';

function Summary({ label, value, negative = false }) {
    return (
        <div className="min-w-0 rounded-[14px] bg-(--ma-tile) px-4 py-2 text-center">
            <p className="text-xs text-(--ma-muted)">{label}</p>
            <p className={`mt-1 wrap-break-word text-center font-display text-base font-bold tabular-nums ${negative ? 'text-(--ma-owe)' : 'text-(--ma-brand)'}`}>
                <bdi dir="ltr">{value}</bdi>
            </p>
        </div>
    );
}

/**
 * Enter or correct a weekly reading. `fixedSubscription` (an option shaped
 * like `subscriptionOptions` entries) pins the form to one subscription, as
 * when it is opened from that subscription's statement. A reading that
 * says `canApprove` (the statement's) offers to approve the correction at
 * once instead of sending it back for approval.
 */
export default function MeterReadingModal({ show, onClose, reading, subscriptionOptions = [], fixedSubscription = null, weekOptions }) {
    const offersApproval = Boolean(reading?.status === 'approved' && reading?.canApprove);
    const form = useResourceForm(
        '/meter-readings',
        reading,
        reading
            ? { current_reading: reading.requiresReentry ? '' : String(reading.current_reading), notes: reading.notes ?? '', ...(offersApproval ? { approve: true } : {}) }
            : { subscription_id: fixedSubscription?.value ?? '', week_start: weekOptions[0]?.value ?? '', current_reading: '', notes: '' },
    );
    const { data, setData, errors, isEdit } = form;
    const approvesNow = offersApproval && data.approve;

    const selectedSubscription = isEdit ? null : (fixedSubscription ?? subscriptionOptions.find((option) => option.value === String(data.subscription_id)));
    const previousReading = isEdit ? reading.previous_reading : selectedSubscription?.lastReading;
    const hasPrevious = previousReading !== undefined && previousReading !== null;
    const consumption = hasPrevious && data.current_reading !== '' ? consumptionBetween(previousReading, data.current_reading) : null;

    return (
        <FormModal
            show={show}
            onClose={onClose}
            form={form}
            title={isEdit ? 'تعديل القراءة' : 'إدخال قراءة'}
            icon="bolt"
            visitOptions={{ preserveState: true }}
            bodyClassName="space-y-4"
            // Readings are entered one after another, so they save without a confirmation step —
            // except correcting an approved one, which sends it back for approval.
            confirmBeforeSave={isEdit && reading.status === 'approved'}
            saveConfirmMessage={`${approvesNow ? APPROVE_NOW_NOTE : APPROVED_READING_WARNING} هل تريد المتابعة؟`}
        >
            {isEdit ? (
                <Notice title={reading.subscriptionName}>
                    <bdi dir="ltr">{reading.accountNumber}</bdi>، الأسبوع {formatDate(reading.weekStart)} ← {formatDate(reading.weekEnd)}
                </Notice>
            ) : (
                <>
                    {fixedSubscription ? (
                        <Notice title={fixedSubscription.label} />
                    ) : (
                        <FormField label="المشترك" error={errors.subscription_id}>
                            <SearchableSelect
                                value={data.subscription_id}
                                onChange={(value) => setData('subscription_id', value)}
                                options={subscriptionOptions}
                                placeholder="اختر مشتركًا"
                                searchPlaceholder="بحث بالاسم أو رقم الاشتراك..."
                                emptyLabel="لا يوجد مشتركون مطابقون"
                            />
                        </FormField>
                    )}

                    <FormField
                        id="week_start"
                        label="الأسبوع"
                        error={errors.week_start}
                        hint={selectedSubscription?.lastWeekStart ? `آخر قراءة مسجلة لأسبوع يبدأ في ${selectedSubscription.lastWeekStart}` : undefined}
                    >
                        <ChoiceSelect className="block w-full" value={data.week_start} onChange={(e) => setData('week_start', e.target.value)}>
                            {weekOptions.map((week) => (
                                <option key={week.value} value={week.value}>
                                    {week.label}
                                </option>
                            ))}
                        </ChoiceSelect>
                    </FormField>
                </>
            )}

            <div className={`grid items-start gap-4 ${hasPrevious ? 'sm:grid-cols-2' : ''}`}>
                {hasPrevious && (
                    <FormField id="previous_reading" label="القراءة السابقة" lock="locked" hint="من آخر قراءة مسجّلة؛ لا تُعدَّل من هنا.">
                        <TextInput dir="ltr" readOnly value={previousReading} className="block w-full font-display text-xl font-semibold" />
                    </FormField>
                )}
                <FormField id="current_reading" label="القراءة الحالية" error={errors.current_reading}>
                    <TextInput
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        dir="ltr"
                        className="block w-full font-display text-xl font-semibold"
                        value={data.current_reading}
                        autoFocus={isEdit}
                        onChange={(e) => setData('current_reading', e.target.value)}
                    />
                </FormField>
            </div>

            {hasPrevious && <Summary label="الاستهلاك (كيلو)" value={consumption ?? '—'} negative={consumption !== null && consumption < 0} />}

            {offersApproval && (
                <SettingRow
                    title="اعتماد القراءة المصحّحة الآن"
                    description={data.approve
                        ? 'يُحمَّل المبلغ الجديد على الحساب مباشرة، دون انتظار المراجعة.'
                        : 'تعود القراءة إلى قيد المراجعة، ولا يُحمَّل مبلغها حتى يعتمدها أحد المعتمِدين.'}
                >
                    <Switch checked={data.approve} onChange={(checked) => setData('approve', checked)} ariaLabel="اعتماد القراءة المصحّحة الآن" />
                </SettingRow>
            )}

            <FormField id="notes" label="ملاحظات" error={errors.notes}>
                <TextArea rows={2} className="block w-full" value={data.notes} onChange={(e) => setData('notes', e.target.value)} />
            </FormField>
        </FormModal>
    );
}
