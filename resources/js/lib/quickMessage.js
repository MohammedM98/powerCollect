

/** The event the layout's quick message window opens on. */
export const QUICK_MESSAGE_EVENT = 'app:quick-message';

/**
 * Open the quick message window from any page, with the given subscription
 * ids already picked as its recipients (none: pick them in the window).
 */
export function openQuickMessage(subscriptionIds = [], selection = null) {
    window.dispatchEvent(new CustomEvent(QUICK_MESSAGE_EVENT, { detail: { subscriptionIds, selection } }));
}

/** The recipients' address for the given subscriptions: every status, as they were picked by hand. */
export function recipientsUrl(params, ids = []) {
    const query = new URLSearchParams({ status: '', ...params });
    ids.forEach((id) => query.append('subscription_ids[]', id));

    return `/messages/recipients?${query}`;
}

/** Rows by subscription id. */
export function byId(rows) {
    return Object.fromEntries(rows.map((row) => [row.id, row]));
}
