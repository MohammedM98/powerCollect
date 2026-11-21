import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import DiscountModal from '@/Pages/Subscriptions/DiscountModal';
import { submissions } from './inertia.jsx';

const methods = [
    { value: 'percentage', label: 'نسبة' },
    { value: 'kilowatt', label: 'كيلوات' },
    { value: 'shekel', label: 'شيكل' },
];
const subscription = { id: 9, fullName: 'سامي أحمد', kiloPrice: '2.00', minimumPayment: '10.00', lastConsumption: '20', standingDiscount: null };

function open(balance = '80.00') {
    render(<DiscountModal show onClose={() => {}} subscription={subscription} balance={balance} discountMethods={methods} discountSegments={[]} />);
}

describe('DiscountModal', () => {
    it('takes a one-off discount off the balance owed after the person confirms', async () => {
        const user = userEvent.setup();
        open();

        await user.type(screen.getByLabelText('قيمة الخصم'), '30');
        await user.click(screen.getByRole('button', { name: /خصم 30/ }));
        await user.click(await screen.findByRole('button', { name: 'نعم، أضف الخصم' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'post', url: '/subscriptions/9/discounts' });
        expect(submissions[0].data).toMatchObject({ kind: 'once', method: 'shekel', value: '30' });
        expect(submissions[0].data.operation_token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('refuses a one-off discount larger than the balance owed', async () => {
        const user = userEvent.setup();
        open('25.00');

        await user.type(screen.getByLabelText('قيمة الخصم'), '30');

        expect(screen.getByText(/لا يمكن أن يزيد الخصم/)).toBeTruthy();
        expect(screen.getByRole('button', { name: /خصم 30|إضافة الخصم/ }).disabled).toBe(true);
    });

    it('caps a weekly percentage discount at 100%', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('radio', { name: /خصم القراءات الأسبوعية/ }));
        await user.click(screen.getByRole('radio', { name: /نسبة/ }));
        await user.type(screen.getByLabelText('قيمة الخصم'), '120');

        expect(screen.getByText('النسبة لا تزيد عن 100%.')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'تفعيل خصم القراءات الأسبوعية' }).disabled).toBe(true);
    });

    it('starts a weekly kilowatt discount with its method and value', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('radio', { name: /خصم القراءات الأسبوعية/ }));
        await user.click(screen.getByRole('radio', { name: /كيلوات/ }));
        await user.type(screen.getByLabelText('قيمة الخصم'), '5');
        await user.click(screen.getByRole('button', { name: 'تفعيل خصم القراءات الأسبوعية' }));
        await user.click(await screen.findByRole('button', { name: 'نعم، أضف الخصم' }));

        expect(submissions[0].data).toMatchObject({ kind: 'standing', method: 'kilowatt', value: '5' });
    });
});
