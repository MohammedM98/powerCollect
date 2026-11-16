import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import NavigationDrawer from '@/Components/TopBar/NavigationDrawer';
import { setPage } from './inertia.jsx';

const PAGE = { props: { appName: 'شركة الكهرباء', auth: { user: { name: 'سامي', role: 'collector' } }, can: {} }, url: '/subscriptions' };

function PhoneMenu() {
    const [open, setOpen] = useState(false);
    const menuButton = useRef(null);

    return <>
        <button type="button" ref={menuButton} onClick={() => setOpen(true)}>القائمة</button>
        <NavigationDrawer open={open} groups={[]} badges={{}} onClose={() => setOpen(false)} onOpenPalette={() => {}} returnFocusTo={menuButton} />
    </>;
}

describe('the phone menu', () => {
    it('slides out when closed, then leaves and gives focus back to the menu button', async () => {
        const user = userEvent.setup();
        setPage(PAGE);
        render(<PhoneMenu />);

        await user.click(screen.getByRole('button', { name: 'القائمة' }));
        const drawer = screen.getByRole('dialog', { name: 'قائمة التنقل' });
        expect(document.documentElement.classList.contains('tn-locked')).toBe(true);

        await user.keyboard('{Escape}');

        expect(drawer.parentElement.className).toContain('is-closing');
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(document.documentElement.classList.contains('tn-locked')).toBe(false);
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'القائمة' }));
    });

    it('opened again while sliding out, stays open', async () => {
        const user = userEvent.setup();
        setPage(PAGE);
        render(<PhoneMenu />);

        await user.click(screen.getByRole('button', { name: 'القائمة' }));
        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'القائمة', hidden: true }));
        await new Promise((resolve) => setTimeout(resolve, 300));

        expect(screen.getByRole('dialog', { name: 'قائمة التنقل' }).parentElement.className).not.toContain('is-closing');
    });

    it('closes when a page opened from it loads', async () => {
        const user = userEvent.setup();
        setPage(PAGE);
        const { rerender } = render(<PhoneMenu />);

        await user.click(screen.getByRole('button', { name: 'القائمة' }));
        setPage({ ...PAGE, url: '/payments' });
        act(() => rerender(<PhoneMenu />));

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
});
