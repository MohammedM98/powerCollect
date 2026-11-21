import { useEffect } from 'react';
import { router } from '@inertiajs/react';
import { I18nProvider, Toast } from '@heroui/react';
import Icon from '@/Components/Icon';
import { ACTION_MESSAGES, visitReturnsStatus } from '@/lib/actionMessages';
import { flashToast } from '@/lib/flashToast';

/** The messages on screen: HeroUI's queue keeps their timers, pauses them under the pointer and plays their exit. */
const queue = new Toast.Queue({ maxVisibleToasts: 3 });

function show(message, type) {
    const toast = flashToast(message, type);

    if (toast) {
        queue.add(toast.content, { timeout: toast.timeout });
    }
}

/**
 * The feedback for every action (HeroUI's Toast, components.css `gl-toast`):
 * bottom right, each card in its own colour, green for a save, amber for a
 * warning, red for a failure, with a round icon, a way out and a line
 * showing the time left. It shows the status a save returns, a failed
 * visit's errors, and notify() from the page.
 */
export default function FlashNotifications({ initialStatus }) {
    useEffect(() => {
        function showStatus(status) {
            show(ACTION_MESSAGES[status] ?? status, 'success');
        }
        showStatus(initialStatus);
        // The visits whose response carries a fresh status; a partial reload keeps the page's old one.
        const visitsWithStatus = new Set();
        const unsubscribeStart = router.on('start', (event) => {
            if (visitReturnsStatus(event.detail.visit)) {
                visitsWithStatus.add(event.detail.visit.id);
            }
        });
        const unsubscribeSuccess = router.on('success', (event) => {
            if (visitsWithStatus.delete(event.detail.visitId)) {
                showStatus(event.detail.page.props.status);
            }
        });
        // A single-field failure (e.g. a reading lower than the last one)
        // is shown with its own message; anything else gets the general one.
        const unsubscribeError = router.on('error', (event) => {
            // A form that shows its own errors (data-errors-inline, e.g. the sign-in form) needs no card as well.
            if (document.querySelector('[data-errors-inline]')) {
                return;
            }

            const errors = event.detail.errors ?? {};
            const messages = Object.values(errors);

            // A refused delete says what still uses the record.
            if (errors.delete) {
                show(errors.delete, 'deleteError');

                return;
            }

            show(messages.length === 1 ? messages[0] : 'يرجى مراجعة الحقول المحددة والمحاولة مجددًا.', 'error');
        });

        // A message raised from the page itself, with notify().
        function onNotify(event) {
            show(event.detail?.message, event.detail?.type);
        }
        window.addEventListener('app:notify', onNotify);

        return () => {
            window.removeEventListener('app:notify', onNotify);
            unsubscribeStart();
            unsubscribeSuccess();
            unsubscribeError();
            queue.clear();
        };
    }, [initialStatus]);

    // Arabic, so the region's «start» is the right edge.
    return (
        <I18nProvider locale="ar">
            <Toast.Provider queue={queue} placement="bottom start" width={400} maxVisibleToasts={3} className="gl-toasts" aria-label="الإشعارات">
                {({ toast }) => {
                    const { tone, icon, title, description } = toast.content;

                    return (
                        <Toast toast={toast} className="gl-toast" data-tone={tone} style={{ '--gl-toast-ms': `${toast.timeout}ms` }}>
                            <Toast.Indicator className="gl-toast-icon">
                                <Icon name={icon} strokeWidth={2.25} />
                            </Toast.Indicator>
                            <Toast.Content className="gl-toast-body">
                                <Toast.Title className="gl-toast-title">{title}</Toast.Title>
                                {description && <Toast.Description className="gl-toast-desc">{description}</Toast.Description>}
                            </Toast.Content>
                            <Toast.CloseButton aria-label="إغلاق الإشعار" className="gl-toast-close" />
                            <span className="gl-toast-timer" aria-hidden="true" />
                        </Toast>
                    );
                }}
            </Toast.Provider>
        </I18nProvider>
    );
}
