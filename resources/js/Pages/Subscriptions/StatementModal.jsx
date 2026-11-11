import { useId, useState } from 'react';
import { Link } from '@inertiajs/react';
import Modal from '@/Components/Modal';
import Icon from '@/Components/Icon';
import StatusPill from '@/Components/DataTable/StatusPill';
import AccountStatement from './AccountStatement';
import { StandingDiscountBadge } from './AccountSummary';
import StopStandingDiscountButton from './StopStandingDiscountButton';
import { StatementActions, StatementForms } from './StatementForms';
import SubscriptionSwitcher from './SubscriptionSwitcher';
import ArchiveNotice from './ArchiveNotice';

const STATUS_TONES = {
    active: 'green',
    suspended: 'amber',
    disconnected: 'gray',
};

/** Placeholder cards and rows while the statement loads. */
function StatementSkeleton() {
    return (
        <div className="animate-pulse space-y-4" aria-hidden="true">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((card) => (
                    <div key={card} className="h-[118px] rounded-xl border border-gray-100 bg-surface" />
                ))}
            </div>
            <div className="h-28 rounded-panel bg-surface" />
            {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="h-16 rounded-row bg-gray-200/70" />
            ))}
        </div>
    );
}

/**
 * A subscription's financial history — their account statement — in a wide
 * pop-up over the list, the height of the screen, closed with its close
 * button, Esc, or a click outside it. Its header names the subscription
 * and puts each movement it may add one click away. `subscription` (from the list's row) fills the header at once;
 * `statement` (the statement's props) fills the rest when it arrives.
 * `initialForm` ('payment', 'charge', 'discount' or 'clearing') opens that form as
 * soon as the statement is there. `onSwitch(header)` opens another of the
 * same person's subscriptions in its place.
 */
export default function StatementModal({ subscription, statement, initialForm = null, focusLineId = null, onSwitch, onClose, onEdit = null }) {
    const titleId = useId();
    // The form open over the statement: 'payment', 'charge' or 'discount', or a line to correct or delete.
    const [openForm, setOpenForm] = useState(initialForm);
    const header = statement?.subscription ?? subscription;

    return (
        <>
            <Modal show onClose={onClose} maxWidth="full">
                <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="gl-statement flex min-h-0 flex-col">
                    <header className="gl-dialog-head grid shrink-0 gap-3.5 px-4 py-4 sm:px-6">
                        <div className="flex items-start gap-3.5">
                            <span className="gl-tone gl-tone-brand hidden h-11 w-11 shrink-0 items-center justify-center rounded-[14px] sm:flex">
                                <Icon name="ledger" className="h-[22px] w-[22px]" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <h3 id={titleId} className="text-xl font-extrabold !font-[family-name:var(--gl-head)]">
                                        كشف حساب {header.fullName}
                                    </h3>
                                    {header.statusLabel && <StatusPill tone={STATUS_TONES[header.status]} label={header.statusLabel} />}
                                    {header.standingDiscount && <StandingDiscountBadge discount={header.standingDiscount} />}
                                    {header.standingDiscount && statement?.canAddDiscount && (
                                        <StopStandingDiscountButton
                                            subscriptionId={header.id}
                                            subscriptionName={header.fullName}
                                            discountLabel={header.standingDiscount.segment ? `${header.standingDiscount.terms} · ${header.standingDiscount.segment}` : header.standingDiscount.terms}
                                        />
                                    )}
                                </div>
                                <p className="gl-sub mt-0.5 !text-[13px]">
                                    {header.subscriberNumber && (
                                        <>
                                            مشترك <span dir="ltr">{header.subscriberNumber}</span> ·{' '}
                                        </>
                                    )}
                                    {header.accountNumber && (
                                        <>
                                            حساب <span dir="ltr">{header.accountNumber}</span> ·{' '}
                                        </>
                                    )}
                                    {header.tariffCategoryLabel && (
                                        <>
                                            {header.tariffCategoryLabel}
                                            {header.tariffSegmentName && ` (${header.tariffSegmentName})`} ·{' '}
                                        </>
                                    )}
                                    {header.meterBoxNumber && `طبلون ${header.meterBoxNumber} · `}
                                    {header.branchName}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {onEdit && statement?.canUpdate && (
                                    <button type="button" onClick={() => onEdit(header)} aria-label="تعديل البيانات" title="تعديل البيانات" className="gl-ib">
                                        <Icon name="pencil" className="h-[18px] w-[18px]" />
                                    </button>
                                )}
                                <Link
                                    href={`/subscriptions/${header.id}/statement${focusLineId ? `?transaction=${focusLineId}` : ''}`}
                                    title="فتح الكشف في صفحة مستقلة"
                                    aria-label="فتح الكشف في صفحة مستقلة"
                                    className="gl-ib"
                                >
                                    <Icon name="external" className="h-[18px] w-[18px]" />
                                </Link>
                                <button type="button" onClick={onClose} aria-label="إخفاء الكشف" title="إخفاء (Esc)" className="gl-ib">
                                    <Icon name="close" className="h-[18px] w-[18px]" />
                                </button>
                            </div>
                        </div>
                        {statement && (
                            <StatementActions
                                canRecordPayment={statement.canRecordPayment}
                                canRecordSplitPayment={statement.canRecordSplitPayment}
                                canAddCharge={statement.canAddCharge}
                                canAddDiscount={statement.canAddDiscount}
                                canAddClearing={statement.canAddClearing}
                                onOpen={setOpenForm}
                            />
                        )}
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6" aria-busy={!statement}>
                        <ArchiveNotice subscription={header} />
                        {statement ? (
                            <>
                                <SubscriptionSwitcher
                                    subscriberNumber={statement.subscription.subscriberNumber}
                                    subscriptions={statement.subscriptions}
                                    currentId={statement.subscription.id}
                                    onSelect={onSwitch}
                                />
                                <AccountStatement
                                    key={statement.subscription.id}
                                    subscription={statement.subscription}
                                    entries={statement.entries}
                                    summary={statement.summary}
                                    paymentMethods={statement.paymentMethods}
                                    transactionTypes={statement.transactionTypes}
                                    onAction={(action, entry) => setOpenForm({ action, entry })}
                                    focusLineId={focusLineId}
                                />
                            </>
                        ) : (
                            <StatementSkeleton />
                        )}
                    </div>
                </div>
            </Modal>

            {statement && <StatementForms statement={statement} openForm={openForm} onClose={() => setOpenForm(null)} onOpen={setOpenForm} />}
        </>
    );
}
