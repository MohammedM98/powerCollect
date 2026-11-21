import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import SplitPaymentForm from '@/Pages/Payments/SplitPaymentForm';
import { respondTo, submissions } from './inertia.jsx';

const first = { id: 1, fullName: 'سامي أحمد', accountNumber: '2026001', meterBoxNumber: 'A-1', balance: '120.00', status: 'active' };
const second = { id: 2, fullName: 'خالد أحمد', accountNumber: '2026002', meterBoxNumber: 'A-2', balance: '80.00', status: 'active' };

async function addSecond(user) {
    await user.type(screen.getByLabelText('إضافة مشترك إلى هذه الدفعة'), 'خالد');
    await user.click(await screen.findByRole('button', { name: /خالد أحمد/ }, { timeout: 2000 }));
}

describe('SplitPaymentForm', () => {
    beforeEach(() => {
        respondTo('/payments/search', { subscriptions: [second], hasMore: false });
        respondTo('/payments/split/reference-status', null);
    });

    it('shows what is left to distribute and sends each share once it adds up', async () => {
        const user = userEvent.setup();
        render(<SplitPaymentForm transferBanks={['بنك فلسطين']} senderBanks={['بنك القدس']} initialSubscription={first} />);

        await user.type(document.getElementById('split_total'), '200');
        await addSecond(user);

        await user.type(screen.getByLabelText('مبلغ سامي أحمد'), '120');
        expect(screen.getByText(/بقي 80 ₪ لم يُوزَّع/)).toBeTruthy();

        await user.type(screen.getByLabelText('مبلغ خالد أحمد'), '100');
        expect(screen.getByText(/الموزَّع يزيد 20 ₪ على المحوَّل/)).toBeTruthy();

        await user.clear(screen.getByLabelText('مبلغ خالد أحمد'));
        await user.type(screen.getByLabelText('مبلغ خالد أحمد'), '80');
        expect(screen.queryByText(/لم يُوزَّع|على المحوَّل/)).toBeNull();
    });

    it('records the transfer with every share, after the person confirms', async () => {
        const user = userEvent.setup();
        render(<SplitPaymentForm transferBanks={['بنك فلسطين']} senderBanks={['بنك القدس']} initialSubscription={first} />);

        await user.type(document.getElementById('split_total'), '200');
        await user.click(screen.getByRole('radio', { name: /بنك فلسطين/ }));
        await user.type(document.getElementById('split_sender'), 'سامي أحمد');
        await user.type(document.getElementById('split_reference'), 'FT-200');
        await addSecond(user);
        await user.type(screen.getByLabelText('مبلغ سامي أحمد'), '120');
        await user.type(screen.getByLabelText('مبلغ خالد أحمد'), '80');

        await user.click(screen.getByRole('button', { name: 'تسجيل الدفعة على 2 مشتركين' }));
        await user.click(await screen.findByRole('button', { name: 'نعم، سجّل' }));

        const sent = submissions.filter((submission) => !submission.http);
        expect(sent).toHaveLength(1);
        expect(sent[0]).toMatchObject({ method: 'post', url: '/payments/split' });
        expect(sent[0].data).toMatchObject({ total_amount: '200', bank_name: 'بنك فلسطين', sender_name: 'سامي أحمد', reference_number: 'FT-200' });
        expect(sent[0].data.parts).toEqual([{ subscription_id: 1, amount: '120' }, { subscription_id: 2, amount: '80' }]);
        expect(sent[0].data.operation_token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('cannot be saved while the shares do not add up to the transfer', async () => {
        const user = userEvent.setup();
        render(<SplitPaymentForm transferBanks={['بنك فلسطين']} senderBanks={[]} initialSubscription={first} />);

        await user.type(document.getElementById('split_total'), '200');
        await user.click(screen.getByRole('radio', { name: /بنك فلسطين/ }));
        await user.type(document.getElementById('split_sender'), 'سامي');
        await user.type(document.getElementById('split_reference'), 'FT-1');
        await addSecond(user);
        await user.type(screen.getByLabelText('مبلغ سامي أحمد'), '120');
        await user.type(screen.getByLabelText('مبلغ خالد أحمد'), '50');

        expect(screen.getByRole('button', { name: 'تسجيل الدفعة على 2 مشتركين' }).disabled).toBe(true);
    });
});
