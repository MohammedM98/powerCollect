import { lazy, Suspense } from 'react';

const StatementModal = lazy(() => import('./StatementModal'));

/**
 * The statement window for pages that open it from a list (ledger, payments,
 * receivables, audit): its code and its forms are downloaded when a statement
 * is first opened, not with the page.
 */
export default function LazyStatementModal(props) {
    return (
        <Suspense
            fallback={
                <p
                    role="status"
                    className="fixed bottom-6 left-1/2 z-100 -translate-x-1/2 rounded-control border border-gray-200 bg-surface px-4 py-3 text-sm text-gray-600 shadow-card"
                >
                    جارٍ تحميل النافذة…
                </p>
            }
        >
            <StatementModal {...props} />
        </Suspense>
    );
}
