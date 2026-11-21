import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import PhoneQuickEdit from '@/Pages/Subscriptions/PhoneQuickEdit';
import { rejectNext, submissions } from './inertia.jsx';

const subscription = { id: 33, display_name: 'سامي أحمد', contact_phone: '0591234567', canUpdate: true };

async function typeNumber(user, phone) {
    await user.click(screen.getByRole('button', { name: '0591234567 تعديل رقم جوال سامي أحمد' }));
    const field = screen.getByLabelText('رقم جوال سامي أحمد');
    await user.clear(field);
    await user.type(field, phone);
    await user.click(screen.getByRole('button', { name: 'حفظ الرقم' }));
}

describe('PhoneQuickEdit', () => {
    it('saves the new number after the person confirms the change', async () => {
        const user = userEvent.setup();
        render(<PhoneQuickEdit subscription={subscription} />);

        await typeNumber(user, '0569876543');
        expect(submissions).toHaveLength(0);
        await user.click(await screen.findByRole('button', { name: 'تأكيد التغيير' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'patch', url: '/subscriptions/33/phone', data: { phone: '0569876543' } });
    });

    it('sends nothing when the number is unchanged', async () => {
        const user = userEvent.setup();
        render(<PhoneQuickEdit subscription={subscription} />);

        await typeNumber(user, '0591234567');

        expect(screen.queryByRole('button', { name: 'تأكيد التغيير' })).toBeNull();
        expect(submissions).toHaveLength(0);
    });

    it('shows the server\'s refusal beside the field and keeps it open', async () => {
        const user = userEvent.setup();
        render(<PhoneQuickEdit subscription={subscription} />);
        rejectNext({ phone: 'رقم الجوال غير صحيح.' });

        await typeNumber(user, '0569');
        await user.click(await screen.findByRole('button', { name: 'تأكيد التغيير' }));

        expect(submissions).toHaveLength(1);
        expect(screen.getByRole('alert').textContent).toBe('رقم الجوال غير صحيح.');
        expect(screen.getByLabelText('رقم جوال سامي أحمد').value).toBe('0569');
    });
});
