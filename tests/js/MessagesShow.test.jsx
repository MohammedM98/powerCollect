import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Show from '@/Pages/Messages/Show';
import { submissions } from './inertia.jsx';

vi.mock('@/Layouts/AuthenticatedLayout', () => ({ default: ({ header, children }) => <div>{header}{children}</div> }));

const batch = {
    id: 7, kind: 'custom', kindLabel: 'رسالة خاصة', channel: 'sms', channelLabel: 'SMS', body: 'مرحبا',
    branchName: 'الفرع', createdBy: 'أحمد', createdAt: '2026-11-21T08:00:00Z',
    total: 2, pending: 0, sent: 1, failed: 0, unconfirmed: 1,
};
const messages = {
    data: [
        { id: 31, subscriptionName: 'سامي أحمد', phone: '0599000001', body: 'مرحبا', status: 'unconfirmed', statusLabel: 'غير مؤكدة', error: 'لم تؤكد بوابة الرسائل الإرسال' },
        { id: 32, subscriptionName: 'ليلى حسن', phone: '0599000002', body: 'مرحبا', status: 'sent', statusLabel: 'أُرسلت', error: null },
    ],
    total: 2, current_page: 1, last_page: 1, per_page: 25, from: 1, to: 2, links: [],
};

function open(props = {}) {
    render(<Show batch={batch} messages={messages} canUpdate filters={{ per_page: 25 }} filterOptions={[]} {...props} />);
}

describe('Messages/Show', () => {
    it('settles an unconfirmed SMS as delivered only after the person confirms', async () => {
        const user = userEvent.setup();
        open();

        expect(screen.getAllByRole('button', { name: /وصلت الرسالة إلى/ })).toHaveLength(1);
        await user.click(screen.getByRole('button', { name: 'وصلت الرسالة إلى سامي أحمد' }));
        expect(submissions).toHaveLength(0);
        await user.click(await screen.findByRole('button', { name: 'نعم، وصلت' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'put', url: '/messages/7/messages/31/unconfirmed', data: { outcome: 'delivered' } });
    });

    it('sends an unconfirmed SMS again only after the person confirms it did not arrive', async () => {
        const user = userEvent.setup();
        open();

        await user.click(screen.getByRole('button', { name: 'أعد إرسال الرسالة إلى سامي أحمد' }));
        await user.click(await screen.findByRole('button', { name: 'نعم، أعد الإرسال' }));

        expect(submissions[0]).toMatchObject({ method: 'put', url: '/messages/7/messages/31/unconfirmed', data: { outcome: 'resend' } });
    });

    it('offers nothing to settle to someone who cannot change the send', () => {
        open({ canUpdate: false });

        expect(screen.queryByRole('button', { name: /وصلت الرسالة إلى/ })).toBeNull();
    });
});
