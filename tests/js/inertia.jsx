/**
 * A stand-in for @inertiajs/react in component tests. useForm keeps its data
 * in React state like the real one, and every visit it would send is
 * recorded in `submissions` (method, url, the data after transform(), and
 * the visit options) instead of going to a server.
 */
import { act, useRef, useState } from 'react';

export const submissions = [];
let page = { props: {}, url: '/' };
const responses = [];
let rejection = null;
let success = null;

export function resetInertia() {
    submissions.length = 0;
    responses.length = 0;
    rejection = null;
    success = null;
    page = { props: {}, url: '/' };
}

/**
 * Refuse the next visit (a useForm or router one) with these validation
 * `errors`, as the server would: it is still recorded, the errors reach the
 * page props (and the form), and its onStart, onError and onFinish run.
 */
export function rejectNext(errors) {
    rejection = errors;
}

/**
 * Accept the next visit as the server would and run its onSuccess with a page
 * carrying `flash`, then its onFinish. Other accepted visits run no callbacks.
 */
export function succeedNext(flash = {}) {
    success = { flash };
}

/**
 * Answer a recorded visit. An accepted one clears the page's errors, as a
 * real response replaces them. A queued refusal is spent, and its callbacks
 * run after the caller's own code, as a real response arrives later.
 */
function settle(options, setErrors = null) {
    if (!rejection) {
        page = { ...page, props: { ...page.props, errors: {} } };
        if (success) {
            const answered = { ...page, flash: success.flash };
            success = null;
            queueMicrotask(() => act(() => {
                options.onSuccess?.(answered);
                options.onFinish?.();
            }));
        }
        return;
    }
    const errors = rejection;
    rejection = null;
    queueMicrotask(() => act(() => {
        page = { ...page, props: { ...page.props, errors } };
        options.onStart?.();
        setErrors?.(errors);
        options.onError?.(errors);
        options.onFinish?.();
    }));
}

/** Answer useHttp requests whose URL starts with `prefix` with `body`. */
export function respondTo(prefix, body) {
    responses.push({ prefix, body });
}

/** Fail the next useHttp request whose URL starts with `prefix`, as the server would with `status` and `data`. */
export function failNext(prefix, status = 500, data = {}) {
    responses.unshift({ prefix, once: true, error: Object.assign(new Error('Request failed'), { name: 'HttpResponseError', response: { status, data: JSON.stringify(data) } }) });
}

/** Set the shared page props the next render reads through usePage(). */
export function setPage(next) {
    page = { props: {}, url: '/', ...next };
}

export function usePage() {
    return page;
}

export function useForm(initial = {}) {
    const defaults = useRef(initial);
    const [data, setDataState] = useState(initial);
    const [errors, setErrors] = useState({});
    const transformer = useRef((value) => value);
    const latest = useRef(data);
    latest.current = data;

    function setData(key, value) {
        if (typeof key === 'function') setDataState(key);
        else if (typeof key === 'object' && key !== null) setDataState(key);
        else setDataState((current) => ({ ...current, [key]: value }));
    }

    const visit = (method) => (url, options = {}) => {
        submissions.push({ method, url, data: transformer.current(latest.current), options });
        settle(options, setErrors);
    };

    return {
        data,
        setData,
        errors,
        hasErrors: Object.keys(errors).length > 0,
        setError: (key, value) => setErrors((current) => (typeof key === 'object' ? { ...current, ...key } : { ...current, [key]: value })),
        clearErrors: (...keys) => setErrors((current) => (keys.length ? Object.fromEntries(Object.entries(current).filter(([key]) => !keys.includes(key))) : {})),
        processing: false,
        progress: null,
        wasSuccessful: false,
        recentlySuccessful: false,
        isDirty: JSON.stringify(data) !== JSON.stringify(defaults.current),
        setDefaults: (key, value) => { defaults.current = key === undefined ? latest.current : typeof key === 'object' ? key : { ...defaults.current, [key]: value }; },
        defaults: (key, value) => { defaults.current = key === undefined ? latest.current : typeof key === 'object' ? key : { ...defaults.current, [key]: value }; },
        reset: (...keys) => setDataState((current) => (keys.length ? { ...current, ...Object.fromEntries(keys.map((key) => [key, defaults.current[key]])) } : defaults.current)),
        resetAndClearErrors: () => { setDataState(defaults.current); setErrors({}); },
        transform: (callback) => { transformer.current = callback; },
        get: visit('get'),
        post: visit('post'),
        put: visit('put'),
        patch: visit('patch'),
        delete: visit('delete'),
        submit: (method, url, options) => visit(method)(url, options),
        cancel: () => {},
    };
}

export function useHttp(initial = {}) {
    const form = useForm(initial);
    const transformer = useRef(null);
    const request = (method) => async (url, options = {}) => {
        submissions.push({ method, url, data: transformer.current ? transformer.current(form.data) : form.data, options, http: true });
        const index = responses.findIndex((response) => url.startsWith(response.prefix));
        const response = responses[index];
        if (response?.once) responses.splice(index, 1);
        if (response?.error) throw response.error;
        return response?.body ?? {};
    };

    return {
        ...form,
        transform: (callback) => {
            transformer.current = callback;
        },
        cancel: () => {},
        get: request('get'),
        post: request('post'),
        put: request('put'),
        patch: request('patch'),
        delete: request('delete'),
    };
}

function routerVisit(method, url, data, options = {}) {
    submissions.push({ method, url, data, options });
    settle(options);
}

export const router = {
    visit: (url, options = {}) => routerVisit(options.method ?? 'get', url, options.data, options),
    get: (url, data, options = {}) => routerVisit('get', url, data, options),
    post: (url, data, options = {}) => routerVisit('post', url, data, options),
    put: (url, data, options = {}) => routerVisit('put', url, data, options),
    patch: (url, data, options = {}) => routerVisit('patch', url, data, options),
    delete: (url, options = {}) => routerVisit('delete', url, options.data, options),
    reload: () => {},
    on: () => () => {},
    flushAll: () => {},
    cancelAll: () => {},
};

export function Link({ href, children, ...props }) {
    return <a href={typeof href === 'object' ? href.url : href} {...props}>{children}</a>;
}

export function Head() {
    return null;
}
