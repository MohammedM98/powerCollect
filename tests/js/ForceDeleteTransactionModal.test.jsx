import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ForceDeleteTransactionModal from '@/Pages/Subscriptions/ForceDeleteTransactionModal';
import { rejectNext, submissions } from './inertia.jsx';

const discount = { id: 61, type: 'discount', description: 'خصم موظفين', amount: '30.00', currencyLabel: 'شيكل', date: '2026-11-14', eraseEffect: '30.00' };

function open() {
    render(<ForceDeleteTransactionModal onClose={() => {}} subscription={{ id: 9 }} balance="90.00" entry={discount} />);
}

async function confirmWithReason(user, reason) {
    await user.type(screen.getByLabelText('سبب الإلغاء أو الإرجاع'), reason);
    await user.click(screen.getByRole('button', { name: 'إلغاء الخصم' }));
    await user.click(await screen.findByRole('button', { name: 'نعم، إلغاء الخصم' }));
}

describe('ForceDeleteTransactionModal', () => {
    it('reverses the line with its reason after the person confirms', async () => {
        const user = userEvent.setup();
        open();

        await confirmWithReason(user, 'سُجّل الخصم للمشترك الخطأ');

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'post', url: '/subscriptions/9/transactions/61/actions' });
        expect(submissions[0].data).toEqual({ action: 'delete', correction_notes: 'سُجّل الخصم للمشترك الخطأ' });
    });

    it('sends nothing without a reason', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('button', { name: 'إلغاء الخصم' }));

        expect(screen.getByText('هذا الحقل مطلوب.')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'نعم، إلغاء الخصم' })).toBeNull();
        expect(submissions).toHaveLength(0);
    });

    it('shows why the server refused and stays open', async () => {
        const user = userEvent.setup();
        open();
        rejectNext({ action: 'لا يمكن تعديل حركة في صندوق مغلق.' });

        await confirmWithReason(user, 'خصم مكرر');

        expect(submissions).toHaveLength(1);
        expect(screen.getByRole('alert').textContent).toBe('لا يمكن تعديل حركة في صندوق مغلق.');
        expect(screen.getByRole('dialog', { name: 'إلغاء الخصم' })).toBeTruthy();
    });
});
