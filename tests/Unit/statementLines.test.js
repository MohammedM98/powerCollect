import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLUMN_WIDTHS, filtersCaption, followsLineAbove, hasLineMenu, rowClass, STATEMENT_COLUMNS, transactionNoun } from '../../resources/js/lib/accountStatement.js';

const NO_FILTERS = { search: '', type: '', method: '', dateFrom: '', dateTo: '', sort: '' };

test('a line has a menu for its actions, its reading or its receipt, and none otherwise', () => {
    assert.equal(hasLineMenu({ available_actions: ['cancel'] }), true);
    assert.equal(hasLineMenu({ reading: { id: 4 } }), true);
    assert.equal(hasLineMenu({ receiptUrl: '/receipts/9' }), true);
    assert.equal(hasLineMenu({ available_actions: [] }), false);
});

test('each kind of line is named in the menu, with a general name for the rest', () => {
    assert.equal(transactionNoun({ type: 'payment' }), 'الدفعة');
    assert.equal(transactionNoun({ type: 'reading_discount' }), 'خصم القراءة الأسبوعية');
    assert.equal(transactionNoun({ type: 'meter_reading' }), 'الحركة');
});

test('the printed caption names each filter set, and is empty without any', () => {
    const types = [{ value: 'payment', label: 'دفعة' }];
    const methods = [{ value: 'cash', label: 'نقد' }];

    assert.equal(filtersCaption(NO_FILTERS, types, methods), '');
    assert.equal(
        filtersCaption({ ...NO_FILTERS, type: 'payment', method: 'cash', dateFrom: '2026-10-01', search: '  أحمد ' }, types, methods),
        'نوع الحركة: دفعة · طريقة الدفع: نقد · من 2026-10-01 · بحث: «أحمد»',
    );
    assert.equal(filtersCaption({ ...NO_FILTERS, type: 'debit' }, types, methods), 'نوع الحركة: كل ما عليه (تحميل)');
});

test('a reversal follows the line above only when it is the very next line', () => {
    assert.equal(followsLineAbove({ isFollowUp: true, lineNumber: 5, reverses: { lineNumber: 4 } }), true);
    assert.equal(followsLineAbove({ isFollowUp: true, lineNumber: 7, reverses: { lineNumber: 4 } }), false);
    assert.equal(followsLineAbove({ isFollowUp: false, lineNumber: 5, reverses: { lineNumber: 4 } }), false);
});

test('a row is marked cancelled, focused, related, folded or following, and plain otherwise', () => {
    assert.equal(rowClass({ cancellation: true }, false, false, false, false), 'ledger-cancelled');
    assert.equal(rowClass({}, false, true, true, true), 'ledger-focused ledger-related ledger-history');
    assert.equal(rowClass({ isFollowUp: true, lineNumber: 3, reverses: { lineNumber: 2 } }, false, false, false, false), 'ledger-follow-up');
    assert.equal(rowClass({}, false, false, false, false), undefined);
});

test('every statement column has a width', () => {
    assert.equal(COLUMN_WIDTHS.length, STATEMENT_COLUMNS.length);
});
