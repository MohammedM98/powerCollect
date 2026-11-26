import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TopBar from '@/Components/Layout/TopBar';
import { setPage } from './inertia.jsx';

function renderBar(props = {}, brand) {
    setPage({ props: { appName: 'PowerCollect', auth: { user: { name: 'سامي', roleLabel: 'محصّل' } }, can: {}, brand }, url: '/subscriptions' });
    return render(<TopBar onOpenPalette={() => {}} onOpenDrawer={() => {}} onShowShortcuts={() => {}} onStartTour={() => {}} {...props} />);
}

describe('the top bar', () => {
    it.each([
        [undefined, 'مصعب العجل وأحمد الكفارنة'],
        [{ name: 'شركة النور', logos: { main: '/logo.svg', light: '/logo.svg' } }, 'شركة النور'],
    ])('displays the company identity %j as %s', (brand, name) => {
        renderBar({}, brand);

        expect(screen.getByText(name, { exact: true })).toBeTruthy();
    });

    it("shows the section's pages as tabs inside the bar, one appearance key and no account menu", () => {
        renderBar({ subnav: <nav aria-label="صفحات القسم"><a href="/subscriptions">المشتركون</a></nav> });

        const bar = screen.getByRole('banner');
        expect(bar.contains(screen.getByRole('navigation', { name: 'صفحات القسم' }))).toBe(true);
        expect(screen.getByRole('button', { name: 'المظهر' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /^حسابك/ })).toBeNull();
    });
});
