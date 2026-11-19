import Icon from '@/Components/Icon';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { formatMoney } from '@/lib/format';

/** The payment window's footer: what is still missing, the overpayment confirmation, and cancel and save. */
export default function PaymentFooter({ correcting, currencyMark, data, form, inShekels, overpayment, referenceStatus, requestClose }) {
    return (
        <div className="gl-dialog-foot flex shrink-0 items-center gap-3 px-5 py-4 sm:px-6">
            <SecondaryButton onClick={requestClose} className="gl-lg">
                إلغاء
            </SecondaryButton>
            <PrimaryButton
                type="submit"
                disabled={
                    !(Number(data.amount) > 0) ||
                    inShekels === null ||
                    form.processing ||
                    (Boolean(referenceStatus?.conflict) && !data.confirm_duplicate_reference) ||
                    (overpayment === 'confirm' && !data.confirm_overpayment)
                }
                className={`gl-lg ms-auto min-w-0 flex-1 sm:min-w-[230px] sm:flex-none ${correcting ? 'gl-correcting' : 'gl-pay'}`}
            >
                <Icon name="check" className="h-[18px] w-[18px]" strokeWidth={2.2} />
                {form.processing
                    ? 'جارٍ الحفظ...'
                    : correcting
                      ? 'حفظ التصحيح'
                      : Number(data.amount) > 0
                        ? `تسجيل ${formatMoney(data.amount)} ${currencyMark}`
                        : 'تسجيل الدفعة'}
            </PrimaryButton>
        </div>
    );
}
