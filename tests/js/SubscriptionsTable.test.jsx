import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import SubscriptionsTable from '@/Pages/Subscriptions/SubscriptionsTable';
import { extractTable } from '@/lib/print';

// jsdom lays nothing out, so a cell's on-screen text is its text content.
beforeAll(() => {
    Object.defineProperty(window.HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent; } });
});

const subscription = {
    id: 7, account_number: '202600009', subscriber_number: '9', display_name: 'باسل الدباغ', contact_phone: '0599123456',
    subAreaId: 1, subAreaName: 'ابو هويشل', meterBoxName: 'هويشل 2', meterBoxNumber: '164683', branchName: 'مكتب مخيم 2',
    tariffCategory: 'home', tariffCategoryLabel: 'منزلي', tariffSegmentName: 'مساجد', weeklyMinimumPayment: '200',
    outstandingBalance: '280', status: 'active', statusLabel: 'نشط', subscriptionCount: 1, canUpdate: false, canDelete: false,
};

function renderTable(openStatement = vi.fn()) {
    render(
        <SubscriptionsTable
            allMatching={false} canSelect={false} filters={{}} headerCheckbox={{ current: null }} openStatement={openStatement}
            pageIds={[7]} pageSelectedCount={0} requestDelete={vi.fn()} rowClick={(open) => ({ onClick: open })} rowMenu={() => null}
            selectedIds={new Set()} setModalSubscription={vi.fn()} setViewingSubscriptionId={vi.fn()} sort={vi.fn()}
            subscriptions={{ data: [subscription] }} togglePage={vi.fn()} toggleSubscription={vi.fn()}
        />,
    );
    return openStatement;
}

describe("a subscription row's details on demand", () => {
    it('opens the type, category and branch under the row without opening the statement', async () => {
        const openStatement = renderTable();
        expect(screen.queryByText('مكتب مخيم 2')).toBeNull();

        await userEvent.setup().click(screen.getByRole('button', { name: 'عرض تفاصيل باسل الدباغ' }));

        expect(screen.getByText('مكتب مخيم 2')).toBeTruthy();
        expect(screen.getByText('مساجد')).toBeTruthy();
        expect(openStatement).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'إخفاء تفاصيل باسل الدباغ' }).getAttribute('aria-expanded')).toBe('true');
    });

    it('keeps the subscription type in exports and leaves the open details out', async () => {
        renderTable();
        await userEvent.setup().click(screen.getByRole('button', { name: 'عرض تفاصيل باسل الدباغ' }));

        const table = extractTable(document.body, document.querySelector('table'));

        expect(table.rows).toHaveLength(1);
        expect(table.columns.map((column) => column.label)).toContain('نوع الاشتراك');
        expect(table.rows[0].cells['field:tariffLabel']).toBe('منزلي، مساجد');
    });
});
