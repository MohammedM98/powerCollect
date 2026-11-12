import { brandStylesheet, isHex } from './brandPalette.js';

/**
 * Each person's own look over the company's (the component gallery's look
 * studio): how see-through the glass is and how much it blurs, the main colour and whether things move. Kept in
 * this browser only; a choice left empty (null) keeps the company's.
 */

/** Where this browser keeps the look, and the event that keeps every page part in step with it. */
export const LOOK_STORAGE_KEY = 'personal-look';
export const LOOK_EVENT = 'personal-look-change';

/** The main colours offered, each as the company colour it replaces. */
export const LOOK_COLORS = [
    { key: 'charcoal', label: 'فحمي سوبر باور', hex: '#2B3138' },
    { key: 'burgundy', label: 'عنابي', hex: '#B0202C' },
    { key: 'emerald', label: 'أخضر', hex: '#047857' },
    { key: 'amber', label: 'كهرماني', hex: '#A16207' },
    { key: 'violet', label: 'بنفسجي', hex: '#7C3AED' },
];

/** The glass sliders' ranges, as the company's own tokens allow (BrandDesign TOKENS glassAlpha, glassBlur). */
export const GLASS_RANGE = { min: 0.2, max: 0.9, step: 0.05 };
export const BLUR_RANGE = { min: 0, max: 40, step: 2 };

/** The company's look everywhere. */
export const EMPTY_LOOK = { glass: null, blur: null, color: null, motion: null };

function clamp(value, { min, max, step }) {
    const number = Number(value);

    if (value === null || value === '' || !Number.isFinite(number)) {
        return null;
    }

    const stepped = Math.round((Math.min(max, Math.max(min, number)) - min) / step) * step + min;

    return Math.round(stepped * 100) / 100;
}

/**
 * A stored look made safe to apply: a colour that
 * is not `#RRGGBB` or a figure that is not a number becomes the company's
 * (null), and the glass and blur are kept inside their ranges.
 *
 * @param {unknown} raw
 * @returns {{ glass: number|null, blur: number|null, color: string|null, motion: 'off'|null }}
 */
export function normalizeLook(raw) {
    const look = raw && typeof raw === 'object' ? raw : {};

    return {
        glass: clamp(look.glass, GLASS_RANGE),
        blur: clamp(look.blur, BLUR_RANGE),
        color: isHex(look.color) ? look.color.toUpperCase() : null,
        motion: look.motion === 'off' ? 'off' : null,
    };
}

/** Whether the look changes anything from the company's. */
export function isCustomLook(look) {
    return Object.values(normalizeLook(look)).some((value) => value !== null);
}

/** The look kept in this browser, or the company's when none is (or storage is blocked). */
export function readLook() {
    try {
        return normalizeLook(JSON.parse(localStorage.getItem(LOOK_STORAGE_KEY) ?? 'null'));
    } catch {
        return EMPTY_LOOK;
    }
}

/** Keeps the look in this browser and tells every part of the page. */
export function saveLook(look) {
    const next = normalizeLook(look);

    try {
        if (isCustomLook(next)) {
            localStorage.setItem(LOOK_STORAGE_KEY, JSON.stringify(next));
        } else {
            localStorage.removeItem(LOOK_STORAGE_KEY);
        }
    } catch {
        // Storage may be blocked (private mode); the look still applies on this page.
    }

    window.dispatchEvent(new CustomEvent(LOOK_EVENT, { detail: next }));

    return next;
}

/** The stylesheet that draws the interface in the look's colour (its shades in both themes), or nothing for the company's. */
export function lookStylesheet(look) {
    const { color } = normalizeLook(look);

    return color ? brandStylesheet(color) : '';
}

/**
 * Draws the document in the look, over the company's identity just
 * applied (lib/brandPreview.js applyBrandToDocument): the glass tokens, the colour's shades in a stylesheet after
 * the company's, and no motion when it is switched off.
 */
export function applyLook(look, doc = document) {
    const root = doc.documentElement;
    const { glass, blur, motion } = normalizeLook(look);

    if (motion === 'off') {
        root.dataset.uiMotionStyle = 'none';
    }

    if (glass === null) {
        root.style.removeProperty('--glass-alpha');
    } else {
        root.style.setProperty('--glass-alpha', String(glass));
    }

    if (blur === null) {
        root.style.removeProperty('--glass-blur');
    } else {
        root.style.setProperty('--glass-blur', `${blur}px`);
    }

    const css = lookStylesheet(look);
    let style = doc.getElementById('personal-look');

    if (!css) {
        style?.remove();

        return;
    }

    if (!style) {
        style = Object.assign(doc.createElement('style'), { id: 'personal-look' });
    }

    style.textContent = css;
    // Last in <head>, so its shades win over the company's.
    doc.head.appendChild(style);
}
