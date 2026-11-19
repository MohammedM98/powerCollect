import { Chip } from '@heroui/react';
import StatementTitle from './StatementTitle';
import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AccountStatement from './AccountStatement';
import { StandingDiscountBadge } from './AccountSummary';
import StopStandingDiscountButton from './StopStandingDiscountButton';
import { StatementActions, StatementForms } from './StatementForms';
import SubscriptionSwitcher from './SubscriptionSwitcher';
import ArchiveNotice from './ArchiveNotice';
import { BackLink } from '@/Components/PageHeader';

const STATUS_TONES = { active: 'success', suspended: 'warning', disconnected: 'default' };

/**
 * A subscription's account statement: every charge (عليه), payment and
 * discount (له), oldest first, with the balance after each line.
 *
 * @param {import('@/types/pages').StatementProps} props
 */
export default function Statement(statement) {
    const { subscription, subscriptions, entries, summary, canRecordPayment, canAddCharge, canAddDiscount, canAddClearing, paymentMethods, transactionTypes } = statement;
    // The form open over the statement: 'payment', 'charge' or 'discount', or a line to correct or delete.
    const [openForm, setOpenForm] = useState(null);
    // Where the statement puts its Excel and print buttons: beside the name, as in the redesign.
    const [toolsSlot, setToolsSlot] = useState(null);

    return (
        <AuthenticatedLayout
            header={
                <div className="gl-st-head">
                    <BackLink href="/subscriptions">المشتركون</BackLink>
                    <div className="gl-st-title">
                        <div className="min-w-0">
                            <StatementTitle name={subscription.fullName} as="h1">
                                {subscription.statusLabel && (
                                    <Chip size="sm" variant="soft" color={STATUS_TONES[subscription.status] ?? 'default'} className="gl-st-status">
                                        <i aria-hidden="true" />
                                        {subscription.statusLabel}
                                    </Chip>
                                )}
                            </StatementTitle>
                            <p className="gl-st-account">
                                حساب <bdi dir="ltr">{subscription.accountNumber}</bdi>، {subscription.tariffCategoryLabel}
                                {subscription.tariffSegmentName && ` (${subscription.tariffSegmentName})`}
                                {subscription.meterBoxNumber && `، طبلون ${subscription.meterBoxNumber}`}، {subscription.branchName}
                            </p>
                            {subscription.standingDiscount && (
                                <div className="gl-st-standing">
                                    <StandingDiscountBadge discount={subscription.standingDiscount} />
                                    {canAddDiscount && (
                                        <StopStandingDiscountButton
                                            subscriptionId={subscription.id}
                                            subscriptionName={subscription.fullName}
                                            discountLabel={subscription.standingDiscount.segment ? `${subscription.standingDiscount.terms} · ${subscription.standingDiscount.segment}` : subscription.standingDiscount.terms}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                        <div ref={setToolsSlot} className="gl-st-tools" />
                    </div>
                </div>
            }
        >
            <Head title={`كشف حساب ${subscription.fullName}`} />
            <ArchiveNotice subscription={subscription} />

            <div className="gl-st-page">
                <StatementActions
                    bar
                    canRecordPayment={canRecordPayment}
                    canRecordSplitPayment={statement.canRecordSplitPayment}
                    canAddCharge={canAddCharge}
                    canAddDiscount={canAddDiscount}
                    canAddClearing={canAddClearing}
                    onOpen={setOpenForm}
                />

                <AccountStatement
                    key={subscription.id}
                    subscription={subscription}
                    entries={entries}
                    summary={summary}
                    paymentMethods={paymentMethods}
                    transactionTypes={transactionTypes}
                    onAction={(action, entry) => setOpenForm({ action, entry })}
                    focusLineId={statement.focusLineId}
                    toolsSlot={toolsSlot}
                    between={
                        <SubscriptionSwitcher
                            subscriberNumber={subscription.subscriberNumber}
                            subscriptions={subscriptions}
                            currentId={subscription.id}
                            onSelect={(subscription) => router.visit(`/subscriptions/${subscription.id}/statement`)}
                        />
                    }
                />
            </div>

            <StatementForms statement={statement} openForm={openForm} onClose={() => setOpenForm(null)} onOpen={setOpenForm} />
        </AuthenticatedLayout>
    );
}
