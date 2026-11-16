import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TopBar from '@/Components/TopBar/TopBar';
import Sidebar from '@/Components/TopBar/Sidebar';
import { allowedNavigationGroups } from '@/lib/navigation';
import { setPage } from './inertia.jsx';

const groups = allowedNavigationGroups({ viewSubscriptions: true, viewTariffs: true });
const actions = [{ id: 'pay', label: 'تسجيل دفعة', icon: 'banknotes', key: 'P' }];
const callbacks = { onOpenPalette: vi.fn(), onOpenDrawer: vi.fn(), onShowShortcuts: vi.fn(), onStartTour: vi.fn() };

function renderBar(props = {}) {
    setPage({ props: { auth: { user: { name: 'سامي', roleLabel: 'محصّل' } }, can: {} }, url: '/subscriptions' });
    return render(<TopBar actions={actions} {...callbacks} {...props} />);
}

describe('the sidebar and top bar', () => {
    it.each([
        [{ name: 'العجل والكفارنة', logos: { main: '/images/logo-ma.svg' } }],
        [{ name: 'شركة النور', logos: { main: '/logo.svg', light: '/logo.svg' } }],
    ])('displays the company identity %j', (brand) => {
        render(<Sidebar brand={brand} groups={groups} lastPages={{}} badges={{}} />);
        expect(screen.getByText(brand.name, { exact: true })).toBeTruthy();
    });

    it.each(['mouse', 'keyboard'])('opens the last available section page by %s', async (input) => {
        const user = userEvent.setup();
        const navigate = vi.fn((event) => event.preventDefault());
        render(<Sidebar brand={{ name: 'شركة النور' }} groups={groups} lastPages={{ daily: '/subscriptions/bulk-changes' }} badges={{}} onNavigate={navigate} />);
        const section = screen.getByRole('link', { name: 'المشتركون', exact: true });
        expect(section.getAttribute('href')).toBe('/subscriptions/bulk-changes');
        if (input === 'mouse') {
            await user.click(section);
        } else {
            section.focus();
            await user.keyboard('{Enter}');
        }

        expect(navigate).toHaveBeenCalledTimes(1);
    });

    it('opens the quick actions by keyboard and restores focus on Escape', async () => {
        const user = userEvent.setup();
        renderBar();
        const trigger = screen.getByRole('button', { name: 'إجراء سريع' });
        trigger.focus();
        await user.keyboard('{Enter}');
        expect(screen.getByRole('dialog', { name: 'إجراءات سريعة' })).toBeTruthy();

        await user.keyboard('{Escape}');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(trigger);
    });

    it('closes open quick actions when another window opens', async () => {
        const user = userEvent.setup();
        const { rerender } = renderBar();
        const trigger = screen.getByRole('button', { name: 'إجراء سريع' });
        await user.click(trigger);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');

        act(() => rerender(<TopBar actions={actions} layerOpen {...callbacks} />));
        await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
    });

    it('puts section tabs, search, theme and glass in the top bar', () => {
        renderBar({ subnav: <div role="tablist" aria-label="صفحات القسم" /> });
        expect(screen.getByRole('banner').contains(screen.getByRole('tablist'))).toBe(true);
        expect(screen.getByRole('button', { name: /Ctrl K/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /التبديل إلى الوضع/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'المظهر الزجاجي' })).toBeTruthy();
    });
});
