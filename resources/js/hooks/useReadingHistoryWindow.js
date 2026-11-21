import { useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { urlWithout } from '@/lib/pageUrl';

/**
 * A subscription's whole reading history on the subscriptions list, whose
 * rows carry only their latest reading: the `readingHistory` prop
 * (SubscriptionPage::requestedReadingHistory), asked for when the reading
 * window opens or the details' consumption tab is shown. The subscription is
 * kept in the address (?readings=…), so the history comes back fresh with the
 * page after a reading is saved.
 *
 * Returns `windowId` (the reading window's subscription, or null when it is
 * closed), `readingsFor(id)` (that subscription's history, or null until it
 * has loaded), `load(id)`, `open(id)`, `close()` (the window) and `release()`
 * (forget a history loaded for the details while the window is closed).
 */
export function useReadingHistoryWindow(readingHistory) {
    const [windowId, setWindowId] = useState(() => readingHistory?.subscriptionId ?? null);
    const openWindow = useRef(windowId);
    const loading = useRef(null);
    const request = useRef(null);
    const { url } = usePage();
    const loadedId = readingHistory?.subscriptionId ?? null;

    function load(subscriptionId) {
        if (subscriptionId === loadedId || subscriptionId === loading.current) {
            return;
        }
        request.current?.cancel();
        loading.current = subscriptionId;
        router.reload({
            data: { readings: subscriptionId },
            only: ['readingHistory'],
            onCancelToken: (token) => (request.current = token),
            onFinish: () => {
                request.current = null;
                loading.current = null;
            },
        });
    }

    function open(subscriptionId) {
        openWindow.current = subscriptionId;
        setWindowId(subscriptionId);
        load(subscriptionId);
    }

    function forget() {
        request.current?.cancel();
        loading.current = null;
        router.replace({
            url: urlWithout(url, 'readings'),
            props: (props) => ({ ...props, readingHistory: null }),
            preserveScroll: true,
            preserveState: true,
        });
    }

    function close() {
        openWindow.current = null;
        setWindowId(null);
        forget();
    }

    function release() {
        if (openWindow.current === null && (loadedId !== null || loading.current !== null)) {
            forget();
        }
    }

    return {
        windowId,
        readingsFor: (subscriptionId) => (subscriptionId !== null && subscriptionId === loadedId ? readingHistory.meterReadings : null),
        load,
        open,
        close,
        release,
    };
}
