import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ExcelStudio from '@/Components/Excel/ExcelStudio';
import { tableExcelPart } from '@/lib/tableExcel';
import { respondTo, submissions } from './inertia.jsx';

const part = tableExcelPart(
    {
        columns: [
            { key: 'name', label: 'الاسم' },
            { key: 'balance', label: 'الرصيد' },
            { key: 'box', label: 'الطبلون' },
        ],
        rows: [
            { type: 'row', cells: { name: 'سامي', balance: '120.00', box: '12' } },
            { type: 'row', cells: { name: 'ليلى', balance: '35.50', box: '7' } },
        ],
    },
    { name: 'المشتركون' },
);

function renderStudio() {
    return render(<ExcelStudio show onClose={() => {}} title="تصدير المشتركين إلى Excel" storageKey="table:/subscriptions" templateKind="tables" loadParts={async () => [part]} defaults={{ title: 'المشتركون', fileName: 'المشتركون' }} />);
}

describe('the Excel studio', () => {
    it('previews the rows it loaded', async () => {
        respondTo('/excel-templates/tables', { templates: [], canManage: false });
        renderStudio();

        expect(await screen.findByText('سامي')).toBeTruthy();
        expect(screen.getByText('ليلى')).toBeTruthy();
        expect(screen.queryByRole('textbox', { name: 'اسم قالب الشركة' })).toBeNull();
    });

    it('saves the settings as a company template for whoever manages them', async () => {
        const user = userEvent.setup();
        respondTo('/excel-templates', { templates: [], canManage: true });
        renderStudio();

        await user.type(await screen.findByRole('textbox', { name: 'اسم قالب الشركة' }), 'تقرير الإدارة');
        await user.click(screen.getByRole('button', { name: 'حفظ للشركة' }));

        await waitFor(() => expect(submissions.some((submission) => submission.method === 'post' && submission.url === '/excel-templates')).toBe(true));
        const saved = submissions.find((submission) => submission.method === 'post' && submission.url === '/excel-templates');
        expect(saved.data).toMatchObject({ kind: 'tables', name: 'تقرير الإدارة', is_default: false });
        expect(saved.data.settings).toBeTruthy();
    });
});
