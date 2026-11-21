import { lazy, Suspense } from 'react';
import { readingOptionFor, weekOptionsFor } from '@/lib/readings';
import { openQuickMessage } from '@/lib/quickMessage';

const MeterReadingModal = lazy(() => import('@/Pages/MeterReadings/MeterReadingModal'));

const SubscriptionMessageHistoryModal = lazy(() => import('@/Pages/Messages/SubscriptionMessageHistoryModal'));

const SubscriptionModal = lazy(() => import('./SubscriptionModal'));

const PersonalDetailsModal = lazy(() => import('./PersonalDetailsModal'));

const BulkChangeModal = lazy(() => import('./BulkChangeModal'));

const SubscriptionDetailsModal = lazy(() => import('./SubscriptionDetailsModal'));

const ReadingHistoryModal = lazy(() => import('./ReadingHistoryModal'));

const StatementModal = lazy(() => import('./StatementModal'));

const ArchiveSubscriptionModal = lazy(() => import('./ArchiveSubscriptionModal'));

/** The windows the subscriptions page opens over itself, each loaded only when first opened: details, statement, reading history, payments and readings, personal details, messages, bulk changes and archiving. */
export default function SubscriptionWindows({
    archiveSubscription,
    archiveToday,
    balanceLabel,
    bulkField,
    can,
    clearSelection,
    closeProfile,
    creating,
    deleteDialog,
    historySubscription,
    messageSubscription,
    modalProps,
    modalSubscription,
    openStatement,
    personalDetailsSubscription,
    readingSubscription,
    readingWeekOptions,
    selection,
    selectionCount,
    setArchiveSubscription,
    setBulkField,
    setCreating,
    historyWindow,
    setMessageSubscription,
    setModalSubscription,
    setPersonalDetailsSubscription,
    setReadingSubscription,
    setSubscriptionSource,
    setViewingSubscriptionId,
    statementWindow,
    statusOptions,
    subscriptionSource,
    subscriptions,
    switchProfile,
    viewingIndex,
    viewingSubscription,
    viewingSubscriptionId,
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
            {bulkField && (
                <BulkChangeModal
                    field={bulkField}
                    selection={selection}
                    count={selectionCount}
                    statusOptions={statusOptions}
                    selectionLabel={balanceLabel}
                    onClose={() => setBulkField(null)}
                    onDone={() => {
                        setBulkField(null);
                        clearSelection();
                    }}
                />
            )}

            {creating && <SubscriptionModal show onClose={() => setCreating(false)} subscription={null} {...modalProps} />}

            {subscriptionSource && (
                <SubscriptionModal
                    key={`subscription-${subscriptionSource.id}`}
                    show
                    onClose={() => setSubscriptionSource(null)}
                    subscription={null}
                    sourceSubscription={subscriptionSource}
                    {...modalProps}
                />
            )}

            {personalDetailsSubscription && (
                <PersonalDetailsModal
                    key={`personal-${personalDetailsSubscription.id}`}
                    subscription={personalDetailsSubscription}
                    onClose={() => setPersonalDetailsSubscription(null)}
                />
            )}

            {/* Keyed by subscription id so switching who's being edited remounts
                the form with fresh initial values — useForm() only captures
                its initial data once, it won't pick up a changed `subscription`
                prop on an already-mounted instance. Each window's key has its
                own prefix: siblings sharing a key (the same subscription open in
                two windows) make React duplicate them. */}
            {modalSubscription && (
                <SubscriptionModal
                    key={`edit-${modalSubscription.id}`}
                    show
                    onClose={() => setModalSubscription(null)}
                    subscription={modalSubscription}
                    {...modalProps}
                />
            )}

            {viewingSubscription && (
                <SubscriptionDetailsModal
                    key={`details-${viewingSubscription?.id ?? 'closed'}`}
                    subscription={viewingSubscription}
                    canUpdate={viewingSubscription?.canUpdate}
                    readingWeekOptions={weekOptionsFor(viewingSubscription, readingWeekOptions)}
                    statement={statementWindow.statement?.subscription.id === viewingSubscriptionId ? statementWindow.statement : null}
                    statementLoading={Boolean(statementWindow.subscription && !statementWindow.statement)}
                    onLoadStatement={() => openStatement(viewingSubscription)}
                    onPrevious={viewingIndex > 0 ? () => switchProfile(-1) : undefined}
                    onNext={viewingIndex >= 0 && viewingIndex < subscriptions.data.length - 1 ? () => switchProfile(1) : undefined}
                    onClose={closeProfile}
                    onEditPersonal={() => {
                        setPersonalDetailsSubscription(viewingSubscription);
                        closeProfile();
                    }}
                    readings={historyWindow.readingsFor(viewingSubscriptionId)}
                    onLoadReadings={() => historyWindow.load(viewingSubscriptionId)}
                    onOpenReadings={() => {
                        historyWindow.open(viewingSubscriptionId);
                        closeProfile();
                    }}
                    onSendMessage={can?.sendMessages ? () => openQuickMessage([viewingSubscriptionId]) : undefined}
                    onMessageHistory={can?.viewMessages ? () => setMessageSubscription(viewingSubscription) : undefined}
                    onEdit={() => {
                        setModalSubscription(viewingSubscription);
                        closeProfile();
                    }}
                    onOpenStatement={(form = null) => {
                        // The statement takes the details' place rather than opening over them.
                        setViewingSubscriptionId(null);
                        openStatement(viewingSubscription, form);
                    }}
                />
            )}

            {messageSubscription && (
                <SubscriptionMessageHistoryModal
                    key={messageSubscription.id}
                    subscription={messageSubscription}
                    onClose={() => setMessageSubscription(null)}
                />
            )}

            {historySubscription && (
                <ReadingHistoryModal
                    key={`history-${historySubscription?.id ?? 'closed'}`}
                    subscription={historySubscription}
                    readingWeekOptions={weekOptionsFor(historySubscription, readingWeekOptions)}
                    onClose={historyWindow.close}
                />
            )}

            {readingSubscription && (
                <MeterReadingModal
                    show
                    onClose={() => setReadingSubscription(null)}
                    reading={null}
                    fixedSubscription={readingOptionFor(readingSubscription)}
                    weekOptions={weekOptionsFor(readingSubscription, readingWeekOptions)}
                />
            )}

            {/* Keyed by subscription so each statement opens with its own filters and forms. */}
            {statementWindow.subscription && !viewingSubscription && (
                <StatementModal
                    key={`statement-${statementWindow.subscription.id}`}
                    subscription={statementWindow.subscription}
                    statement={statementWindow.statement}
                    initialForm={statementWindow.form}
                    onSwitch={(header) => statementWindow.open(header)}
                    onClose={statementWindow.close}
                />
            )}

            {deleteDialog}
            {archiveSubscription && (
                <ArchiveSubscriptionModal
                    key={archiveSubscription.id}
                    subscription={archiveSubscription}
                    today={archiveToday}
                    onClose={() => setArchiveSubscription(null)}
                />
            )}
        </Suspense>
    );
}
