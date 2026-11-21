import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ArchiveSubscriptionModal from '@/Pages/Subscriptions/ArchiveSubscriptionModal';
import { rejectNext, submissions } from './inertia.jsx';

const subscription = { id: 14, display_name: 'سامي أحمد', account_number: '1042', outstandingBalance: '0.00', archivedAt: null };

function open(record = subscription) {
    render(<ArchiveSubscriptionModal subscription={record} today="2026-11-21" onClose={() => {}} />);
}

describe('ArchiveSubscriptionModal', () => {
    it('archives the subscription with its end date and reason once the person confirms', async () => {
        const user = userEvent.setup();
        open();

        await user.type(screen.getByLabelText('سبب إنهاء الخدمة والأرشفة'), 'أنهى المشترك الخدمة');
        await user.click(screen.getByRole('checkbox'));
        await user.click(screen.getByRole('button', { name: 'أرشفة الاشتراك المنتهي' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'post', url: '/subscriptions/14/archive' });
        expect(submissions[0].data).toEqual({ service_ended_on: '2026-11-21', reason: 'أنهى المشترك الخدمة', confirmed: true });
    });

    it('restores an archived subscription by deleting its archive', async () => {
        const user = userEvent.setup();
        open({ ...subscription, archivedAt: '2026-10-01' });

        await user.type(screen.getByLabelText('سبب الاستعادة'), 'عاد المشترك');
        await user.click(screen.getByRole('checkbox'));
        await user.click(screen.getByRole('button', { name: 'استعادة الاشتراك من الأرشيف' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'delete', url: '/subscriptions/14/archive' });
    });

    it('cannot be sent without a reason and the confirmation', async () => {
        const user = userEvent.setup();
        open();
        const submit = screen.getByRole('button', { name: 'أرشفة الاشتراك المنتهي' });

        await user.click(screen.getByRole('checkbox'));

        expect(submit.disabled).toBe(true);
        await user.type(screen.getByLabelText('سبب إنهاء الخدمة والأرشفة'), 'انتهت الخدمة');
        expect(submit.disabled).toBe(false);
        expect(submissions).toHaveLength(0);
    });

    it('shows why the server refused and stays open', async () => {
        const user = userEvent.setup();
        open();
        rejectNext({ archive: 'لا يمكن أرشفة اشتراك عليه دين.' });

        await user.type(screen.getByLabelText('سبب إنهاء الخدمة والأرشفة'), 'أنهى المشترك الخدمة');
        await user.click(screen.getByRole('checkbox'));
        await user.click(screen.getByRole('button', { name: 'أرشفة الاشتراك المنتهي' }));

        expect(submissions).toHaveLength(1);
        expect(screen.getByRole('alert').textContent).toBe('لا يمكن أرشفة اشتراك عليه دين.');
        expect(screen.getByRole('dialog', { name: 'أرشفة الاشتراك المنتهي' })).toBeTruthy();
    });
});
