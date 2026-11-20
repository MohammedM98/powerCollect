import { useState } from 'react';
import { openQuickMessage } from '@/lib/quickMessage';

/**
 * The subscriptions ticked for a bulk action, kept across pages, or every
 * match of the filters; and the bulk action waiting for a choice. A new
 * search or filter (`filtersKey`) is a new list and starts the choice over.
 */
export function useSubscriptionSelection(subscriptions, filters, filtersKey, filtersPending) {
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [allMatching, setAllMatching] = useState(false);
    const [bulkField, setBulkField] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [listKey, setListKey] = useState(filtersKey);
    const pageIds = subscriptions.data.map((subscription) => subscription.id);
    const pageSelectedCount = pageIds.filter((id) => selectedIds.has(id)).length;
    const selectionCount = allMatching ? subscriptions.total : selectedIds.size;
    const selection = allMatching ? { all: true, search: filters.search, filter: filters.filter } : { ids: [...selectedIds] };

    if (listKey !== filtersKey) {
        setListKey(filtersKey);
        setSelectedIds(new Set());
        setAllMatching(false);
    }

    function toggleSubscription(id) {
        setAllMatching(false);
        setSelectedIds((current) => {
            const next = new Set(current);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function togglePage() {
        setAllMatching(false);
        setSelectedIds((current) => {
            const next = new Set(current);
            const everyChosen = pageIds.every((id) => next.has(id));
            pageIds.forEach((id) => (everyChosen ? next.delete(id) : next.add(id)));
            return next;
        });
    }

    function selectAllMatching() {
        setSelectedIds(new Set());
        setAllMatching(true);
    }

    function clearSelection() {
        setSelectedIds(new Set());
        setAllMatching(false);
        setPendingAction(null);
    }

    function continueBulkAction(action = pendingAction) {
        if (!action || filtersPending || selectionCount < 1 || selectionCount > 5000) return;
        if (action.key === 'message') {
            openQuickMessage(selection.ids ?? [], selection.all ? selection : null);
        } else {
            setBulkField(action.key);
        }
    }

    function chooseBulkAction(action) {
        setPendingAction(action);
        if (selectionCount > 0) continueBulkAction(action);
    }

    return {
        selectedIds,
        allMatching,
        setAllMatching,
        bulkField,
        setBulkField,
        pendingAction,
        setPendingAction,
        pageIds,
        pageSelectedCount,
        selectionCount,
        selection,
        toggleSubscription,
        togglePage,
        selectAllMatching,
        clearSelection,
        continueBulkAction,
        chooseBulkAction,
    };
}
