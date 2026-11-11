import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discountPreview, fieldFor, standingTerms, withSegment } from '../../resources/js/lib/discountTerms.js';

test('a one-off discount asks for shekels; a standing one by its method', () => {
    assert.equal(fieldFor('once', 'percentage', 5).unit, '₪');
    assert.equal(fieldFor('standing', 'percentage', 5).unit, '%');
    assert.equal(fieldFor('standing', 'kilowatt', 5).label, 'الكيلوات المجانية كل أسبوع');
    assert.match(fieldFor('standing', 'shekel', 5).hint, /سعر الكيلو/);
});

test('standing terms read with their unit, and with the segment when there is one', () => {
    assert.equal(standingTerms('percentage', 10), '10%');
    assert.equal(standingTerms('kilowatt', 3), '3 كيلو');
    assert.equal(withSegment(standingTerms('percentage', 10), 'شريحة 2'), '10% · شريحة 2');
    assert.equal(withSegment('10%', null), '10%');
});

const subscription = { kiloPrice: '2.00', minimumPayment: '15.00', lastConsumption: '50' };
const methods = [{ value: 'shekel' }, { value: 'percentage' }, { value: 'kilowatt' }];

test('a one-off discount comes off what is owed, and may not take it below zero', () => {
    const preview = discountPreview({ kind: 'once', method: 'shekel', value: '30' }, subscription, 100, methods);
    assert.equal(preview.discount, 30);
    assert.equal(preview.balanceAfter, 70);
    assert.equal(preview.invalid, null);
    assert.deepEqual(preview.methods, []);
    assert.deepEqual(preview.steps, { kind: 1, value: 2, notes: 3 });

    assert.match(discountPreview({ kind: 'once', method: 'shekel', value: '130' }, subscription, 100, methods).invalid, /لا يمكن أن يزيد الخصم/);
    assert.equal(discountPreview({ kind: 'once', method: 'shekel', value: '5' }, subscription, -20, methods).invalid, 'لا يوجد رصيد مستحق على المشترك ليُخصم منه.');
});

test('a standing discount is shown on the last week read, within its limits', () => {
    const preview = discountPreview({ kind: 'standing', method: 'percentage', value: '10' }, subscription, 100, methods);
    assert.equal(preview.example.kilos, 50);
    assert.equal(preview.exampleBill.amountDue, 100);
    assert.equal(preview.exampleWithDiscount.amountDue, 90);
    assert.equal(preview.weeklySaving, 10);
    assert.equal(preview.discount, null);
    assert.deepEqual(preview.methods, ['percentage', 'kilowatt', 'shekel']);
    assert.deepEqual(preview.steps, { kind: 1, method: 2, value: 3, segment: 4, notes: 5 });

    assert.equal(discountPreview({ kind: 'standing', method: 'percentage', value: '120' }, subscription, 100, methods).invalid, 'النسبة لا تزيد عن 100%.');
    assert.match(discountPreview({ kind: 'standing', method: 'shekel', value: '3' }, subscription, 100, methods).invalid, /سعر الكيلو/);
    assert.equal(discountPreview({ kind: 'standing', method: 'kilowatt', value: '1' }, { ...subscription, lastConsumption: 0 }, 0, methods).example.kilos, 10);
});

test('correcting a discount leaves out the kind step', () => {
    assert.deepEqual(discountPreview({ kind: 'once', method: 'shekel', value: '5' }, subscription, 50, methods, { id: 3 }).steps, { value: 1, notes: 2 });
});
