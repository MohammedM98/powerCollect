import { brandStylesheet, isHex } from '@/lib/brandPalette';

/**
 * The identity being tried on the appearance screen before it is saved:
 * names, logos, colours and design choices over the saved ones. While set,
 * useBrand() returns it and the whole interface is drawn with it; cleared
 * (saved, or the screen left), the saved identity shows again.
 */
let preview = null;
const listeners = new Set();

export function setBrandPreview(next) {
    preview = next;
    listeners.forEach((listener) => listener());
}

export function getBrandPreview() {
    return preview;
}

export function subscribeBrandPreview(listener) {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

/** The identity shared by the server with the one being tried over it. */
export function withPreview(brand, tried) {
    if (!tried) {
        return brand;
    }

    return { ...brand, ...tried, logos: { ...brand.logos, ...tried.logos }, design: { ...brand.design, ...tried.design } };
}

/** `bodyFont` → `uiBodyFont`, the dataset name of `data-ui-body-font`. */
function datasetName(key) {
    return `ui${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

/**
 * Draw the document in the identity: the `data-ui-*` design attributes on
 * <html>, the brand colour's shades (the <style id="brand-colors"> the
 * server renders, see app.blade.php) and the browser's icon. Pages are
 * visited without reloading the document, so this keeps it in step after
 * a save and while trying an identity. `themePrimary` is theme.css's own
 * colour, which needs no shades of its own.
 */
export function applyBrandToDocument(brand, { themePrimary, previewing = false } = {}) {
    const root = document.documentElement;

    Object.entries(brand.design ?? {}).forEach(([key, value]) => {
        if (key !== 'preset') {
            root.dataset[datasetName(key)] = value;
        }
    });

    let saved = null;

    try {
        saved = localStorage.getItem('table-density');
    } catch {
        // Storage may be blocked; the company's density applies.
    }

    // The density being tried shows over the one chosen in this browser; otherwise the browser's choice wins.
    root.dataset.tableDensity = (previewing ? brand.design?.density : saved ?? brand.design?.density) === 'compact' ? 'compact' : 'comfortable';

    let style = document.getElementById('brand-colors');
    const css = isHex(brand.primaryColor) && brand.primaryColor.toUpperCase() !== themePrimary?.toUpperCase() ? brandStylesheet(brand.primaryColor) : '';

    if (!style && css) {
        style = Object.assign(document.createElement('style'), { id: 'brand-colors' });
        document.head.appendChild(style);
    }

    if (style && style.textContent !== css) {
        style.textContent = css;
    }

    const icon = document.querySelector('link[rel="icon"]');

    if (icon && brand.logos?.icon && icon.getAttribute('href') !== brand.logos.icon) {
        icon.setAttribute('href', brand.logos.icon);
    }
}
