import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AmendTransactionModal from '@/Pages/Subscriptions/AmendTransactionModal';
import { submissions } from './inertia.jsx';

const transfer = {
    id: 41,
    amount: '150.00',
    currencyLabel: 'شيكل',
    paymentMethod: 'bank_transfer',
    paymentMethodLabel: 'تحويل بنكي',
    bankName: 'بنك فلسطين',
    senderBankName: '',
    senderName: 'سامي',
    referenceNumber: 'FT-100',
    bankReceivedOn: null,
    details: '',
};

function open(entry = transfer) {
    render(<AmendTransactionModal onClose={() => {}} subscription={{ id: 7 }} balance="-150.00" entry={entry} transferBanks={['بنك فلسطين', 'بنك القدس']} senderBanks={['بنك الأردن']} />);
}

describe('AmendTransactionModal', () => {
    it('changes only the descriptive details, after the person confirms', async () => {
        const user = userEvent.setup();
        open();

        // HeroUI's select: open its key (named by the page's label), then pick the bank.
        await user.click(screen.getByRole('button', { name: /البنك المستلم/ }));
        await user.click(await screen.findByRole('option', { name: 'بنك القدس' }));
        await user.type(screen.getByLabelText('سبب التعديل'), 'اختير البنك الخطأ');
        await user.click(screen.getByRole('button', { name: 'حفظ التعديل' }));

        expect(submissions).toHaveLength(0);
        await user.click(screen.getByRole('button', { name: 'نعم، احفظ التعديل' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0].method).toBe('post');
        expect(submissions[0].url).toBe('/subscriptions/7/transactions/41/actions');
        expect(submissions[0].data).toMatchObject({ action: 'edit_metadata', bank_name: 'بنك القدس', reference_number: 'FT-100', amendment_reason: 'اختير البنك الخطأ' });
        expect(submissions[0].data).not.toHaveProperty('amount');
        expect(submissions[0].data).not.toHaveProperty('currency');
    });

    it('does not send without a reason for the change', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('button', { name: 'حفظ التعديل' }));

        expect(screen.queryByRole('button', { name: 'نعم، احفظ التعديل' })).toBeNull();
        expect(submissions).toHaveLength(0);
    });

    it('offers no bank fields for a cash payment', () => {
        open({ ...transfer, paymentMethod: 'cash', paymentMethodLabel: 'نقدي' });

        expect(screen.queryByRole('button', { name: /البنك المستلم/ })).toBeNull();
        expect(screen.getByLabelText('سبب التعديل')).toBeTruthy();
    });
});
