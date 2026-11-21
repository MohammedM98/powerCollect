import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ConfirmDialog, Window } from '@/Components/UI';

function Stacked() {
    const [outer, setOuter] = useState(false);
    const [inner, setInner] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setOuter(true)}>افتح النافذة</button>
            <Window show={outer} onClose={() => setOuter(false)}>
                <h2>النافذة الأولى</h2>
                <button type="button" onClick={() => setInner(true)}>اسأل</button>
                <ConfirmDialog show={inner} title="متأكد؟" message="سؤال فوق النافذة" onConfirm={() => setInner(false)} onCancel={() => setInner(false)} />
            </Window>
        </>
    );
}

describe('the kit window', () => {
    it('is a dialog named by its heading, Escape closes only the newest, and focus goes back to the opener', async () => {
        const user = userEvent.setup();
        render(<Stacked />);

        const opener = screen.getByRole('button', { name: 'افتح النافذة' });
        await user.click(opener);
        expect(screen.getByRole('dialog', { name: 'النافذة الأولى' })).toBeTruthy();
        expect(document.documentElement.dataset.modalOpen).toBeDefined();

        await user.click(screen.getByRole('button', { name: 'اسأل' }));
        expect(await screen.findByRole('alertdialog', { name: 'متأكد؟' })).toBeTruthy();

        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'اسأل' })));
        expect(screen.getByRole('dialog', { name: 'النافذة الأولى' })).toBeTruthy();

        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        await waitFor(() => expect(document.activeElement).toBe(opener));
        expect(document.documentElement.dataset.modalOpen).toBeUndefined();
    });
});
