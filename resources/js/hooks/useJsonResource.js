import { useHttp } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { httpErrorMessage } from '@/lib/httpError';

/**
 * Loads `url` as JSON with useHttp when it changes (nothing while it is
 * null), and says whether it is loading, what came back, and why it failed;
 * `retry` asks again. A request whose URL has since changed is ignored.
 */
export function useJsonResource(url, failureMessage) {
    const http = useHttp();
    const httpRef = useRef(http);
    httpRef.current = http;
    const [state, setState] = useState({ url: null, data: null, error: null });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (url === null) {
            return undefined;
        }

        let current = true;
        setState((previous) => ({ url, data: previous.url === url ? previous.data : null, error: null }));
        httpRef.current
            .get(url)
            .then((data) => current && setState({ url, data, error: null }))
            .catch((error) => current && setState({ url, data: null, error: httpErrorMessage(error, failureMessage) }));

        return () => {
            current = false;
        };
    }, [url, attempt, failureMessage]);

    const retry = useCallback(() => setAttempt((count) => count + 1), []);
    const settled = state.url === url && (state.data !== null || state.error !== null);

    return { data: state.url === url ? state.data : null, error: state.url === url ? state.error : null, loading: url !== null && !settled, retry };
}
