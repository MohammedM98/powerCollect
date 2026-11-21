import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import BulkChangeModal from '@/Pages/Subscriptions/BulkChangeModal';
import { rejectNext, setPage, submissions } from './inertia.jsx';

const statusOptions = [
    { value: 'active', label: 'فعّال' },
    { value: 'suspended', label: 'موقوف' },
    { value: 'disconnected', label: 'مفصول' },
];

function open(field) {
    render(<BulkChangeModal field={field} selection={{ ids: [2, 4, 5] }} count={3} statusOptions={statusOptions} onClose={() => {}} onDone={() => {}} />);
}

describe('BulkChangeModal', () => {
    beforeEach(() => {
        setPage({ props: { errors: {} } });
    });

    it('sets the chosen status on the ticked subscriptions after the person reviews it', async () => {
        const user = userEvent.setup();
        open('status');

        await user.click(screen.getByRole('radio', { name: /مفصول/ }));
        await user.click(screen.getByRole('button', { name: 'مراجعة التعديل' }));
        expect(submissions).toHaveLength(0);
        await user.click(screen.getByRole('button', { name: 'تأكيد التطبيق على 3 اشتراك' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0]).toMatchObject({ method: 'post', url: '/subscriptions/bulk-changes' });
        expect(submissions[0].data).toEqual({ field: 'status', mode: undefined, value: 'disconnected', expected_count: 3, ids: [2, 4, 5] });
    });

    it('will not review a minimum charge above 100000', async () => {
        const user = userEvent.setup();
        open('minimum_charge');

        await user.type(screen.getByLabelText('الحد الأدنى الأسبوعي الجديد (شيكل)'), '100001');

        expect(screen.getByRole('button', { name: 'مراجعة التعديل' }).disabled).toBe(true);
        expect(submissions).toHaveLength(0);
    });

    it('returns to the amount with the server\'s refusal under it and stays open', async () => {
        const user = userEvent.setup();
        open('minimum_charge');
        rejectNext({ value: 'الحد الأدنى أكبر من المسموح لهذا الفرع.' });

        await user.type(screen.getByLabelText('الحد الأدنى الأسبوعي الجديد (شيكل)'), '50');
        await user.click(screen.getByRole('button', { name: 'مراجعة التعديل' }));
        await user.click(screen.getByRole('button', { name: 'تأكيد التطبيق على 3 اشتراك' }));

        expect(submissions).toHaveLength(1);
        expect(submissions[0].data).toMatchObject({ field: 'minimum_charge', mode: 'amount', value: '50' });
        expect(screen.getByRole('alert').textContent).toBe('الحد الأدنى أكبر من المسموح لهذا الفرع.');
        expect(screen.getByLabelText('الحد الأدنى الأسبوعي الجديد (شيكل)').value).toBe('50');
        expect(screen.getByRole('dialog', { name: 'تغيير الحد الأدنى' })).toBeTruthy();
    });
});
