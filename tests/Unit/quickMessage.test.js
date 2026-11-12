import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byId, recipientsUrl } from '../../resources/js/lib/quickMessage.js';

test('the recipients address asks for every status and lists the picked subscriptions', () => {
    const url = new URL(recipientsUrl({ kind: 'custom', search: 'أحمد' }, [4, 9]), 'http://app.test');

    assert.equal(url.pathname, '/messages/recipients');
    assert.equal(url.searchParams.get('status'), '');
    assert.equal(url.searchParams.get('kind'), 'custom');
    assert.equal(url.searchParams.get('search'), 'أحمد');
    assert.deepEqual(url.searchParams.getAll('subscription_ids[]'), ['4', '9']);
});

test('rows are keyed by subscription id', () => {
    assert.deepEqual(byId([{ id: 3, name: 'أ' }, { id: 5, name: 'ب' }]), { 3: { id: 3, name: 'أ' }, 5: { id: 5, name: 'ب' } });
});
