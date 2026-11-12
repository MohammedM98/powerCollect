import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queryString, queryValue, urlWith, urlWithout } from '../../resources/js/lib/pageUrl.js';

test('a query value is read from the page address, or null when missing', () => {
    assert.equal(queryValue('/cash-boxes?place=closed&box=12', 'box'), '12');
    assert.equal(queryValue('/cash-boxes', 'box'), null);
});

test('closing a window drops its key and keeps the rest of the address', () => {
    assert.equal(urlWithout('/subscriptions?search=أحمد&statement=5&page=2', 'statement'), `/subscriptions?search=${encodeURIComponent('أحمد')}&page=2`);
    assert.equal(urlWithout('/dashboard?edit=3', 'edit'), '/dashboard');
    assert.equal(urlWithout('/dashboard', 'edit'), '/dashboard');
});

test('values are set in the query, and empty ones left out', () => {
    assert.equal(urlWith('/print?view=full', { view: 'compact', subscription: 9, box: null }), '/print?view=compact&subscription=9');
});

test('the query string keeps its question mark, and is empty without one', () => {
    assert.equal(queryString('/meter-boxes?sort=box_number&direction=asc'), '?sort=box_number&direction=asc');
    assert.equal(queryString('/meter-boxes'), '');
});
