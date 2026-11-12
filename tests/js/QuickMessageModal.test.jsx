import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import QuickMessageModal from '@/Pages/Messages/QuickMessageModal';
import { respondTo, submissions } from './inertia.jsx';

const SETUP = {
    weekStart: '2026-11-07',
    smsDeliversMessages: true,
    maxRecipients: 400,
    weekBranchId: 1,
    weekOptions: { 1: [{ value: '2026-11-07', label: 'أسبوع 7 نوفمبر' }] },
    kinds: [
        { value: 'custom', label: 'رسالة عامة' },
        { value: 'balance_reminder', label: 'تذكير بالرصيد' },
    ],
    channels: [
        { value: 'sms', label: 'رسالة نصية' },
        { value: 'whatsapp', label: 'واتساب' },
    ],
    placeholders: { custom: ['الاسم'], balance_reminder: ['الاسم', 'الرصيد'], weekly_reading: ['الاسم'] },
    templates: [{ id: 1, kind: 'custom', name: 'تحية', body: 'مرحبًا {الاسم}' }],
};

const person = (id, name, phone) => ({ id, name, phone, accountNumber: `A-${id}`, branchId: 1, variables: { الاسم: name } });

describe('the quick message', () => {
    it('reaches the picked subscribers with a phone and sends to them', async () => {
        const user = userEvent.setup();
        respondTo('/messages/quick', SETUP);
        respondTo('/messages/recipients', { recipients: [person(5, 'سامي', '0599000005'), person(6, 'ليلى', null)] });
        const onClose = vi.fn();
        render(<QuickMessageModal subscriptionIds={[5, 6]} onClose={onClose} />);

        expect(await screen.findByText('لا يوجد رقم هاتف')).toBeTruthy();
        expect(screen.getByText(/مرحبًا سامي/)).toBeTruthy();

        await user.click(screen.getByRole('button', { name: 'إرسال إلى 1 مشترك' }));
        await user.click(await screen.findByRole('button', { name: 'نعم، أرسل' }));

        const sent = submissions.find((submission) => submission.method === 'post' && submission.url === '/messages');
        expect(sent.data).toMatchObject({ kind: 'custom', channel: 'sms', body: 'مرحبًا {الاسم}', subscription_ids: [5], stay_on_page: true });
        expect(submissions.find((submission) => submission.url === '/messages/recipients').data).toMatchObject({ kind: 'custom', subscription_ids: [5, 6] });
    });

    it('holds back sending until the message has text', async () => {
        const user = userEvent.setup();
        respondTo('/messages/quick', { ...SETUP, templates: [] });
        respondTo('/messages/recipients', { recipients: [person(5, 'سامي', '0599000005')] });
        render(<QuickMessageModal subscriptionIds={[5]} onClose={() => {}} />);

        expect(await screen.findByText('اكتب نص الرسالة.')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'إرسال إلى 1 مشترك' }).disabled).toBe(true);

        await user.type(screen.getByRole('textbox', { name: /نص الرسالة/ }), 'تنبيه');
        await waitFor(() => expect(screen.getByRole('button', { name: 'إرسال إلى 1 مشترك' }).disabled).toBe(false));
    });

    it('says the window could not load when its setup fails', async () => {
        const { failNext } = await import('./inertia.jsx');
        failNext('/messages/quick', 500);
        render(<QuickMessageModal subscriptionIds={[]} onClose={() => {}} />);

        expect((await screen.findByRole('alert')).textContent).toContain('تعذّر تحميل نافذة الرسائل');
    });
});
