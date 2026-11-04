import Icon from '@/Components/Icon';
import MeterReadingModal from '@/Pages/MeterReadings/MeterReadingModal';
import ChargeModal from './ChargeModal';
import ClearingModal from './ClearingModal';
import AmendTransactionModal from './AmendTransactionModal';
import DeleteTransactionModal from './DeleteTransactionModal';
import EditTransactionAmountModal from './EditTransactionAmountModal';
import ForceDeleteTransactionModal from './ForceDeleteTransactionModal';
import DiscountModal from './DiscountModal';
import PaymentModal from './PaymentModal';
import SplitPaymentModal from '@/Pages/Payments/SplitPaymentModal';

/** Each action's colour, from glass.css: the main button's blue for payments, red for what is added on, green for what comes off. */
const ACTION_TONES = {
    payment: 'rgb(var(--gl-btn))',
    split_payment: 'rgb(var(--gl-brand))',
    charge: 'var(--gl-bad)',
    discount: 'var(--gl-ok)',
    clearing: 'var(--gl-info)',
};

/**
 * The statement's actions as a row of buttons, each in its own colour, so
 * every movement is one click away. Each action is shown only to users
 * allowed to use it (each is its own permission). `onOpen` gets
 * 'payment', 'split_payment', 'charge', 'discount' or 'clearing'.
 */
export function StatementActions({ canRecordPayment, canRecordSplitPayment, canAddCharge, canAddDiscount, canAddClearing, onOpen }) {
    const actions = [
        canRecordPayment && { action: 'payment', label: 'تسجيل دفعة', icon: 'banknotes' },
        canRecordSplitPayment && { action: 'split_payment', label: 'دفعة مقسّمة', icon: 'layers' },
        canAddCharge && { action: 'charge', label: 'تحميل حركة', icon: 'document-plus' },
        canAddDiscount && { action: 'discount', label: 'خصم', icon: 'discount' },
        canAddClearing && { action: 'clearing', label: 'مقاصة', icon: 'scale' },
    ].filter(Boolean);

    if (actions.length === 0) {
        return null;
    }

    return (
        <div role="group" aria-label="إضافة حركة" className="gl-acts">
            {actions.map((item) => (
                <button key={item.action} type="button" onClick={() => onOpen(item.action)} className="gl-act" style={{ '--gl-c': ACTION_TONES[item.action] }}>
                    <Icon name={item.icon} className="h-[17px] w-[17px]" />
                    {item.label}
                </button>
            ))}
        </div>
    );
}

/**
 * The payment, charge, discount and clearing forms of a statement;
 * `openForm` names the one showing ('payment', 'charge', 'discount',
 * 'clearing' or null), or is `{ action: 'edit' | 'edit_metadata' | 'delete' | 'delete_reversal' | 'delete_tree' | 'cancel' | 'refund', entry }`
 * for one of a line's audit-safe actions, or `{ action: 'correct_reading', entry }` to correct the
 * weekly reading a line was billed from, in the readings page's own form. `statement` is the statement's page props.
 */
export function StatementForms({ statement, openForm, onClose, onOpen = null }) {
    const { subscription, summary, canRecordPayment, canAddCharge, canAddDiscount, canAddClearing } = statement;
    const amending = openForm?.action === 'edit_metadata' ? openForm.entry : null;
    const editing = openForm?.action === 'edit' ? openForm.entry : null;
    const deleting = ['delete', 'delete_reversal', 'delete_tree'].includes(openForm?.action) ? openForm.entry : null;
    const cancelling = openForm?.action === 'cancel' ? openForm.entry : null;
    const refunding = openForm?.action === 'refund' ? openForm.entry : null;
    const correctingReading = openForm?.action === 'correct_reading' ? openForm.entry.reading : null;

    return (
        <>
            {openForm === 'split_payment' && statement.canRecordSplitPayment && (
                <SplitPaymentModal
                    onClose={onClose}
                    transferBanks={statement.transferBanks}
                    senderBanks={statement.senderBanks}
                    initialSubscription={{ ...subscription, balance: summary.balance }}
                />
            )}
            {amending && (
                <AmendTransactionModal
                    key={`amend-${amending.id}`}
                    onClose={onClose}
                    subscription={subscription}
                    balance={summary.balance}
                    entry={amending}
                    transferBanks={statement.transferBanks}
                    senderBanks={statement.senderBanks}
                />
            )}


            {editing && (
                <EditTransactionAmountModal
                    key={`edit-${editing.id}`}
                    onClose={onClose}
                    subscription={subscription}
                    balance={summary.balance}
                    entry={editing}
                />
            )}

            {cancelling && (
                <DeleteTransactionModal
                    key={`cancel-${cancelling.id}`}
                    onClose={onClose}
                    subscription={subscription}
                    balance={summary.balance}
                    entry={cancelling}
                    action="cancel"
                    reasons={cancelling.deletionReasons}
                />
            )}

            {refunding && (
                <DeleteTransactionModal
                    key={`refund-${refunding.id}`}
                    onClose={onClose}
                    subscription={subscription}
                    balance={summary.balance}
                    entry={refunding}
                    action="refund"
                    reasons={refunding.deletionReasons}
                    onRecordPayment={canRecordPayment && onOpen ? () => onOpen('payment') : null}
                />
            )}

            {correctingReading && (
                <MeterReadingModal key={`reading-${correctingReading.id}`} show onClose={onClose} reading={correctingReading} weekOptions={[]} />
            )}

            {deleting && (
                <ForceDeleteTransactionModal
                    key={`${openForm.action}-${deleting.id}`}
                    onClose={onClose}
                    subscription={subscription}
                    balance={summary.balance}
                    entry={deleting}
                    action={openForm.action}
                />
            )}

            {canRecordPayment && (
                <PaymentModal
                    key="payment"
                    show={openForm === 'payment'}
                    today={statement.paymentToday}
                    onClose={onClose}
                    subscription={subscription}
                    balance={summary.balance}
                    paymentMethods={statement.payableMethods}
                    transferBanks={statement.transferBanks}
                    senderBanks={statement.senderBanks}
                />
            )}

            {canAddCharge && (
                <ChargeModal
                    show={openForm === 'charge'}
                    onClose={onClose}
                    subscription={subscription}
                    balance={summary.balance}
                    chargeTypes={statement.chargeTypes}
                />
            )}
            {canAddDiscount && (
                <DiscountModal
                    show={openForm === 'discount'}
                    onClose={onClose}
                    subscription={subscription}
                    balance={summary.balance}
                    discountMethods={statement.discountMethods}
                    discountSegments={statement.discountSegments}
                />
            )}
            {canAddClearing && <ClearingModal show={openForm === 'clearing'} onClose={onClose} subscription={subscription} balance={summary.balance} />}
        </>
    );
}
