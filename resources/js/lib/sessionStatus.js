/** After this long without a key or a click the timer stops checking, so an unattended page lets the session expire. */
const IDLE_LIMIT_MS = 15 * 60 * 1000;

export function watchSessionStatus(onUnauthorized, browser = window) {
    let stopped = false;
    let controller = null;
    const now = () => (browser.now ?? Date.now)();
    let lastActivity = now();
    const markActive = () => { lastActivity = now(); };

    // Every check renews the session, so the timer only keeps it alive while someone is using the page.
    function tick() {
        if (now() - lastActivity <= IDLE_LIMIT_MS) return check();
    }

    async function check() {
        if (stopped || controller || browser.document.visibilityState === 'hidden') return;
        controller = new AbortController();
        const timeout = browser.setTimeout(() => controller?.abort(), 10000);
        try {
            const response = await browser.fetch('/auth/session', {
                credentials: 'same-origin', cache: 'no-store',
                headers: { Accept: 'application/json' }, signal: controller.signal,
            });
            if (!stopped && response.status === 401) {
                stop();
                onUnauthorized();
            }
        } catch {
            // A network interruption does not end an authenticated session.
        } finally {
            browser.clearTimeout(timeout);
            controller = null;
        }
    }

    function stop() {
        stopped = true;
        browser.clearInterval(timer);
        browser.removeEventListener('pointerdown', markActive);
        browser.removeEventListener('keydown', markActive);
        browser.removeEventListener('focus', check);
        browser.document.removeEventListener('visibilitychange', check);
        controller?.abort();
    }

    const timer = browser.setInterval(tick, 15000);
    browser.addEventListener('pointerdown', markActive);
    browser.addEventListener('keydown', markActive);
    browser.addEventListener('focus', check);
    browser.document.addEventListener('visibilitychange', check);
    return stop;
}
