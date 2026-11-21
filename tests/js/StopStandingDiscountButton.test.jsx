import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import StopStandingDiscountButton from '@/Pages/Subscriptions/StopStandingDiscountButton';
import { rejectNext, submissions } from './inertia.jsx';

function open() {
    render(<StopStandingDiscountButton subscriptionId={18} subscriptionName="سامي أحمد" discountLabel="3 كيلو، موظفو أبو زايد" />);
}

describe('StopStandingDiscountButton', () => {
    it('stops the standing discount after the person confirms', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('button', { name: 'إلغاء الخصم' }));
        expect(submissions).toHaveLength(0);
        await user.click(await screen.findByRole('button', { name: 'نعم، ألغِ الخصم' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'delete', url: '/subscriptions/18/standing-discount' });
    });

    it('sends nothing when the person keeps the discount', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('button', { name: 'إلغاء الخصم' }));
        await user.click(await screen.findByRole('button', { name: 'إبقاء الخصم' }));

        expect(screen.queryByRole('button', { name: 'نعم، ألغِ الخصم' })).toBeNull();
        expect(submissions).toHaveLength(0);
    });

    it('can be tried again after the server refuses', async () => {
        const user = userEvent.setup();
        open();
        rejectNext({ discount: 'لا يوجد خصم ساري لهذا الاشتراك.' });

        await user.click(screen.getByRole('button', { name: 'إلغاء الخصم' }));
        await user.click(await screen.findByRole('button', { name: 'نعم، ألغِ الخصم' }));

        expect(submissions).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'إلغاء الخصم' }).disabled).toBe(false);
    });
});
