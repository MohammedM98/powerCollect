import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandPalette, brandStylesheet, brandRoleStylesheet, contrastWithWhite, darkButtons, dominantColors, MIN_CONTRAST } from '../../resources/js/lib/brandPalette.js';

test('semantic palette roles preview in light and dark without accepting CSS input', () => {
    const css = brandRoleStylesheet({ secondary: '#0F766E', accent: '#B45309', background: '#F3F6FB', surface: '#FFFFFF' });
    assert.match(css, /--brand-secondary-500:/);
    assert.match(css, /--brand-accent-on-solid:255 255 255/);
    assert.match(css, /--gray-50:243 246 251/);
    assert.match(css, /--surface:255 255 255/);
    assert.match(css, /\.dark\{/);
    assert.equal(brandRoleStylesheet({ accent: 'red;display:none', background: 'url(https://example.test)' }), '');
    assert.equal(brandRoleStylesheet({}), '');
});

// What app/Support/BrandPalette.php draws for the same colours: the preview must show what saving will.
const PHP_BLUE = {
    light: { 50: '238 245 252', 100: '211 229 249', 200: '185 213 244', 300: '128 181 238', 400: '71 151 231', 500: '17 121 207', 600: '13 104 180', 700: '0 85 153', 800: '0 66 120', 900: '0 42 80' },
    dark: { 50: '9 26 44', 100: '9 35 61', 200: '4 54 98', 300: '2 82 147', 400: '18 121 208', 500: '22 136 231', 600: '49 144 234', 700: '98 169 243', 800: '144 193 246', 900: '193 220 250' },
    fixed: { tint: '134 192 254', soft: '80 156 233', bright: '21 129 221', glow: '9 114 197', hi: '22 136 231', solid: '17 121 207', lo: '8 90 158', deep: '0 66 120' },
};

test('the preview draws the same shades the server saves', () => {
    assert.deepEqual(brandPalette('#1E88E5'), PHP_BLUE);
    assert.equal(brandPalette('#A51D26').light[500], '165 29 38');
    assert.equal(brandPalette('#FFD600').light[500], '139 116 5');
});

test('a colour white text cannot be read on is previewed darkened until it can', () => {
    assert.ok(contrastWithWhite('#FFD600') < MIN_CONTRAST);
    const [r, g, b] = brandPalette('#FFD600').light[500].split(' ').map(Number);
    assert.ok(contrastWithWhite(`#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`) >= MIN_CONTRAST);
});

test('the preview stylesheet keeps errors red in both themes', () => {
    const css = brandStylesheet('#0F766E');
    assert.match(css, /^:root\{--brand-50:/);
    assert.match(css, /--ui-danger:rgb\(var\(--danger-600\)\)/);
    assert.match(css, /\.dark\{--brand-50:[^}]*--ui-danger:rgb\(var\(--danger-400\)\)/);
});

test('a logo\'s colours come most used first, without white, black, grey or see-through pixels', () => {
    const pixel = (r, g, b, a = 255) => [r, g, b, a];
    const pixels = Uint8ClampedArray.from([
        ...Array(6).fill(pixel(15, 118, 110)).flat(),
        ...Array(3).fill(pixel(234, 179, 8)).flat(),
        ...Array(2).fill(pixel(17, 120, 112)).flat(),
        ...Array(9).fill(pixel(255, 255, 255)).flat(),
        ...Array(9).fill(pixel(10, 10, 10)).flat(),
        ...Array(9).fill(pixel(128, 128, 128)).flat(),
        ...Array(9).fill(pixel(200, 30, 30, 0)).flat(),
    ]);

    assert.deepEqual(dominantColors(pixels), ['#0F766E', '#EAB308']);
});

test('a near-grey main colour gets the same lighter dark-theme buttons as Brand::stylesheet', () => {
    // BrandPalette::darkButtons('#2B3138') in PHP.
    assert.deepEqual(darkButtons('#2B3138'), { 500: '85 92 99', hi: '93 100 108', solid: '85 92 99', lo: '69 75 83' });
    assert.deepEqual(darkButtons('#A51D26'), {});
    assert.match(brandStylesheet('#2B3138'), /\.dark\{[^}]*--brand-solid:85 92 99;/);
    assert.doesNotMatch(brandStylesheet('#A51D26'), /\.dark\{[^}]*--brand-solid:/);
});
