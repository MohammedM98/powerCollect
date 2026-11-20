import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAmount, formatShekels, fromCents, toCents } from '../../resources/js/lib/currency.ts';

test('amounts become whole cents, with empty or unreadable input as zero', () => {
    assert.equal(toCents('12.345'), 1235);
    assert.equal(toCents(0.1 + 0.2), 30);
    assert.equal(toCents(''), 0);
    assert.equal(toCents(undefined), 0);
    assert.equal(toCents('abc'), 0);
});

test('cents come back as the amount', () => {
    assert.equal(fromCents(1235), 12.35);
    assert.equal(fromCents(toCents('99.99')), 99.99);
});

test('a field amount has no separators and never shows a negative zero; shown amounts have separators', () => {
    assert.equal(formatAmount(12170.5), '12170.50');
    assert.equal(formatAmount(-0.004), '0');
    assert.equal(formatAmount('50'), '50');
    assert.equal(formatShekels(12170.5), '12,170.50 ₪');
});
