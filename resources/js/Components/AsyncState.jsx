import { Button } from '@heroui/react';
import Icon from '@/Components/Icon';

/**
 * What a part of the page shows while its data loads from the server, when
 * the request failed, and when there is nothing to show: a pulsing
 * skeleton, the reason with a way to try again, or the empty message.
 * Once the data is there, its children.
 */
export default function AsyncState({ loading = false, error = null, empty = false, onRetry = null, loadingLabel = 'جارٍ التحميل…', emptyText = 'لا توجد بيانات.', rows = 3, children }) {
    if (error) {
        return (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-control border border-red-200 bg-red-50/60 px-5 py-6 text-center text-base text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <Icon name="alert" className="h-6 w-6" />
                <p className="leading-7">{error}</p>
                {onRetry && (
                    <Button data-raw="" variant="ghost" onClick={onRetry} className="gl-btn gl-ghost gl-sm">
                        <Icon name="repeat" className="h-4 w-4" />
                        إعادة المحاولة
                    </Button>
                )}
            </div>
        );
    }

    if (loading) {
        return (
            <div role="status" aria-label={loadingLabel} className="animate-pulse space-y-3 py-2">
                {Array.from({ length: rows }, (_, index) => (
                    <div key={index} className="h-10 rounded-control bg-gray-100" />
                ))}
            </div>
        );
    }

    if (empty) {
        return <p className="py-8 text-center text-sm text-gray-500">{emptyText}</p>;
    }

    return children;
}
