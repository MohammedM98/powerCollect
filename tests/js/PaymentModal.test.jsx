import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import PaymentModal from '@/Pages/Subscriptions/PaymentModal';
import { setPage, submissions } from './inertia.jsx';

const subscription = { id: 5, fullName: 'سامي أحمد' };
const methods = [
    { value: 'bank_transfer', label: 'تحويل بنكي' },
    { value: 'cash', label: 'نقد' },
];

function open(balance = '200.00') {
    render(<PaymentModal show onClose={() => {}} subscription={subscription} balance={balance} paymentMethods={methods} transferBanks={['بنك فلسطين']} senderBanks={['بنك القدس']} />);
}

describe('PaymentModal', () => {
    beforeEach(() => {
        setPage({ props: { paymentOptions: { currencies: [{ code: 'ILS', label: 'شيكل', rate: '1' }, { code: 'USD', label: 'دولار', rate: '3.7' }] } } });
    });

    it('records a cash payment in shekels after the person confirms', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('radio', { name: /نقد/ }));
        await user.type(screen.getByLabelText('المبلغ المستلم'), '50');
        await user.click(screen.getByRole('button', { name: /تسجيل 50/ }));
        expect(submissions).toHaveLength(0);
        await user.click(await screen.findByRole('button', { name: 'نعم، سجّل الدفعة' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'post', url: '/subscriptions/5/payments' });
        expect(submissions[0].data).toMatchObject({ amount: '50', currency: 'ILS', payment_method: 'cash' });
        expect(submissions[0].data.payment_token).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('shows the rate for a foreign currency and sends the amount in that currency', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('radio', { name: /نقد/ }));
        await user.click(screen.getByLabelText('عملة الدفع'));
        await user.click(screen.getByRole('button', { name: /دولار \(USD\)/ }));

        expect(screen.getByRole('status').textContent).toContain('3.7');
        await user.type(screen.getByLabelText('المبلغ المستلم'), '10');
        await user.click(screen.getByRole('button', { name: /تسجيل 10 USD/ }));
        await user.click(await screen.findByRole('button', { name: 'نعم، سجّل الدفعة' }));

        expect(submissions[0].data).toMatchObject({ amount: '10', currency: 'USD', payment_method: 'cash' });
    });

    it('fills in the whole debt from the quick amount', async () => {
        const user = userEvent.setup();
        open('120.50');

        await user.click(screen.getByRole('button', { name: 'تسديد كامل الدين' }));

        expect(screen.getByLabelText('المبلغ المستلم').value).toBe('120.5');
    });

    it('cannot be saved without an amount', async () => {
        open();

        expect(screen.getByRole('button', { name: 'تسجيل الدفعة' }).disabled).toBe(true);
    });
});
