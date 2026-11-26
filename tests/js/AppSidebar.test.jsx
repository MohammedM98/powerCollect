import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppSidebar from '@/Components/Layout/AppSidebar';
import { allowedNavigationGroups } from '@/lib/navigation';
import { setPage, submissions } from './inertia.jsx';

const groups = allowedNavigationGroups({ viewSubscriptions: true, viewTariffs: true });
const administration = groups.find((group) => group.id === 'administration');
const tariffs = administration.links.find((link) => link.href === '/tariffs');

function renderSidebar(url = '/subscriptions') {
    setPage({ props: { auth: { user: { name: 'سامي', roleLabel: 'محصّل' } }, can: {} }, url });
    return render(<AppSidebar groups={groups} badges={{ '/tariffs': 3 }} />);
}

const sections = () => screen.getByRole('navigation', { name: 'أقسام النظام' });
const sectionButton = (group) => within(sections()).getByRole('button', { name: new RegExp(group.label) });

describe('the side bar', () => {
    beforeEach(() => localStorage.clear());

    it('opens wide with the current section expanded and its page marked', () => {
        renderSidebar();

        expect(document.documentElement.dataset.side).toBe('wide');
        expect(sectionButton(groups.find((group) => group.id === 'daily')).getAttribute('aria-expanded')).toBe('true');
        expect(within(sections()).getByRole('link', { name: 'المشتركون' }).getAttribute('aria-current')).toBe('page');
        expect(sectionButton(administration).getAttribute('aria-expanded')).toBe('false');
    });

    it("opens a section's pages under it when it is clicked, with what waits there, and goes to a page", async () => {
        const user = userEvent.setup();
        renderSidebar();

        await user.click(sectionButton(administration));

        expect(sectionButton(administration).getAttribute('aria-expanded')).toBe('true');
        const link = await within(sections()).findByRole('link', { name: new RegExp(tariffs.label) });
        expect(link.textContent).toContain('3');
        await user.click(link);
        expect(submissions.at(-1)).toMatchObject({ method: 'get', url: '/tariffs' });
    });

    it('changes width only from its toggle, never from the pointer passing over it', async () => {
        const user = userEvent.setup();
        renderSidebar();
        const side = screen.getByRole('complementary', { name: 'الشريط الجانبي' });

        await user.hover(side);
        await user.unhover(side);
        expect(document.documentElement.dataset.side).toBe('wide');

        await user.click(screen.getByRole('button', { name: 'تصغير الشريط الجانبي' }));
        expect(document.documentElement.dataset.side).toBe('rail');
        expect(localStorage.getItem('side')).toBe('rail');
        expect(within(sections()).queryByText(administration.label)).toBeNull();

        await user.click(screen.getByRole('button', { name: 'توسيع الشريط الجانبي' }));
        expect(document.documentElement.dataset.side).toBe('wide');
    });

    it("opens a section's pages as a drop-down from the compact rail", async () => {
        localStorage.setItem('side', 'rail');
        const user = userEvent.setup();
        renderSidebar();

        await user.click(sectionButton(administration));

        const menu = await screen.findByRole('menu', { name: new RegExp(administration.label) });
        expect(within(menu).getByRole('menuitem', { name: new RegExp(tariffs.label) })).toBeTruthy();
    });

    it('opens a section with Alt and its number on a wide screen', () => {
        vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
        renderSidebar();

        act(() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { code: `Digit${groups.indexOf(administration) + 1}`, altKey: true }));
        });

        expect(sectionButton(administration).getAttribute('aria-expanded')).toBe('true');
    });
});
