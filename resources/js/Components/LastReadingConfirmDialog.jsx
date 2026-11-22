import { Notice } from '@/Components/UI';
import RadioCards from '@/Components/UI/RadioCards';
import CheckBox from '@/Components/UI/CheckBox';
import { TextArea } from '@heroui/react';
import { useEffect, useId, useState } from 'react';
import DialogFrame from '@/Components/UI/DialogFrame';
import PrimaryButton from '@/Components/UI/PrimaryButton';
import SecondaryButton from '@/Components/UI/SecondaryButton';
import InputError from '@/Components/UI/InputError';
import TextInput from '@/Components/UI/TextInput';
import { formatMoney } from '@/lib/format';

const PURPOSES = [
    { value: 'correction', label: 'تصحيح خطأ إدخال', hint: 'إعادة حساب الفاتورة بالقراءة الصحيحة.' },
    { value: 'meter_change', label: 'عداد جديد / مستبدل', hint: 'الفاتورة السابقة محفوظة، والبداية من العداد الجديد.' },
];

/** Purpose, value, then the financial effect; the current reading is entered later in the table. */
export default function LastReadingConfirmDialog({ editor, subscriptionName }) {
    const id = useId();
    const [confirmedUnusual, setConfirmedUnusual] = useState(false);
    const preview = editor.preview;
    const week = preview?.weeks?.[0];
    const meterChange = editor.adjustmentType === 'meter_change';
    const unusual = !meterChange && week?.isApproved && week?.unusual;
    const phase = editor.phase;
    const steps = ['reason', 'reading', 'review'];
    const stepIndex = steps.indexOf(phase);
    const purpose = PURPOSES.find((option) => option.value === editor.adjustmentType);
    const formId = `${id}-form`;

    useEffect(() => setConfirmedUnusual(false), [preview]);

    function submit(event) {
        event.preventDefault();
        if (phase === 'reason') editor.beginReading();
        else if (phase === 'reading') editor.review();
        else editor.confirm({ confirmUnusual: confirmedUnusual });
    }

    return <DialogFrame show={Boolean(phase)} onClose={editor.cancel} busy={editor.saving} title="تعديل القراءة السابقة" description={subscriptionName} icon="pencil" maxWidth="2xl" footer={<>
        <SecondaryButton onClick={phase === 'reason' ? editor.cancel : editor.back} disabled={editor.saving}>{phase === 'reason' ? 'إلغاء' : 'رجوع'}</SecondaryButton>
        <PrimaryButton type="submit" form={formId} disabled={editor.saving || (phase === 'reason' && !editor.canContinue) || (phase === 'review' && (!preview || (unusual && !confirmedUnusual)))}>{editor.saving ? 'جارٍ المعالجة…' : phase === 'reason' ? 'متابعة' : phase === 'reading' ? 'مراجعة التعديل' : meterChange ? 'حفظ نقطة البداية' : 'حفظ التصحيح'}</PrimaryButton>
    </>}>
        <ol aria-label="خطوات تعديل القراءة" className="grid grid-cols-3 gap-2 text-sm sm:gap-6">
            {['سبب التعديل', 'القراءة', 'المراجعة'].map((label, index) => <li key={label} aria-current={index === stepIndex ? 'step' : undefined} className={`flex flex-col items-center gap-2 text-center sm:flex-row sm:text-start ${index === stepIndex ? 'font-semibold text-(--ma-brand)' : 'text-(--ma-muted)'}`}><span className={index === stepIndex ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--ma-brand-soft)' : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--ma-tile)'}>{index + 1}</span>{label}</li>)}
        </ol>
        <form id={formId} onSubmit={submit} noValidate className="space-y-6">
            {phase === 'reason' && <>
                <fieldset className="space-y-3">
                    <legend className="mb-3 text-lg font-bold text-(--ma-ink)">لماذا تريد تعديل القراءة؟</legend>
                    <RadioCards
                        label="لماذا تريد تعديل القراءة؟"
                        name={`${id}-purpose`}
                        className="space-y-3"
                        value={editor.adjustmentType}
                        onChange={editor.chooseType}
                        controlClassName="mt-2 shrink-0"
                        options={PURPOSES.map((option) => ({ value: option.value, label: <span><b className="block text-lg text-(--ma-ink)">{option.label}</b><span className="mt-1 block text-base text-(--ma-muted)">{editor.isInitial ? 'تعديل قراءة بداية الاشتراك التي تبدأ منها القراءة الحالية.' : option.hint}</span></span> }))}
                        itemClassName={(option, selected) => `flex cursor-pointer items-start gap-3 rounded-control border p-4 transition ${selected ? 'border-(--ma-brand) bg-(--ma-brand-soft)' : 'border-(--ma-line) hover:border-(--ma-faint)'}`}
                    />
                </fieldset>
                {meterChange && <div>
                    <label htmlFor={`${id}-reason`} className="mb-2 block text-base font-semibold text-(--ma-ink)">سبب تغيير العداد <span className="text-(--ma-owe)">*</span></label>
                    <TextArea id={`${id}-reason`} value={editor.reason} onChange={(event) => editor.setReason(event.target.value)} maxLength={1000} required rows={3} className="block w-full rounded-control border-(--ma-line) text-base leading-8" placeholder="سرقة، تلف، أو استبدال العداد…" />
                </div>}
            </>}
            {phase === 'reading' && <>
                <p className="text-base font-semibold text-(--ma-brand)">{purpose?.label}</p>
                <div className="flex items-baseline justify-between gap-3 border-b border-(--ma-line) pb-4"><span>القراءة المسجلة</span><bdi dir="ltr" className="font-display text-2xl font-semibold text-(--ma-ink)">{formatMoney(editor.savedValue)} <span className="text-base font-normal">كيلو</span></bdi></div>
                <div>
                    <label htmlFor={`${id}-reading`} className="mb-3 block text-lg font-bold text-(--ma-ink)">{meterChange ? 'قراءة بداية العداد الجديد' : 'القراءة الصحيحة'}</label>
                    <div className="flex items-center gap-3" dir="ltr">
                        <SecondaryButton aria-label="إنقاص القراءة السابقة" onClick={() => editor.step(-1)} disabled={editor.saving || Number(editor.value) <= Number(meterChange ? 0 : editor.floor)} className="h-14 w-14 shrink-0 px-0! text-2xl!">−</SecondaryButton>
                        <TextInput {...editor.inputProps} id={`${id}-reading`} aria-label="القراءة السابقة الجديدة" className="h-14 min-w-0 flex-1 py-3 text-center! font-display text-2xl!" />
                        <SecondaryButton aria-label="زيادة القراءة السابقة" onClick={() => editor.step(1)} disabled={editor.saving} className="h-14 w-14 shrink-0 px-0! text-2xl!">+</SecondaryButton>
                    </div>
                    {!meterChange && !editor.isInitial && <p className="mt-3 text-base text-(--ma-muted)">بداية الفترة: <bdi dir="ltr">{formatMoney(editor.floor)}</bdi> كيلو.</p>}
                </div>
            </>}
            {phase === 'review' && preview && <>
                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-(--ma-line) rounded-control bg-(--ma-tile) py-4 text-center">
                    <div className="min-w-0 px-3"><p className="text-base text-(--ma-muted)">قبل التعديل</p><bdi dir="ltr" className="mt-2 block wrap-break-word text-center font-display text-2xl font-semibold text-(--ma-muted)">{formatMoney(preview.before)}</bdi></div>
                    <div className="min-w-0 px-3"><p className="text-base text-(--ma-muted)">بعد التعديل</p><bdi dir="ltr" className="mt-2 block wrap-break-word text-center font-display text-2xl font-bold text-(--ma-ink)">{formatMoney(preview.after)}</bdi></div>
                </div>
                <div><b className="text-(--ma-ink)">{purpose?.label}</b>{meterChange && <p className="mt-1 whitespace-pre-wrap text-base">{editor.reason}</p>}</div>
                {editor.isInitial ? <Notice tone="success">هذه قراءة بداية الاشتراك، ولا توجد فاتورة سابقة لتعديلها.</Notice> : meterChange ? <Notice tone="success">الفاتورة السابقة وحركاتها محفوظة كما هي.</Notice> : week && <dl className="space-y-2 border-y border-(--ma-line) py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2"><dt>الاستهلاك المصحّح</dt><dd className="font-semibold text-(--ma-ink)"><bdi dir="ltr">{formatMoney(week.after.consumption)}</bdi> كيلو</dd></div>
                    <div className="flex flex-wrap items-center justify-between gap-2"><dt>قيمة الفاتورة</dt><dd><bdi dir="ltr" className="me-2 text-(--ma-muted) line-through">{formatMoney(week.before.amountDue)}</bdi><bdi dir="ltr" className="font-display text-xl font-bold text-(--ma-ink)">{formatMoney(week.after.amountDue)}</bdi> ₪</dd></div>
                </dl>}
                <p className="font-semibold text-(--ma-ink)">أدخل القراءة الحالية لاحقًا من خانتها في الجدول.</p>
                {Number(preview.removedCurrentAmount ?? 0) !== 0 && <p className="text-base">مبلغ الحالية الذي سيُلغى لحين إعادة إدخالها واعتمادها: <bdi dir="ltr" className="font-semibold text-(--ma-ink)">{formatMoney(preview.removedCurrentAmount)}</bdi> ₪.</p>}
                {(week?.isApproved && !meterChange || preview.clearsCurrentReading) && <details className="text-base">
                    <summary className="cursor-pointer font-semibold text-(--ma-ink)">تفاصيل الأثر المالي</summary>
                    <ul className="mt-3 list-inside list-disc space-y-2">
                        {!meterChange && week?.isApproved && <li>يُلغى المبلغ القديم بقيد عكسي محفوظ، ثم تُعتمد الفاتورة المصحّحة.</li>}
                        {preview.clearsCurrentReading && <li>تُفرّغ خانة الحالية، ويُحفظ الرقم القديم في سجل التعديلات.</li>}
                        {Number(preview.removedCurrentAmount ?? 0) !== 0 && <li>يُلغى مبلغ الحالية السابق ({formatMoney(preview.removedCurrentAmount)} ₪) حتى إدخالها واعتمادها مجددًا.</li>}
                    </ul>
                </details>}
                {unusual && <Notice tone="warn"><label className="flex cursor-pointer items-start gap-3"><CheckBox checked={confirmedUnusual} onChange={(event) => setConfirmedUnusual(event.target.checked)} />أؤكد صحة الاستهلاك رغم أنه أعلى من المعتاد.</label></Notice>}
            </>}
            {editor.error && <div role="alert"><InputError message={editor.error} /></div>}
        </form>
    </DialogFrame>;
}
