import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * The MA colour tokens' text contrast, worked out from resources/css/app.css
 * in the four looks (light and dark, solid and glass). Glass panels let the
 * ground through: a panel is its solid colour at 66% over the ground, a tile
 * 55% solid over it (the soft lights on the ground are left out).
 */
const css = readFileSync(new URL('../../resources/css/app.css', import.meta.url), 'utf8');
const design = css.slice(css.indexOf('The MA design, final'));

/**
 * Each `--ma-*` hex token of a theme as the cascade leaves it: `:root` and
 * `.dark` weigh the same, so in the dark theme a later `:root` block
 * overrides an earlier `.dark` one, and only document order decides.
 *
 * @returns {Record<string, string>}
 */
function tokens(selectors) {
    const values = {};
    for (const [, selector, body] of design.matchAll(/(?:^|\n)(:root|\.dark)\s*\{([^}]*)\}/g)) {
        if (!selectors.includes(selector)) {
            continue;
        }
        for (const [, name, value] of body.matchAll(/--(ma-[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
            values[name] = value.toLowerCase();
        }
    }

    return values;
}

const rgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
const over = (top, alpha, bottom) => rgb(top).map((channel, index) => channel * alpha + rgb(bottom)[index] * (1 - alpha));
const hex = (channels) => `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
const luminance = (color) => {
    const [r, g, b] = rgb(color).map((channel) => {
        const value = channel / 255;

        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (text, ground) => {
    const [light, dark] = [luminance(text), luminance(ground)].sort((a, b) => b - a);

    return (light + 0.05) / (dark + 0.05);
};

const light = tokens([':root']);
const dark = tokens([':root', '.dark']);
const TONES = ['pay', 'owe', 'disc', 'clr', 'split', 'warn'];

/** @returns {Array<{ look: string, text: string, ground: string, ratio: number }>} every text-on-surface pair below 4.5:1 */
function shortfalls() {
    const found = [];
    for (const [theme, t] of [['light', light], ['dark', dark]]) {
        for (const surface of ['solid', 'glass']) {
            const glass = surface === 'glass';
            const grounds = {
                panel: glass ? hex(over(t['ma-solid'], 0.66, t['ma-bg'])) : t['ma-solid'],
                tile: glass ? hex(over(t['ma-solid'], 0.55, t['ma-bg'])) : t['ma-tile'],
            };
            const pairs = [
                ...['ma-ink', 'ma-muted', 'ma-faint'].flatMap((text) => Object.entries(grounds).map(([ground, color]) => [text, ground, t[text], color])),
                ...TONES.map((tone) => [`ma-${tone}`, `ma-${tone}-s`, t[`ma-${tone}`], t[`ma-${tone}-s`]]),
                ...TONES.map((tone) => [`ma-${tone}`, 'panel', t[`ma-${tone}`], grounds.panel]),
            ];
            for (const [text, ground, textColor, groundColor] of pairs) {
                const ratio = contrast(textColor, groundColor);
                if (ratio < 4.5) {
                    found.push({ look: `${theme} ${surface}`, text, ground, ratio: Math.round(ratio * 100) / 100 });
                }
            }
        }
    }

    return found;
}

test('the MA tokens are all found in both themes', () => {
    for (const name of ['ma-bg', 'ma-solid', 'ma-tile', 'ma-ink', 'ma-muted', 'ma-faint', ...TONES.flatMap((tone) => [`ma-${tone}`, `ma-${tone}-s`])]) {
        assert.match(light[name] ?? '', /^#[0-9a-f]{6}$/, `light ${name}`);
        assert.match(dark[name] ?? '', /^#[0-9a-f]{6}$/, `dark ${name}`);
    }
});

test('every text colour reads at 4.5:1 on its surface in light, dark, solid and glass', () => {
    assert.deepEqual(shortfalls(), []);
});

test('white text on the pay button reads at 4.5:1', () => {
    assert.ok(contrast('#ffffff', '#2d855c') >= 4.5);
});
