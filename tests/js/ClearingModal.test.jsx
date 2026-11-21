import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ClearingModal from '@/Pages/Subscriptions/ClearingModal';
import { submissions } from './inertia.jsx';

const subscription = { id: 7, fullName: 'سامي أحمد' };

function open(balance = '300.00') {
    render(<ClearingModal show onClose={() => {}} subscription={subscription} balance={balance} />);
}

describe('ClearingModal', () => {
    it('records the named service for its value after the person confirms', async () => {
        const user = userEvent.setup();
        open();

        await user.type(screen.getByLabelText('الخدمة التي قدّمها المشترك للشركة'), 'صيانة المولد');
        await user.type(screen.getByLabelText('قيمة المقاصة'), '120');
        await user.click(screen.getByRole('button', { name: /مقاصة 120 ₪ من الحساب/ }));
        expect(submissions).toHaveLength(0);
        await user.click(await screen.findByRole('button', { name: 'نعم، سجّل المقاصة' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'post', url: '/subscriptions/7/clearings' });
        expect(submissions[0].data).toMatchObject({ amount: '120', notes: 'صيانة المولد', confirm_over_balance: false });
    });

    it('sends nothing without the service it pays for', async () => {
        const user = userEvent.setup();
        open();

        await user.type(screen.getByLabelText('قيمة المقاصة'), '50');
        await user.click(screen.getByRole('button', { name: /مقاصة 50 ₪ من الحساب/ }));

        expect(screen.queryByRole('button', { name: 'نعم، سجّل المقاصة' })).toBeNull();
        expect(submissions).toHaveLength(0);
    });

    it('asks to confirm a clearing larger than what is owed before it can be saved', async () => {
        const user = userEvent.setup();
        open('40.00');

        await user.type(screen.getByLabelText('الخدمة التي قدّمها المشترك للشركة'), 'تركيب عداد');
        await user.type(screen.getByLabelText('قيمة المقاصة'), '100');
        await user.click(screen.getByRole('button', { name: /مقاصة 100 ₪ من الحساب/ }));
        expect(screen.queryByRole('button', { name: 'نعم، سجّل المقاصة' })).toBeNull();

        await user.click(screen.getByRole('checkbox'));
        await user.click(screen.getByRole('button', { name: /مقاصة 100 ₪ من الحساب/ }));
        await user.click(await screen.findByRole('button', { name: 'نعم، سجّل المقاصة' }));

        expect(submissions[0].data).toMatchObject({ amount: '100', confirm_over_balance: true });
    });
});
