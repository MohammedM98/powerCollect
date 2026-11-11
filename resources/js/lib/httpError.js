/**
 * What to tell the person when a JSON request made with useHttp failed: the
 * connection message when it never reached the server, else the server's
 * first validation message or its own message, else `fallback`.
 */
export function httpErrorMessage(error, fallback = 'تعذّر تحميل البيانات.') {
    if (error?.name === 'HttpNetworkError') {
        return 'تعذّر الاتصال بالخادم. تحقق من الاتصال ثم أعد المحاولة.';
    }

    const body = error?.response?.data;
    let parsed = body ?? {};

    if (typeof body === 'string') {
        try {
            parsed = JSON.parse(body);
        } catch {
            parsed = {};
        }
    }

    return Object.values(parsed.errors ?? {}).flat()[0] || parsed.message || fallback;
}
