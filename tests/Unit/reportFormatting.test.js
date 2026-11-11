import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cents, periodLabel } from '../../resources/js/lib/reportFormatting.ts';

test('amounts compare in whole cents, a missing one as zero', () => {
    assert.equal(cents('12.345'), 1235);
    assert.equal(cents(0.1 + 0.2), 30);
    assert.equal(cents(null), 0);
});

test('each kind of period has its report name, an open custom one called current', () => {
    assert.equal(periodLabel('daily'), 'تقرير يومي');
    assert.equal(periodLabel('weekly'), 'تقرير أسبوعي');
    assert.equal(periodLabel('monthly'), 'تقرير شهري');
    assert.equal(periodLabel('custom', { isOpen: true }), 'تقرير جارٍ');
    assert.equal(periodLabel('custom', { isOpen: false }), 'تقرير مخصص');
});
