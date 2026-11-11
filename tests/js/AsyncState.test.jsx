import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import SplitPaymentDetails from '@/Pages/Payments/SplitPaymentDetails';
import { failNext, respondTo, submissions } from './inertia.jsx';

const split = { id: 3, total: '200.00', partsCount: 2, bankName: 'بنك فلسطين', referenceNumber: 'FT-1', senderName: 'سامي', parts: [], complete: true };

describe('loading data with a way to try again', () => {
    it('says why the details did not load, and loads them on retry', async () => {
        const user = userEvent.setup();
        failNext('/split-payments/3', 403, { message: 'لا تملك صلاحية عرض هذه الدفعة.' });
        respondTo('/split-payments/3', split);
        render(<SplitPaymentDetails id={3} onClose={() => {}} />);

        expect((await screen.findByRole('alert')).textContent).toContain('لا تملك صلاحية عرض هذه الدفعة.');
        await user.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));

        expect(await screen.findByText('المبلغ المحوَّل')).toBeTruthy();
        expect(submissions.filter((submission) => submission.url === '/split-payments/3')).toHaveLength(2);
    });
});
