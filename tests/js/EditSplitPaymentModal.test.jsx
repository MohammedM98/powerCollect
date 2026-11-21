import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import EditSplitPaymentModal from '@/Pages/Payments/EditSplitPaymentModal';
import { rejectNext, respondTo, submissions } from './inertia.jsx';

const split = {
    id: 5,
    bank_name: 'بنك فلسطين',
    bank_received_on: null,
    sender_bank_name: '',
    sender_name: 'سامي أحمد',
    reference_number: 'FT-100',
    notes: '',
    revision: 3,
    total_amount: '300.00',
    parts: [
        { id: 1, subscriptionName: 'سامي أحمد', amount: '200.00' },
        { id: 2, subscriptionName: 'ليلى أحمد', amount: '100.00' },
    ],
};

/** The visits the window sends, leaving out the request that loads it. */
const visits = () => submissions.filter((submission) => !submission.http);

async function open() {
    respondTo('/split-payments/5/edit', split);
    render(<EditSplitPaymentModal id={5} onClose={() => {}} transferBanks={['بنك فلسطين', 'بنك القدس']} senderBanks={['بنك الأردن']} />);

    return screen.findByLabelText('الرقم المرجعي');
}

async function saveWithReason(user, reason) {
    await user.type(screen.getByLabelText('سبب تعديل بيانات الحوالة'), reason);
    await user.click(screen.getByRole('button', { name: 'حفظ بيانات الحوالة' }));
    await user.click(await screen.findByRole('button', { name: 'نعم، احفظ التعديل' }));
}

describe('EditSplitPaymentModal', () => {
    it('saves the transfer\'s details for every part after the person confirms', async () => {
        const user = userEvent.setup();
        const reference = await open();

        await user.clear(reference);
        await user.type(reference, 'FT-200');
        await saveWithReason(user, 'الرقم المرجعي خاطئ');

        expect(visits()).toHaveLength(1);
        expect(visits()[0]).toMatchObject({ method: 'patch', url: '/split-payments/5' });
        expect(visits()[0].data).toEqual({
            bank_name: 'بنك فلسطين',
            bank_received_on: '',
            sender_bank_name: '',
            sender_name: 'سامي أحمد',
            reference_number: 'FT-200',
            notes: '',
            revision: 3,
            amendment_reason: 'الرقم المرجعي خاطئ',
        });
    });

    it('sends nothing without a reason for the change', async () => {
        const user = userEvent.setup();
        await open();

        await user.click(screen.getByRole('button', { name: 'حفظ بيانات الحوالة' }));

        expect(screen.getByText('هذا الحقل مطلوب.')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'نعم، احفظ التعديل' })).toBeNull();
        expect(visits()).toHaveLength(0);
    });

    it('shows the server\'s refusal and stays open', async () => {
        const user = userEvent.setup();
        await open();
        rejectNext({ revision: 'تغيّرت الحوالة منذ فتح النافذة؛ أغلقها وافتحها مجددًا.' });

        await saveWithReason(user, 'تصحيح اسم المرسل');

        expect(visits()).toHaveLength(1);
        expect(screen.getByRole('alert').textContent).toBe('تغيّرت الحوالة منذ فتح النافذة؛ أغلقها وافتحها مجددًا.');
        expect(screen.getByRole('dialog', { name: 'تعديل الحوالة المقسّمة' })).toBeTruthy();
    });
});
