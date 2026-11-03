import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import { ACTION_MESSAGES, visitReturnsStatus } from '@/lib/actionMessages';
import { createNotificationQueue } from '@/lib/notificationQueue';

/**
 * The prototype's toast (glass.css `gl-toast`): a light bar at the bottom
 * of the page, the status shown by its icon's colour and, when it failed,
 * by a title above the reason.
 */
const APPEARANCE = {
    success: { icon: 'check', tone: 'var(--gl-ok)' },
    error: { title: 'تعذّر الحفظ', icon: 'alert', tone: 'var(--gl-bad)' },
    warning: { title: 'تنبيه', icon: 'alert', tone: 'var(--gl-warn)' },
    deleteError: { title: 'تعذّر الحذف', icon: 'alert', tone: 'var(--gl-bad)' },
};

/** Only the newest few cards are shown at once; hidden older ones still close on their own timer. */
const MAX_VISIBLE = 4;

export default function FlashNotifications({ initialStatus }) {
    const [notifications, setNotifications] = useState([]);
    const queue = useRef(null);

    useEffect(() => {
        const currentQueue = createNotificationQueue(setNotifications);
        queue.current = currentQueue;
        function showStatus(status) {
            currentQueue.push(ACTION_MESSAGES[status] ?? status);
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
            const errors = event.detail.errors ?? {};
            const messages = Object.values(errors);

            // A refused delete says what still uses the record.
            if (errors.delete) {
                currentQueue.push(errors.delete, 'deleteError');

                return;
            }

            currentQueue.push(messages.length === 1 ? messages[0] : 'يرجى مراجعة الحقول المحددة والمحاولة مجددًا.', 'error');
        });

        // A message raised from the page itself, with notify().
        function onNotify(event) {
            currentQueue.push(event.detail?.message, event.detail?.type);
        }
        window.addEventListener('app:notify', onNotify);

        return () => {
            window.removeEventListener('app:notify', onNotify);
            unsubscribeStart();
            unsubscribeSuccess();
            unsubscribeError();
            currentQueue.dispose();
        };
    }, [initialStatus]);

    return (
        <div
            dir="rtl"
            role="region"
            aria-label="الإشعارات"
            className="gl-toasts pointer-events-none"
        >
            {notifications.slice(-MAX_VISIBLE).map((notification) => {
                const appearance = APPEARANCE[notification.type] ?? APPEARANCE.success;

                return (
                    <div
                        key={notification.id}
                        role={notification.type !== 'success' ? 'alert' : 'status'}
                        style={{ '--flash-duration': `${notification.duration}ms`, '--gl-c': appearance.tone }}
                        onMouseEnter={() => queue.current.pause(notification.id)}
                        onMouseLeave={() => queue.current.resume(notification.id)}
                        className={`gl-toast flash-notification pointer-events-auto ${
                            notification.type !== 'success' ? 'flash-notification-error' : ''
                        } ${notification.leaving ? 'flash-notification-leaving' : ''}`}
                    >
                        <div className={`flex gap-3 py-3 pe-2 ps-3 ${appearance.title ? 'items-start' : 'items-center'}`}>
                            <span className="gl-toast-icon">
                                <Icon name={appearance.icon} className="h-[18px] w-[18px]" strokeWidth={2.25} />
                            </span>
                            <div className="min-w-0 flex-1">
                                {appearance.title && <p className="font-bold leading-7">{appearance.title}</p>}
                                <p className={`break-words leading-7 ${appearance.title ? '' : 'font-bold'}`}>
                                    {notification.message}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => queue.current.dismiss(notification.id)}
                                aria-label="إغلاق الإشعار"
                                className="gl-toast-close"
                            >
                                <Icon name="close" className="h-4 w-4" strokeWidth={2} />
                            </button>
                        </div>
                        <div aria-hidden="true" className="gl-toast-track">
                            <div className="flash-notification-countdown h-full" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
