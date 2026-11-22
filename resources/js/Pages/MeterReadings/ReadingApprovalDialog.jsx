import { formatShekels } from '@/lib/currency';
import { ConfirmDialog, Notice } from '@/Components/UI';

export default function ReadingApprovalDialog({ row, onConfirm, onCancel }) {
    if (!row) return null;

    return <ConfirmDialog show title="اعتماد هذه القراءة؟" onConfirm={onConfirm} onCancel={onCancel} confirmLabel="اعتماد القراءة" cancelLabel="العودة للمراجعة" message={`سيُضاف مبلغ قراءة ${row.fullName} إلى حسابه. يشمل هذا التأكيد هذه القراءة فقط.`}>
        <dl className="grid grid-cols-2 gap-4 rounded-control bg-(--ma-tile) p-4">
            {[['القراءة السابقة', row.previousReading], ['القراءة الجديدة', row.reading.currentReading], ['الاستهلاك (كيلو)', row.reading.consumption], ['المبلغ المستحق', formatShekels(row.reading.amountDue)]].map(([label, value]) => <div key={label}><dt className="text-sm text-(--ma-muted)">{label}</dt><dd className="mt-1 font-display text-xl font-bold text-(--ma-ink)">{value}</dd></div>)}
        </dl>
        {row.reading.unusual && <Notice tone="warn" className="mt-4">هذه القراءة أعلى بكثير من الاستهلاك المعتاد. باعتمادها تؤكد أنك راجعتها وأنها صحيحة.</Notice>}
    </ConfirmDialog>;
}
