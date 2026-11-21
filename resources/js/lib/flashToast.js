/**
 * Each kind of flash message: the tone its card is drawn in, its icon, how
 * long it stays (errors longest, so there is time to read why) and, for a
 * warning or a failure, the title over the message.
 */
const KINDS = {
    success: { tone: 'success', icon: 'check', title: null, timeout: 4000 },
    warning: { tone: 'warning', icon: 'warning', title: 'تنبيه', timeout: 5000 },
    error: { tone: 'danger', icon: 'alert', title: 'تعذّر الحفظ', timeout: 7000 },
    deleteError: { tone: 'danger', icon: 'alert', title: 'تعذّر الحذف', timeout: 7000 },
};

/**
 * What a flash message becomes on screen (FlashNotifications' HeroUI
 * toast): a success reads as its own title; a warning or a failure gets its
 * title with the message under it. An empty message shows nothing.
 *
 * @return {{ content: { tone: string, icon: string, title: string, description: string|null }, timeout: number }|null}
 */
export function flashToast(message, type = 'success') {
    if (typeof message !== 'string' || !message.trim()) {
        return null;
    }

    const kind = KINDS[type] ?? KINDS.success;

    return {
        content: { tone: kind.tone, icon: kind.icon, title: kind.title ?? message, description: kind.title ? message : null },
        timeout: kind.timeout,
    };
}
