import { Button } from '@heroui/react';
import { useState } from 'react';
import { distributionAreaBreakdown, distributionTargetPreview, columnTotals } from '@/lib/readingBoard';
import { formatNumber } from '@/lib/format';
import InputError from '@/Components/UI/InputError';
import DistributionDialog from './DistributionDialog';
import DistributionAreaBreakdown from './DistributionAreaBreakdown';
import { CheckBox, ChoiceSelect, Notice, PrimaryKey, RadioCards, SecondaryKey } from '@/Components/UI';

export default function DistributionActionModal({ boards, selectedBoxes, readers, abilities, busy, errors, target, onTargetChange, recurring, onRecurringChange, hiddenSelected, onRemoveHidden, onClose, onAssign, onCreateSheet, allocationReport }) {
    const [mode, setMode] = useState(target === 'paper' || target === 'available' ? target : 'reader');
    const totals = columnTotals(selectedBoxes);
    const preview = distributionTargetPreview(boards, selectedBoxes, target);
    const paperCount = selectedBoxes.filter((box) => box.column === 'paper' && box.status === 'approved').length;

    function changeMode(value) {
        setMode(value);
        onTargetChange(value === 'reader' ? (target.startsWith('reader:') ? target : '') : value);
    }

    return <DistributionDialog title="إجراء على الطبلونات المحددة" subtitle={`${formatNumber(totals.boxes)} طبلون، ${formatNumber(totals.subscribers)} مشترك، يشمل التحديد جميع صفحات النتائج`} busy={busy} onClose={onClose}
        footer={<><SecondaryKey disabled={busy} onClick={onClose}>متابعة التحديد</SecondaryKey><div className="flex flex-wrap gap-2">
            {abilities.printSheets && paperCount > 0 && <SecondaryKey disabled={busy || paperCount > 200} onClick={onCreateSheet}>إنشاء كشف للطباعة ({formatNumber(paperCount)})</SecondaryKey>}
            {abilities.manage && <PrimaryKey onClick={onAssign} disabled={busy || !target || selectedBoxes.length === 0 || selectedBoxes.length > 1000}>{busy ? 'جارٍ الحفظ…' : abilities.approve ? 'حفظ التوزيع' : 'حفظ للمراجعة'}</PrimaryKey>}
        </div></>}>
        {hiddenSelected > 0 && <Notice role="status" tone="warn">يشمل التحديد {formatNumber(hiddenSelected)} طبلون خارج النتائج الظاهرة، وسيشملها الحفظ أيضًا. <Button data-raw="" variant="ghost" isDisabled={busy} onClick={onRemoveHidden} className="font-bold underline">إلغاء تحديد المخفي</Button></Notice>}
        {allocationReport}
        <div className="max-h-60 overflow-y-auto rounded-control border border-(--ma-line) px-4"><DistributionAreaBreakdown areas={distributionAreaBreakdown(boards, selectedBoxes)} /></div>
        {abilities.manage && <>
            <fieldset disabled={busy}>
                <legend className="mb-3 text-sm font-bold text-(--ma-ink)">توزيع المحدد إلى</legend>
                <RadioCards
                    label="توزيع المحدد إلى"
                    name="distribution-mode"
                    className="grid gap-2 sm:grid-cols-3"
                    value={mode}
                    onChange={changeMode}
                    isDisabled={busy}
                    options={[['reader', 'قارئ عدادات'], ['paper', 'كشف ورقي'], ['available', 'إلغاء التخصيص']].map(([value, label]) => ({ value, label }))}
                    itemClassName={(option, selected) => `flex cursor-pointer items-center gap-2 rounded-control border p-3 text-sm font-semibold ${selected ? 'border-(--ma-brand) bg-(--ma-brand-soft) text-(--ma-brand)' : 'border-(--ma-line) text-(--ma-ink)'}`}
                />
            </fieldset>
            {mode === 'reader' && <div><label htmlFor="distribution-reader" className="mb-2 block text-sm font-semibold text-(--ma-ink)">القارئ المكلّف</label><ChoiceSelect id="distribution-reader" className="w-full text-sm" disabled={busy} value={target.startsWith('reader:') ? target : ''} onChange={(event) => onTargetChange(event.target.value)}><option value="">اختر القارئ</option>{readers.map((reader) => <option key={reader.id} value={`reader:${reader.id}`}>{reader.name}</option>)}</ChoiceSelect>{readers.length === 0 && <p className="mt-2 text-xs text-(--ma-warn)">لا يوجد قرّاء متاحون في هذا الفرع.</p>}</div>}
            {target && <div className="rounded-control bg-(--ma-tile) p-4 text-sm text-(--ma-ink)" role="status"><p className="font-bold text-(--ma-ink)">{mode === 'reader' ? readers.find((reader) => `reader:${reader.id}` === target)?.name : mode === 'paper' ? 'الكشوف الورقية' : 'غير موزع'}</p><p className="mt-2">حاليًا: {formatNumber(preview.before.boxes)} طبلون، {formatNumber(preview.before.subscribers)} مشترك</p><p className="mt-1 font-semibold text-(--ma-brand)">بعد الحفظ: {formatNumber(preview.after.boxes)} طبلون، {formatNumber(preview.after.subscribers)} مشترك</p></div>}
            {abilities.approve && <label className="flex items-start gap-2 text-sm leading-6 text-(--ma-ink)"><CheckBox checked={recurring} disabled={busy} onChange={(event) => onRecurringChange(event.target.checked)} /><span>حفظ هذا التوزيع للقراءات القادمة أيضًا<span className="block text-xs text-(--ma-muted)">{recurring ? 'يصبح التوزيع الثابت للطبلونات المحددة.' : 'لهذه القراءة فقط؛ يبقى التوزيع الثابت للقراءات التالية.'}</span></span></label>}
            {selectedBoxes.length > 1000 && <p className="text-sm text-(--ma-warn)">يمكن توزيع 1,000 طبلون في المرة الواحدة. قلّل التحديد ووزّع البقية بعدها.</p>}
        </>}
        {paperCount > 200 && <p className="text-sm text-(--ma-warn)">يمكن وضع 200 طبلون في الكشف الواحد. حدّد منطقة أصغر لإنشاء الكشف.</p>}
        {!abilities.manage && paperCount === 0 && <p className="text-sm text-(--ma-muted)">إنشاء الكشف يتطلب تحديد طبلونات مخصصة للورق ومعتمدة.</p>}
        {Object.entries(errors).filter(([key]) => /^(box_ids|versions|target|user_id|recurring|publish)(\.|$)/.test(key)).map(([key, message]) => <InputError key={key} message={message} />)}
    </DistributionDialog>;
}
