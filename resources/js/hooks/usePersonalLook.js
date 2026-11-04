import { useSyncExternalStore } from 'react';
import { EMPTY_LOOK, LOOK_EVENT, LOOK_STORAGE_KEY, readLook, saveLook } from '@/lib/personalLook';

let current = null;

function snapshot() {
    current ??= readLook();

    return current;
}

function subscribe(listener) {
    function onChange(event) {
        if (event.type === 'storage' && event.key !== LOOK_STORAGE_KEY) {
            return;
        }

        current = event.detail ?? readLook();
        listener();
    }

    window.addEventListener(LOOK_EVENT, onChange);
    // Another tab of the app changed it.
    window.addEventListener('storage', onChange);

    return () => {
        window.removeEventListener(LOOK_EVENT, onChange);
        window.removeEventListener('storage', onChange);
    };
}

/**
 * This person's own look in this browser (lib/personalLook.js), and a way
 * to change part of it (`change({ glass: 0.4 })`) or all of it back to the
 * company's (`reset()`). Every part of the page stays in step.
 */
export function usePersonalLook() {
    const look = useSyncExternalStore(subscribe, snapshot, () => EMPTY_LOOK);

    return {
        look,
        change: (patch) => saveLook({ ...look, ...patch }),
        reset: () => saveLook(EMPTY_LOOK),
    };
}
