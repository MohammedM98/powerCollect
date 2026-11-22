import { useEffect, useSyncExternalStore } from 'react';
import { usePage } from '@inertiajs/react';
import { applyBrandToDocument, getBrandPreview, subscribeBrandPreview, withPreview } from '@/lib/brandPreview';
import defaults from '../../brand/default.json' with { type: 'json' };

/** The identity the application ships with, in the shape the server shares it (app/Support/Brand.php forPage). */
const DEFAULT_BRAND = {
    name: defaults.company.name,
    nameEnglish: defaults.company.nameEnglish,
    shortName: defaults.company.shortName,
    tagline: defaults.company.tagline,
    logos: { main: defaults.logos.main, light: defaults.logos.light ?? defaults.logos.main, icon: defaults.logos.icon, print: defaults.logos.main },
    printColor: defaults.colors.print,
    primaryColor: defaults.colors.primary,
    design: defaults.design,
};

/** theme.css's own colour, which needs no shades of its own (Brand::THEME_PRIMARY on the server). */
export const THEME_PRIMARY = '#20B2A0';

function useSharedBrand() {
    try {
        return usePage().props.brand ?? DEFAULT_BRAND;
    } catch {
        return DEFAULT_BRAND;
    }
}

/**
 * The company this copy of the application is for (app/Support/Brand.php):
 * `name`, `nameEnglish`, `shortName`, `tagline`, `logos` (`main`, `light`,
 * `icon`, `print`, each falling back to the main one),
 * `printColor` (the lines on a printout), `primaryColor` and `design` (the
 * layout and components, see BrandDesign). While the appearance screen
 * tries an identity on, that one (lib/brandPreview.js). Drawn outside an
 * Inertia page (a sheet rendered on its own), the default identity.
 */
export function useBrand() {
    const tried = useSyncExternalStore(subscribeBrandPreview, getBrandPreview, () => null);

    return withPreview(useSharedBrand(), tried);
}

/** Keeps the document (design attributes, colours, icon) drawn in the current identity; for the page layouts. */
export function useBrandDocument() {
    const brand = useBrand();
    const previewing = useSyncExternalStore(subscribeBrandPreview, getBrandPreview, () => null) !== null;

    useEffect(() => {
        applyBrandToDocument(brand, { themePrimary: THEME_PRIMARY, previewing });
    }, [brand, previewing]);

    return brand;
}
