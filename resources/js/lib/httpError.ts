/** What a useHttp request rejects with: a network failure, or the server's answer. */
export interface HttpFailure {
    name?: string;
    response?: { status?: number; data?: unknown };
}

interface ErrorBody {
    message?: string;
    errors?: Record<string, string[]>;
}

/**
 * What to tell the person when a JSON request made with useHttp failed: the
 * connection message when it never reached the server, else the server's
 * first validation message or its own message, else `fallback`.
 */
export function httpErrorMessage(error: HttpFailure | null | undefined, fallback = 'تعذّر تحميل البيانات.'): string {
    if (error?.name === 'HttpNetworkError') {
        return 'تعذّر الاتصال بالخادم. تحقق من الاتصال ثم أعد المحاولة.';
    }

    const body = error?.response?.data;
    let parsed: ErrorBody = (body as ErrorBody | undefined) ?? {};

    if (typeof body === 'string') {
        try {
            parsed = JSON.parse(body) as ErrorBody;
        } catch {
            parsed = {};
        }
    }

    return Object.values(parsed.errors ?? {}).flat()[0] || parsed.message || fallback;
}
