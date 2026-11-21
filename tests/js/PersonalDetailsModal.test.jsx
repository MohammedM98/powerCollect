import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import PersonalDetailsModal from '@/Pages/Subscriptions/PersonalDetailsModal';
import { rejectNext, submissions } from './inertia.jsx';

const subscription = { id: 21, full_name: 'سامي أحمد', national_id: '401234567', phone: '0591234567', address: 'غزة', subscriptionCount: 2 };

function open() {
    render(<PersonalDetailsModal subscription={subscription} onClose={() => {}} />);
}

async function changePhone(user, phone) {
    const field = screen.getByLabelText('رقم الجوال');
    await user.clear(field);
    await user.type(field, phone);
    await user.click(screen.getByRole('button', { name: 'حفظ' }));
}

describe('PersonalDetailsModal', () => {
    it('saves the person\'s details after they confirm', async () => {
        const user = userEvent.setup();
        open();

        await changePhone(user, '0569876543');
        await user.click(await screen.findByRole('button', { name: 'نعم، احفظ التعديلات' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'patch', url: '/subscriptions/21/personal-details' });
        expect(submissions[0].data).toEqual({ full_name: 'سامي أحمد', national_id: '401234567', phone: '0569876543', address: 'غزة' });
    });

    it('refuses a mobile number that is not 059 or 056, says why and sends nothing', async () => {
        const user = userEvent.setup();
        open();

        await changePhone(user, '0521234567');

        expect(screen.queryByRole('button', { name: 'نعم، احفظ التعديلات' })).toBeNull();
        expect(submissions).toHaveLength(0);
        expect(screen.getByRole('alert').textContent).toBe('رقم الجوال يجب أن يتكون من 10 أرقام ويبدأ بـ 059 أو 056');
    });

    it('shows the server\'s refusal under the mobile number and stays open', async () => {
        const user = userEvent.setup();
        open();
        rejectNext({ phone: 'رقم الجوال مسجّل لشخص آخر.' });

        await changePhone(user, '0569876543');
        await user.click(await screen.findByRole('button', { name: 'نعم، احفظ التعديلات' }));

        expect(submissions).toHaveLength(1);
        expect(screen.getByRole('alert').textContent).toBe('رقم الجوال مسجّل لشخص آخر.');
        expect(screen.getByRole('dialog', { name: 'تعديل البيانات الشخصية' })).toBeTruthy();
    });
});
