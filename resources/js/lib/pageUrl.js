/**
 * The page's own address, as Inertia keeps it (`usePage().url`: the path and
 * query, no origin), read and changed without touching `window.location`, so
 * a partial reload or a replaced visit never leaves a stale address behind.
 */
const BASE = 'http://page.invalid';

function parse(url) {
    return new URL(url, BASE);
}

function relative(parsed) {
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** One value from the page's query, or null when it is not there. */
export function queryValue(url, key) {
    return parse(url).searchParams.get(key);
}

/** The page's query string, with its "?" (or empty when there is none). */
export function queryString(url) {
    return parse(url).search;
}

/** The page's address without the given query keys. */
export function urlWithout(url, ...keys) {
    const parsed = parse(url);

    for (const key of keys) {
        parsed.searchParams.delete(key);
    }

    return relative(parsed);
}

/** The page's address with `values` set in its query; a null or undefined value is left out. */
export function urlWith(url, values) {
    const parsed = parse(url);

    for (const [key, value] of Object.entries(values)) {
        if (value !== null && value !== undefined) {
            parsed.searchParams.set(key, String(value));
        }
    }

    return relative(parsed);
}
