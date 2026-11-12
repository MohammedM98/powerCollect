import { useEffect, useSyncExternalStore } from 'react';
import { usePage } from '@inertiajs/react';
import { applyBrandToDocument, getBrandPreview, subscribeBrandPreview, withPreview } from '@/lib/brandPreview';
import { applyLook } from '@/lib/personalLook';
import { usePersonalLook } from '@/hooks/usePersonalLook';
import defaults from '../../brand/default.json' with { type: 'json' };

/** The identity the application ships with, in the shape the server shares it (app/Support/Brand.php forPage). */
const DEFAULT_BRAND = {
    name: defaults.company.name,
    nameEnglish: defaults.company.nameEnglish,
    shortName: defaults.company.shortName,
    tagline: defaults.company.tagline,
    logos: { main: defaults.logos.main, light: defaults.logos.main, icon: defaults.logos.icon, print: defaults.logos.main },
    animatedLogo: true,
    printColor: defaults.colors.print,
    primaryColor: defaults.colors.primary,
    design: defaults.design,
};

/** theme.css's own colour (the default identity's), which needs no shades of its own. */
export const THEME_PRIMARY = defaults.colors.primary;

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
 * `icon`, `print`, each falling back to the main one), `animatedLogo`,
 * `printColor` (the lines on a printout), `primaryColor` and `design` (the
 * layout and components, see BrandDesign). While the appearance screen
 * tries an identity on, that one (lib/brandPreview.js). Drawn outside an
 * Inertia page (a sheet rendered on its own), the default identity.
 */
export function useBrand() {
    const tried = useSyncExternalStore(subscribeBrandPreview, getBrandPreview, () => null);

    return withPreview(useSharedBrand(), tried);
}

/**
 * Keeps the document (design attributes, colours, icon) drawn in the
 * current identity, with this person's own look over it (their
 * glass, colour and motion, lib/personalLook.js); for the page layouts.
 */
export function useBrandDocument() {
    const brand = useBrand();
    const previewing = useSyncExternalStore(subscribeBrandPreview, getBrandPreview, () => null) !== null;
    const { look } = usePersonalLook();

    useEffect(() => {
        applyBrandToDocument(brand, { themePrimary: THEME_PRIMARY, previewing });
        // While the appearance screen tries a company identity, it shows as it is, without this person's look.
        applyLook(previewing ? null : look);
    }, [brand, previewing, look]);

    return brand;
}
