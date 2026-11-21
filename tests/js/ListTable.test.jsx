import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Input } from '@heroui/react';
import { describe, expect, it, vi } from 'vitest';
import { BandRow, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable } from '@/Components/UI';

function Sheet({ onOpen, onKey, onSort, rows = [{ id: 1, name: 'سامي' }] }) {
    const [value, setValue] = useState('');

    return (
        <ListTable aria-label="القائمة" sort={{ sort: 'name', direction: 'asc' }} onSort={onSort}>
            <ListHeader>
                <ListColumn id="name" sortable isRowHeader>الاسم</ListColumn>
                <ListColumn id="reading">القراءة</ListColumn>
                <ListColumn actions />
            </ListHeader>
            <ListBody empty="لا توجد نتائج مطابقة.">
                {rows.flatMap((row) => [
                    <BandRow key={`band-${row.id}`} id={`band-${row.id}`} columns={3}>منطقة {row.id}</BandRow>,
                    <ListRow key={row.id} id={row.id} onOpen={() => onOpen(row)}>
                        <ListCell>{row.name}</ListCell>
                        <ListCell><Input aria-label="القراءة" value={value} onChange={(event) => setValue(event.target.value)} /></ListCell>
                        <ListCell><Button onPress={onKey}>تعديل</Button></ListCell>
                    </ListRow>,
                ])}
            </ListBody>
        </ListTable>
    );
}

describe('the kit list table', () => {
    it('opens a row when pressed, but not from its own keys, and fields inside take every key', async () => {
        const user = userEvent.setup();
        const onOpen = vi.fn();
        const onKey = vi.fn();
        render(<Sheet onOpen={onOpen} onKey={onKey} onSort={vi.fn()} />);

        expect(screen.getByRole('grid', { name: 'القائمة' })).toBeTruthy();
        expect(screen.getByRole('columnheader', { name: 'الإجراءات' })).toBeTruthy();
        expect(screen.getByText('منطقة 1').closest('td').colSpan).toBe(3);

        await user.click(screen.getByRole('button', { name: 'تعديل' }));
        expect(onKey).toHaveBeenCalledTimes(1);
        expect(onOpen).not.toHaveBeenCalled();

        const field = screen.getByRole('textbox', { name: 'القراءة' });
        await user.click(field);
        await user.keyboard('12 3{ArrowLeft}{ArrowRight}{Home}9{End}4');
        expect(field.value).toBe('912 34');
        expect(document.activeElement).toBe(field);
        expect(onOpen).not.toHaveBeenCalled();

        await user.click(screen.getByRole('rowheader', { name: 'سامي' }));
        expect(onOpen).toHaveBeenCalledWith({ id: 1, name: 'سامي' });
    });

    it('sorts from the header and shows the empty line when there are no rows', async () => {
        const user = userEvent.setup();
        const onSort = vi.fn();
        render(<Sheet onOpen={vi.fn()} onKey={vi.fn()} onSort={onSort} rows={[]} />);

        expect(screen.getByRole('columnheader', { name: 'الاسم' }).getAttribute('aria-sort')).toBe('ascending');
        await user.click(screen.getByRole('columnheader', { name: 'الاسم' }));
        expect(onSort).toHaveBeenCalledWith('name');
        expect(screen.getByText('لا توجد نتائج مطابقة.')).toBeTruthy();
    });
});
