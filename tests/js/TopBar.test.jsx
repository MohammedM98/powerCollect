import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import TopBar from '@/Components/TopBar/TopBar';
import { allowedNavigationGroups } from '@/lib/navigation';
import { setPage, submissions } from './inertia.jsx';

const groups = allowedNavigationGroups({ viewSubscriptions: true, viewTariffs: true });
const administration = groups.find((group) => group.id === 'administration');

function renderBar(props = {}) {
    setPage({ props: { appName: 'شركة الكهرباء', auth: { user: { name: 'سامي', roleLabel: 'محصّل' } }, can: {} }, url: '/subscriptions' });
    return render(<TopBar groups={groups} badges={{}} onOpenPalette={() => {}} onOpenDrawer={() => {}} onShowShortcuts={() => {}} onStartTour={() => {}} {...props} />);
}

const sectionButton = () => screen.getByRole('button', { name: new RegExp(administration.label) });

describe('the top bar', () => {
    it('opens a section from the keyboard, and Esc closes it back onto its button', async () => {
        const user = userEvent.setup();
        renderBar();

        sectionButton().focus();
        await user.keyboard('{Enter}');
        expect(sectionButton().getAttribute('aria-expanded')).toBe('true');
        const tariffs = administration.links.find((link) => link.href === '/tariffs');
        expect(await screen.findByRole('link', { name: new RegExp(tariffs.label) })).toBeTruthy();

        await user.keyboard('{Escape}');
        expect(sectionButton().getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(sectionButton());
    });

    it("goes to a section's first page when it is clicked with the mouse", async () => {
        const user = userEvent.setup();
        renderBar();

        await user.click(sectionButton());

        expect(submissions.at(-1)).toMatchObject({ method: 'get', url: administration.links.find((link) => !link.locked).href });
    });

    it('closes an open section when a window opens over the page', async () => {
        const user = userEvent.setup();
        const { rerender } = renderBar();

        sectionButton().focus();
        await user.keyboard('{Enter}');
        expect(sectionButton().getAttribute('aria-expanded')).toBe('true');

        act(() => rerender(<TopBar groups={groups} badges={{}} layerOpen onOpenPalette={() => {}} onOpenDrawer={() => {}} onShowShortcuts={() => {}} onStartTour={() => {}} />));
        await waitFor(() => expect(sectionButton().getAttribute('aria-expanded')).toBe('false'));
    });

    it('loads the appearance panel when it is first opened, under its button and focused', async () => {
        const user = userEvent.setup();
        renderBar();

        await user.click(screen.getByRole('button', { name: 'المظهر: الوضع والألوان والشفافية' }));

        const panel = await screen.findByRole('dialog', { name: 'المظهر' });
        await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
        expect(panel.style.top).not.toBe('');

        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'المظهر' })).toBeNull());
    });
});
