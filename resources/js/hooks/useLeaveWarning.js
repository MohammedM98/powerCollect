import { useEffect } from 'react';

/** While `unsaved` is true, leaving or reloading the page asks the browser's "leave this page?" first. */
export function useLeaveWarning(unsaved) {
    useEffect(() => {
        if (!unsaved) {
            return undefined;
        }

        function warnBeforeUnload(event) {
            event.preventDefault();
            event.returnValue = '';
        }

        window.addEventListener('beforeunload', warnBeforeUnload);

        return () => window.removeEventListener('beforeunload', warnBeforeUnload);
    }, [unsaved]);
}
