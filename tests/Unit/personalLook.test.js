import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_LOOK, isCustomLook, lookStylesheet, normalizeLook } from '../../resources/js/lib/personalLook.js';

test('a stored look keeps only choices the interface can draw', () => {
    assert.deepEqual(normalizeLook(null), EMPTY_LOOK);
    assert.deepEqual(normalizeLook({ background: 'midnight', glass: 0.43, blur: 13, color: '#7c3aed', motion: 'off' }), {
        glass: 0.45,
        blur: 14,
        color: '#7C3AED',
        motion: 'off',
    });
    assert.deepEqual(normalizeLook({ background: 'pink', glass: 'clear', blur: null, color: 'red', motion: 'on' }), EMPTY_LOOK);
});

test('glass and blur stay inside the ranges the company tokens allow', () => {
    assert.equal(normalizeLook({ glass: 0.05 }).glass, 0.2);
    assert.equal(normalizeLook({ glass: 3 }).glass, 0.9);
    assert.equal(normalizeLook({ blur: -10 }).blur, 0);
    assert.equal(normalizeLook({ blur: 99 }).blur, 40);
});

test('only a look that changes something is custom, and only a colour adds shades', () => {
    assert.equal(isCustomLook(EMPTY_LOOK), false);
    assert.equal(isCustomLook({ glass: 0.4 }), true);
    assert.equal(lookStylesheet({ glass: 0.4 }), '');
    const css = lookStylesheet({ color: '#047857' });
    assert.match(css, /^:root\{--brand-50:/);
    assert.match(css, /--brand-solid:/);
    assert.match(css, /\.dark\{--brand-50:/);
});
