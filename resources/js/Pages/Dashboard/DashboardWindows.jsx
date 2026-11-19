import { lazy, Suspense } from 'react';

const BranchModal = lazy(() => import('@/Pages/Branches/BranchModal'));

const UserModal = lazy(() => import('@/Pages/Users/UserModal'));

const SubscriptionModal = lazy(() => import('@/Pages/Subscriptions/SubscriptionModal'));

const StatementModal = lazy(() => import('@/Pages/Subscriptions/StatementModal'));

const QuickPaymentSearch = lazy(() => import('./QuickPaymentSearch'));

/** The windows the home page opens over itself, each loaded when first opened: a branch, a user, a subscriber, a statement and the quick payment search. */
export default function DashboardWindows({
    branchForm,
    closeEdit,
    creating,
    editing,
    findingPayer,
    openEdit,
    openStatement,
    returnHere,
    setCreating,
    setFindingPayer,
    statementWindow,
    subscriptionEdit,
    subscriptionForm,
    userForm,
}) {
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
            {branchForm && creating === 'branch' && (
                <BranchModal
                    show
                    onClose={() => setCreating(null)}
                    branch={null}
                    governorates={branchForm.governorates}
                    areas={branchForm.areas}
                    visitOptions={returnHere}
                />
            )}
            {subscriptionForm && creating === 'subscription' && (
                <SubscriptionModal show onClose={() => setCreating(null)} subscription={null} visitOptions={returnHere} {...subscriptionForm} />
            )}
            {subscriptionForm && subscriptionEdit && editing && (
                <SubscriptionModal
                    key={`edit-${subscriptionEdit.id}`}
                    show
                    onClose={closeEdit}
                    subscription={subscriptionEdit}
                    visitOptions={returnHere}
                    {...subscriptionForm}
                />
            )}
            {findingPayer && (
                <QuickPaymentSearch
                    show
                    onClose={() => setFindingPayer(false)}
                    onPick={(subscriber) => {
                        setFindingPayer(false);
                        openStatement(subscriber, 'payment');
                    }}
                />
            )}
            {statementWindow.subscription && (
                <StatementModal
                    key={statementWindow.subscription.id}
                    subscription={statementWindow.subscription}
                    statement={statementWindow.statement}
                    initialForm={statementWindow.form}
                    onSwitch={(header) => statementWindow.open(header)}
                    onClose={statementWindow.close}
                    onEdit={openEdit}
                />
            )}
            {userForm && creating === 'user' && (
                <UserModal
                    show
                    onClose={() => setCreating(null)}
                    user={null}
                    branches={userForm.branches}
                    canChooseBranch={userForm.canChooseBranch}
                    userTypeOptions={userForm.userTypeOptions}
                    canCreateUserType={userForm.canCreateUserType}
                    visitOptions={returnHere}
                />
            )}
        </Suspense>
    );
}
