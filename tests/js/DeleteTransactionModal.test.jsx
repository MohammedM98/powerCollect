import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import DeleteTransactionModal from '@/Pages/Subscriptions/DeleteTransactionModal';
import { rejectNext, submissions } from './inertia.jsx';

const payment = { id: 30, type: 'payment', description: 'دفعة نقدية', amount: '100.00', currencyLabel: 'شيكل', date: '2026-11-10', recorded: { effect: '-100.00' } };
const reasons = [
    { value: 'duplicate', label: 'سُجّلت مرتين' },
    { value: 'wrong_subscriber', label: 'مشترك خاطئ' },
];

function open(action = 'cancel') {
    render(<DeleteTransactionModal onClose={() => {}} subscription={{ id: 7 }} balance="50.00" entry={payment} action={action} reasons={reasons} />);
}

describe('DeleteTransactionModal', () => {
    it('cancels the line with the chosen reason and its explanation after the person confirms', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('radio', { name: 'سُجّلت مرتين' }));
        await user.type(screen.getByLabelText(/شرح إلغاء الحركة/), 'أُدخلت الدفعة مرتين');
        await user.click(screen.getByRole('button', { name: 'إلغاء الحركة' }));
        await user.click(await screen.findByRole('button', { name: 'نعم، إلغاء الحركة' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'post', url: '/subscriptions/7/transactions/30/actions' });
        expect(submissions[0].data).toEqual({ action: 'cancel', correction_reason: 'duplicate', correction_notes: 'أُدخلت الدفعة مرتين', reopen_reading: false });
    });

    it('sends nothing until a reason is chosen', async () => {
        const user = userEvent.setup();
        open();

        await user.type(screen.getByLabelText(/شرح إلغاء الحركة/), 'أُدخلت الدفعة مرتين');
        await user.click(screen.getByRole('button', { name: 'إلغاء الحركة' }));

        expect(screen.getByText('اختر قيمة لهذا الحقل.')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'نعم، إلغاء الحركة' })).toBeNull();
        expect(submissions).toHaveLength(0);
    });

    it('shows why the server refused a refund and stays open', async () => {
        const user = userEvent.setup();
        open('refund');
        rejectNext({ action: 'أُرجعت هذه الدفعة كاملة من قبل.' });

        await user.click(screen.getByRole('radio', { name: 'مشترك خاطئ' }));
        await user.type(screen.getByLabelText(/شرح إرجاع الدفعة/), 'الدفعة لمشترك آخر');
        await user.click(screen.getByRole('button', { name: 'إرجاع الدفعة' }));
        await user.click(await screen.findByRole('button', { name: 'نعم، إرجاع الدفعة' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0].data).toMatchObject({ action: 'refund' });
        expect(screen.getByText('أُرجعت هذه الدفعة كاملة من قبل.')).toBeTruthy();
        expect(screen.getByRole('dialog', { name: 'إرجاع الدفعة' })).toBeTruthy();
    });
});
