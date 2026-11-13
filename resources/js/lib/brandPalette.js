/**
 * The brand's shades from one colour, for previewing a colour on the
 * appearance screen before it is saved. The same steps as
 * app/Support/BrandPalette.php, which draws the saved colour on every page;
 * tests/Unit/brandPalette.test.js keeps the two in step.
 */

export const MIN_CONTRAST = 4.5;

const LIGHTEST = 0.966;

const LIGHT = {
    50: { lift: 1.0, chroma: 0.07 },
    100: { lift: 0.87, chroma: 0.2 },
    200: { lift: 0.74, chroma: 0.32 },
    300: { lift: 0.48, chroma: 0.6 },
    400: { lift: 0.24, chroma: 0.86 },
    500: { scale: 1.0, chroma: 1.0 },
    600: { scale: 0.9, chroma: 0.9 },
    700: { scale: 0.785, chroma: 0.78 },
    800: { scale: 0.66, chroma: 0.65 },
    900: { scale: 0.495, chroma: 0.55 },
};

const DARK = {
    50: { lightness: 0.214, chroma: 0.25 },
    100: { lightness: 0.252, chroma: 0.35 },
    200: { lightness: 0.33, chroma: 0.55 },
    300: { lightness: 0.435, chroma: 0.79 },
    400: { lightness: 0.57, chroma: 0.95 },
    500: { scale: 1.087, chroma: 1.08 },
    600: { lightness: 0.642, chroma: 0.96 },
    700: { lightness: 0.721, chroma: 0.78 },
    800: { lightness: 0.797, chroma: 0.55 },
    900: { lightness: 0.885, chroma: 0.3 },
};

const FIXED = {
    tint: { lightness: 0.792, chroma: 0.71 },
    soft: { lightness: 0.678, chroma: 0.82 },
    bright: { lightness: 0.597, chroma: 1.1 },
    glow: { lightness: 0.544, chroma: 1.08 },
    hi: { scale: 1.087, chroma: 1.08 },
    solid: { scale: 1.0, chroma: 1.0 },
    lo: { scale: 0.815, chroma: 0.82 },
    deep: { scale: 0.66, chroma: 0.65 },
};

/** Whether the value is a six-digit hex colour, e.g. `#A51D26`. */
export function isHex(value) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function hexToRgb(hex) {
    return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

/** `[r, g, b]` (0–255) as `#RRGGBB`. */
export function rgbToHex(rgb) {
    return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function toLinear(channel) {
    const value = channel / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value) {
    return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
}

function luminance(rgb) {
    const [red, green, blue] = rgb.map(toLinear);

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** How well white text reads on the colour, from 1 (not at all) to 21. */
export function contrastWithWhite(hex) {
    return 1.05 / (luminance(hexToRgb(hex)) + 0.05);
}

function hexToOklch(hex) {
    const [red, green, blue] = hexToRgb(hex).map(toLinear);
    const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
    const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
    const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
    const lightness = 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short;
    const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short;
    const b = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short;

    return [lightness, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
}

function oklchToLinear(lightness, chroma, hue) {
    const a = chroma * Math.cos((hue * Math.PI) / 180);
    const b = chroma * Math.sin((hue * Math.PI) / 180);
    const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

    return [
        4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
        -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
        -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
    ];
}

function oklchToRgb(lightness, chroma, hue) {
    const clamped = Math.max(0, Math.min(1, lightness));
    let linear = oklchToLinear(clamped, chroma, hue);

    for (let attempt = 0; attempt < 60; attempt++) {
        if (Math.min(...linear) >= -0.0005 && Math.max(...linear) <= 1.0005) {
            break;
        }

        chroma *= 0.95;
        linear = oklchToLinear(clamped, chroma, hue);
    }

    return linear.map((channel) => Math.round(255 * fromLinear(Math.max(0, Math.min(1, channel)))));
}

function readableMain([lightness, chroma, hue]) {
    while (lightness > 0.05 && 1.05 / (luminance(oklchToRgb(lightness, chroma, hue)) + 0.05) < MIN_CONTRAST) {
        lightness -= 0.01;
    }

    return [lightness, chroma, hue];
}

/** Every brand shade for the colour as `R G B` triples: `{ light, dark, fixed }`. */
export function brandPalette(hex) {
    const [lightness, chroma, hue] = readableMain(hexToOklch(hex));
    const shade = (step) => oklchToRgb(
        step.lightness ?? (step.lift !== undefined ? lightness + step.lift * (LIGHTEST - lightness) : lightness * step.scale),
        chroma * step.chroma,
        hue,
    ).join(' ');
    const map = (steps) => Object.fromEntries(Object.entries(steps).map(([key, step]) => [key, shade(step)]));

    return { light: map(LIGHT), dark: map(DARK), fixed: map(FIXED) };
}

/** A main colour with less hue than this (charcoal, slate) sinks into the dark theme's charcoal page (BrandPalette::NEUTRAL_CHROMA). */
export const NEUTRAL_CHROMA = 0.03;

/** Its dark-theme buttons instead: a lighter graphite that still carries white text (BrandPalette::DARK_NEUTRAL_BUTTONS). */
const DARK_NEUTRAL_BUTTONS = { 500: 0.47, hi: 0.5, solid: 0.47, lo: 0.41 };

/** The dark theme's button shades for a near-grey main colour, as BrandPalette::darkButtons(); empty for a real colour. */
export function darkButtons(hex) {
    const [, chroma, hue] = readableMain(hexToOklch(hex));

    if (chroma >= NEUTRAL_CHROMA) {
        return {};
    }

    return Object.fromEntries(Object.entries(DARK_NEUTRAL_BUTTONS).map(([key, lightness]) => [key, oklchToRgb(lightness, chroma, hue).join(' ')]));
}

/** The stylesheet that draws the interface in the colour, as Brand::stylesheet() does. */
export function brandStylesheet(hex) {
    const palette = brandPalette(hex);
    const declare = (shades) => Object.entries(shades).map(([step, rgb]) => `--brand-${step}:${rgb};`).join('');

    // Another company's colour carries white text, and the open page's pill is that colour in both themes (as Brand::stylesheet).
    const onColour = '--brand-ink:255 255 255;--nav-active:var(--brand-solid);--nav-active-ink:255 255 255;--nav-active-icon:255 255 255;';

    return `:root{${declare(palette.light)}${declare(palette.fixed)}${onColour}--ui-danger:rgb(var(--danger-600));--ui-danger-t:rgb(var(--danger-600) / 0.08);}`
        + `.dark{${declare(palette.dark)}${declare(darkButtons(hex))}${onColour}--ui-danger:rgb(var(--danger-400));--ui-danger-t:rgb(var(--danger-400) / 0.12);}`;
}

/** Semantic company colours, matching Brand::stylesheet in both themes. */
export function brandRoleStylesheet(colors = {}) {
    let root = '';
    let dark = '';
    const declare = (shades, prefix) => Object.entries(shades).map(([step, rgb]) => `--${prefix}-${step}:${rgb};`).join('');
    for (const role of ['secondary', 'accent']) {
        if (!isHex(colors[role])) continue;
        const palette = brandPalette(colors[role]);
        const prefix = `brand-${role}`;
        root += declare(palette.light, prefix) + declare(palette.fixed, prefix)
            + `--${prefix}-hover:${palette.fixed.lo};--${prefix}-on-solid:255 255 255;--${prefix}-on-soft:${palette.light[900]};`
            + `--ui-${role}:rgb(var(--${prefix}-600));--ui-${role}-t:rgb(var(--${prefix}-500) / 0.08);`;
        dark += declare(palette.dark, prefix) + `--${prefix}-on-soft:${palette.dark[900]};`
            + `--ui-${role}:rgb(var(--${prefix}-700));--ui-${role}-t:rgb(var(--${prefix}-500) / 0.12);`;
    }
    for (const [role, variable, token, lightness] of [['background', 'gray-50', 'ui-page', 0.158], ['surface', 'surface', 'ui-surface', 0.204]]) {
        if (!isHex(colors[role])) continue;
        const rgb = hexToRgb(colors[role]);
        const [, chroma, hue] = hexToOklch(colors[role]);
        const night = oklchToRgb(lightness, Math.min(chroma, 0.025), hue);
        root += `--${variable}:${rgb.join(' ')};--${token}:rgb(var(--${variable}));`;
        dark += `--${variable}:${night.join(' ')};--${token}:rgb(var(--${variable}));`;
    }
    return (root ? `:root{${root}}` : '') + (dark ? `.dark{${dark}}` : '');
}

/**
 * The colours a logo is drawn in, most used first: `pixels` is the image's
 * RGBA data (canvas getImageData). Transparent, near-white, near-black and
 * grey pixels are skipped, and close colours count as one.
 */
export function dominantColors(pixels, limit = 5) {
    const buckets = new Map();

    for (let index = 0; index < pixels.length; index += 4) {
        const [red, green, blue, alpha] = [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);

        if (alpha < 200 || max < 28 || min > 235 || max - min < 28) {
            continue;
        }

        const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4);
        const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
        bucket.count += 1;
        bucket.red += red;
        bucket.green += green;
        bucket.blue += blue;
        buckets.set(key, bucket);
    }

    const colors = [];

    for (const bucket of [...buckets.values()].sort((a, b) => b.count - a.count)) {
        const rgb = [bucket.red, bucket.green, bucket.blue].map((sum) => Math.round(sum / bucket.count));

        if (colors.every((chosen) => Math.hypot(...chosen.map((channel, i) => channel - rgb[i])) > 48)) {
            colors.push(rgb);
        }

        if (colors.length === limit) {
            break;
        }
    }

    return colors.map(rgbToHex);
}
