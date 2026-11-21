import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import EditTransactionAmountModal from '@/Pages/Subscriptions/EditTransactionAmountModal';
import { rejectNext, submissions } from './inertia.jsx';

const charge = { id: 52, type: 'charge', description: 'رسوم قطع الخدمة', amount: '20.00', currencyLabel: 'شيكل', date: '2026-11-15', recorded: { effect: '20.00' } };

function open() {
    render(<EditTransactionAmountModal onClose={() => {}} subscription={{ id: 9 }} balance="120.00" entry={charge} />);
}

async function fillAndConfirm(user, amount, reason) {
    const field = screen.getByLabelText('المبلغ الصحيح');
    await user.clear(field);
    await user.type(field, amount);
    await user.type(screen.getByLabelText('سبب التعديل'), reason);
    await user.click(screen.getByRole('button', { name: 'تعديل' }));
    await user.click(await screen.findByRole('button', { name: 'نعم، عدّل' }));
}

describe('EditTransactionAmountModal', () => {
    it('sends the corrected amount with its reason after the person confirms', async () => {
        const user = userEvent.setup();
        open();

        await fillAndConfirm(user, '25', 'الرسوم 25 شيكل');

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'post', url: '/subscriptions/9/transactions/52/actions' });
        expect(submissions[0].data).toEqual({ action: 'edit', amount: '25', amendment_reason: 'الرسوم 25 شيكل' });
    });

    it('sends nothing without a reason for the change', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('button', { name: 'تعديل' }));

        expect(screen.getByText('هذا الحقل مطلوب.')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'نعم، عدّل' })).toBeNull();
        expect(submissions).toHaveLength(0);
    });

    it('shows the server\'s refusal under the amount and stays open', async () => {
        const user = userEvent.setup();
        open();
        rejectNext({ amount: 'لا يمكن أن يقل المبلغ عن المدفوع منه.' });

        await fillAndConfirm(user, '5', 'خطأ في الإدخال');

        expect(submissions).toHaveLength(1);
        expect(screen.getByRole('alert').textContent).toBe('لا يمكن أن يقل المبلغ عن المدفوع منه.');
        expect(screen.getByRole('dialog', { name: 'تعديل الحركة' })).toBeTruthy();
    });
});
