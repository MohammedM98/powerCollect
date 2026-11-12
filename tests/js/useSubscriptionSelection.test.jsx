import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSubscriptionSelection } from '@/Pages/Subscriptions/useSubscriptionSelection';

const page = (ids, total = ids.length) => ({ data: ids.map((id) => ({ id })), total });

describe('choosing subscriptions for a bulk action', () => {
    it('keeps ticks across pages, ticks a whole page, and starts over on a new search', () => {
        const filters = { search: '', filter: {} };
        const { result, rerender } = renderHook(({ subscriptions, key }) => useSubscriptionSelection(subscriptions, filters, key, false), {
            initialProps: { subscriptions: page([1, 2, 3], 40), key: 'a' },
        });

        act(() => result.current.toggleSubscription(2));
        rerender({ subscriptions: page([4, 5], 40), key: 'a' });
        act(() => result.current.togglePage());
        expect([...result.current.selectedIds].sort()).toEqual([2, 4, 5]);
        expect(result.current.selection).toEqual({ ids: [2, 4, 5] });

        act(() => result.current.togglePage());
        expect([...result.current.selectedIds]).toEqual([2]);

        rerender({ subscriptions: page([4, 5], 12), key: 'b' });
        expect(result.current.selectedIds.size).toBe(0);
    });

    it('chooses every match of the filters, and counts the whole result', () => {
        const filters = { search: 'أحمد', filter: { status: 'active' } };
        const { result } = renderHook(() => useSubscriptionSelection(page([1, 2], 75), filters, 'a', false));

        act(() => result.current.toggleSubscription(1));
        act(() => result.current.selectAllMatching());

        expect(result.current.selectionCount).toBe(75);
        expect(result.current.selection).toEqual({ all: true, search: 'أحمد', filter: { status: 'active' } });
    });

    it('opens the field to change once both an action and subscriptions are chosen', () => {
        const { result } = renderHook(() => useSubscriptionSelection(page([1, 2]), { search: '', filter: {} }, 'a', false));

        act(() => result.current.chooseBulkAction({ key: 'status' }));
        expect(result.current.bulkField).toBeNull();

        act(() => result.current.toggleSubscription(1));
        act(() => result.current.continueBulkAction());
        expect(result.current.bulkField).toBe('status');
    });
});
