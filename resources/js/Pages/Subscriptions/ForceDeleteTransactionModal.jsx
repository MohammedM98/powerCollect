import { TextArea } from '@heroui/react';
import { useForm } from '@inertiajs/react';
import FormModal from '@/Components/FormModal';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import { describeBalance } from '@/lib/accountStatement';
import { balanceInText } from '@/lib/balance';
import { BalanceAfter } from './AccountSummary';
import { OriginalLine } from './CorrectionFields';

/**
 * Reverse the remaining financial effect while retaining the original line.
 */
export default function ForceDeleteTransactionModal({ onClose, subscription, balance, entry, action = 'delete' }) {
    const isSplit = Boolean(entry.splitPayment);
    const noun = {
        payment: 'الدفعة',
        discount: 'الخصم',
        reading_discount: 'خصم القراءة الأسبوعية',
        credit: 'الرصيد الدائن',
        clearing: 'المقاصة',
    }[entry.type] ?? 'الحركة';
    const title = entry.type === 'payment' ? 'إرجاع الدفعة' : `إلغاء ${noun}`;
    const submitLabel = title;
    const form = useForm({ action, correction_notes: '' });
    const eraseForm = { ...form, isEdit: true, save: (options) => form.post(`/subscriptions/${subscription.id}/transactions/${entry.id}/actions`, options) };
    const effect = entry.actionEffects?.[action] ?? entry.eraseEffect;
    const balanceAfter = describeBalance(Number(balance) - Number(effect));
    const balanceText = balanceInText(balanceAfter.signed);

    return (
        <FormModal
            show
            onClose={onClose}
            form={eraseForm}
            title={title}
            icon="trash"
            headerTone="danger"
            maxWidth="xl"
            bodyClassName="space-y-5"
            action={{ submitLabel, title: `${title}؟`, confirmLabel: `نعم، ${submitLabel}`, icon: 'trash', tone: 'danger' }}
            saveConfirmMessage={`سيُسجّل ${isSplit ? 'قيد عكسي لكل حصة من الحوالة المقسّمة' : 'قيد عكسي مرتبط بالحركة الأصلية'}، وسيصبح ${isSplit ? 'رصيد هذا المشترك' : 'الرصيد'} ${balanceText}. تبقى الحركات الأصلية محفوظة. هل تريد المتابعة؟`}
        >
            <OriginalLine entry={entry} tone="erase" />

            {isSplit && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/6 px-4 py-3 text-sm leading-7 text-gray-700">
                    <p className="font-semibold text-gray-900">الإجراء يشمل الحوالة المقسّمة كاملة</p>
                    <p>يُعكس الأثر المالي المتبقي لكل حصة بقيد مرتبط بها، وتبقى الحصص والحركات السابقة محفوظة. إذا تعذّر تنفيذ الإجراء على أحد الأجزاء، فلن يتغيّر أي جزء.</p>
                </div>
            )}

            {!isSplit && action === 'delete' && entry.isCorrection && entry.corrects && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/6 px-4 py-3 text-sm text-gray-700">
                    هذه الحركة صحّحت الحركة رقم <b className="font-display">{entry.corrects.lineNumber}</b>. يُعكس أثر الحركة الحالية بقيد جديد، وتبقى سلسلة التصحيح السابقة محفوظة.
                </p>
            )}

            {action === 'delete' && entry.readingDiscount && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/6 px-4 py-3 text-sm text-gray-700">
                    لهذه القراءة خصم أسبوعي بقيمة <b className="font-display">{entry.readingDiscount}</b> شيكل. يُلغى أثره بقيد عكسي مرتبط به عند إلغاء فاتورة القراءة.
                </p>
            )}

            <p className="rounded-xl bg-brand-500/5 px-4 py-3 text-sm text-brand-700">
                تبقى الحركة الأصلية في كشف الحساب، ويُضاف قيد عكسي باسم الموظف والفرع والوقت وسبب الإجراء.
            </p>

            <div>
                <InputLabel htmlFor="correction_notes" value="سبب الإلغاء أو الإرجاع" />
                <TextArea
                    id="correction_notes"
                    name="correction_notes"
                    rows={2}
                    required
                    maxLength={1000}
                    className="mt-1 block w-full"
                    placeholder="اكتب سبب الإجراء بوضوح"
                    value={form.data.correction_notes}
                    onChange={(e) => form.setData('correction_notes', e.target.value)}
                />
                <InputError message={form.errors.correction_notes} className="mt-2" />
                <p className="mt-2 text-xs text-gray-500">سيُسجَّل اسم المستخدم والوقت والسبب والحركات المتأثرة في سجل التدقيق.</p>
            </div>

            <InputError message={form.errors.action} />
            <BalanceAfter label={`${isSplit ? 'رصيد هذا المشترك' : 'الرصيد'} بعد القيد العكسي`} balanceAfter={balanceAfter} />
        </FormModal>
    );
}
