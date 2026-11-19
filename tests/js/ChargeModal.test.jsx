import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ChargeModal from '@/Pages/Subscriptions/ChargeModal';
import { submissions } from './inertia.jsx';

const chargeTypes = [
    { value: 'penalty', label: 'غرامة مالية', usualAmount: null, needsReason: true },
    { value: 'disconnection_fee', label: 'رسوم قطع الخدمة', usualAmount: 20, needsReason: false },
    { value: 'minimum_charge', label: 'تحميل الحد الأدنى', usualAmount: null, needsReason: false },
];
const subscription = { id: 12, fullName: 'سامي أحمد', minimumPayment: '35.00', subscriptionFee: '50.00' };

function open() {
    render(<ChargeModal show onClose={() => {}} subscription={subscription} balance="100.00" chargeTypes={chargeTypes} />);
}

async function confirm(user, label = 'نعم، أضف التحميل') {
    await user.click(await screen.findByRole('button', { name: label }));
}

describe('ChargeModal', () => {
    it('charges a disconnection fee at its usual amount after the person confirms', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('radio', { name: /رسوم قطع الخدمة/ }));
        expect(screen.getByLabelText('مبلغ التحميل').value).toBe('20');

        await user.click(screen.getByRole('button', { name: /إضافة 20/ }));
        expect(submissions).toHaveLength(0);
        await confirm(user);

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'post', url: '/subscriptions/12/charges' });
        expect(submissions[0].data).toMatchObject({ type: 'disconnection_fee', amount: '20' });
    });

    it('will not charge a penalty without its reason', async () => {
        const user = userEvent.setup();
        open();

        await user.type(screen.getByLabelText('مبلغ التحميل'), '15');
        const submit = screen.getByRole('button', { name: /إضافة 15/ });
        expect(submit.disabled).toBe(true);

        await user.type(screen.getByLabelText('سبب الغرامة'), 'تلاعب بالعداد');
        expect(submit.disabled).toBe(false);
        await user.click(submit);
        await confirm(user);

        expect(submissions[0].data).toMatchObject({ type: 'penalty', amount: '15', notes: 'تلاعب بالعداد' });
    });

    it('locks the minimum charge at the subscription minimum', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('radio', { name: /تحميل الحد الأدنى/ }));
        const amount = screen.getByLabelText('مبلغ التحميل');

        expect(amount.value).toBe('35.00');
        expect(amount.readOnly).toBe(true);
    });

    it('shows the balance the charge will leave', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('radio', { name: /رسوم قطع الخدمة/ }));

        expect(within(document.body).getAllByText(/120/).length).toBeGreaterThan(0);
    });

    it('writes the charge under the account\'s last lines, leaving out cancelled ones', async () => {
        const user = userEvent.setup();
        const recentLines = [
            { id: 1, lineNumber: 1, date: '2026-11-12 09:00', description: 'قراءة أسبوعية', amount: '180.00', isCredit: false, balance: '180.00' },
            { id: 2, lineNumber: 2, date: '2026-11-15 09:00', description: 'دفعة نقدية', amount: '100.00', isCredit: true, balance: '80.00' },
            { id: 3, lineNumber: 3, date: '2026-11-16 09:00', description: 'دفعة ملغاة', amount: '50.00', isCredit: true, balance: '30.00', cancellation: { reason: 'خطأ' } },
        ];
        render(<ChargeModal show onClose={() => {}} subscription={subscription} balance="80.00" chargeTypes={chargeTypes} recentLines={recentLines} />);

        const ledger = screen.getByRole('region', { name: 'كشف الحساب والسطر الجديد' });
        expect(within(ledger).getByText('قراءة أسبوعية')).toBeTruthy();
        expect(within(ledger).getByText('دفعة نقدية')).toBeTruthy();
        expect(within(ledger).queryByText('دفعة ملغاة')).toBeNull();

        await user.type(screen.getByLabelText('مبلغ التحميل'), '25');
        expect(within(ledger).getAllByText(/105/).length).toBeGreaterThan(0);
    });
});
