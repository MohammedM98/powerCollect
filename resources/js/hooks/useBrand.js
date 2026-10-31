import { usePage } from '@inertiajs/react';
import defaults from '../../brand/default.json';

/** The identity the application ships with, in the shape the server shares it (app/Support/Brand.php forPage). */
const DEFAULT_BRAND = {
    name: defaults.company.name,
    nameEnglish: defaults.company.nameEnglish,
    shortName: defaults.company.shortName,
    tagline: defaults.company.tagline,
    logos: { main: defaults.logos.main, light: defaults.logos.main, icon: defaults.logos.icon, print: defaults.logos.main },
    animatedLogo: true,
    printColor: defaults.colors.print,
};

/**
 * The company this copy of the application is for (app/Support/Brand.php):
 * `name`, `nameEnglish`, `shortName`, `tagline`, `logos` (`main`, `light`,
 * `icon`, `print`, each falling back to the main one), `animatedLogo` and
 * `printColor`, the colour of the lines on a printout. Drawn outside an
 * Inertia page (a sheet rendered on its own), the default identity.
 */
export function useBrand() {
    try {
        return usePage().props.brand ?? DEFAULT_BRAND;
    } catch {
        return DEFAULT_BRAND;
    }
}
