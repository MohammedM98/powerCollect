import { Button, Input } from '@heroui/react';
import Icon from '@/Components/Icon';
import InputError from '@/Components/InputError';
import { describeBalance } from '@/lib/accountStatement';
import { initials, normalizeDecimalInput } from '@/lib/format';
import { balanceText, BALANCE_CHIPS, FieldLabel } from '@/Pages/Subscriptions/AccountFormParts';
import { inputClass } from '@/Pages/Subscriptions/PaymentModal';
import { SecondaryKey } from '@/Components/UI';

/**
 * One subscription of the split as a line of the distribution sheet: who,
 * the balance now, the share typed in place, and the balance it leaves.
 */
function PartRow({ part, onAmount, onRemove, error }) {
    const now = describeBalance(part.subscription.balance);
    const after = describeBalance(Number(part.subscription.balance) - Number(part.amount || 0));

    return (
        <>
            <tr className="is-new">
                <td>
                    <div className="gl-sp-who">
                        <span className="gl-sp-av" aria-hidden="true">
                            {initials(part.subscription.fullName)}
                            <i className={STATUS_DOTS[part.subscription.status] ?? 'bg-gray-400'} />
                        </span>
                        <span className="min-w-0">
                            <b>{part.subscription.fullName}</b>
                            <small>
                                حساب <bdi dir="ltr" className="gl-num">{part.subscription.accountNumber}</bdi>
                                {part.subscription.meterBoxNumber && `، طبلون ${part.subscription.meterBoxNumber}`}
                            </small>
                        </span>
                    </div>
                </td>
                <td className="gl-num" data-tone={now.tone}>{balanceText(now)}</td>
                <td>
                    <div className="gl-cl-in is-amount" data-invalid={error ? true : undefined}>
                        <Input
                            id={`part-${part.subscription.id}`}
                            inputMode="decimal"
                            autoComplete="off"
                            dir="ltr"
                            placeholder="0.00"
                            aria-label={`مبلغ ${part.subscription.fullName}`}
                            value={part.amount}
                            onChange={(event) => onAmount(normalizeDecimalInput(event.target.value))}
                        />
                        <span aria-hidden="true">₪</span>
                    </div>
                </td>
                <td><b className="gl-sp-after gl-num" data-tone={after.tone}>{balanceText(after)}</b></td>
                <td>
                    <Button data-raw="" variant="ghost" onClick={onRemove} aria-label={`إزالة ${part.subscription.fullName}`} className="gl-sp-x">
                        <Icon name="close" className="h-[18px] w-[18px]" />
                    </Button>
                </td>
            </tr>
            {error && (
                <tr className="gl-sp-err">
                    <td colSpan={5}><InputError message={error} /></td>
                </tr>
            )}
        </>
    );
}

/** Spreading the transfer: finding subscribers by name, ID or account, and each one's share. */
export default function SplitRecipientsSection({
    addIdentitySiblings,
    addSubscription,
    errors,
    found,
    identityNote,
    parts,
    removePart,
    setAmount,
    setTerm,
    term,
}) {
    return (
        <section className="gl-split-panel" aria-label="توزيع المبلغ على المشتركين">
            <FieldLabel htmlFor="split_search" required hint="أي مشتركين تختارهم، ولو بهويات مختلفة">
                <span className="gl-split-panel-title">توزيع المبلغ على المشتركين</span>
            </FieldLabel>

            {parts.length > 0 && (
                <div className="gl-cl" data-tone="split" data-excel-source="custom">
                    <div className="gl-cl-scroll">
                        <table className="gl-cl-table gl-sp-table">
                            <thead>
                                <tr>
                                    <th scope="col">المشترك</th>
                                    <th scope="col">الرصيد الحالي</th>
                                    <th scope="col">يدفع</th>
                                    <th scope="col">بعد الدفعة</th>
                                    <th scope="col"><span className="sr-only">إزالة</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {parts.map((part, index) => (
                                    <PartRow
                                        key={part.subscription.id}
                                        part={part}
                                        onAmount={(amount) => setAmount(index, amount)}
                                        onRemove={() => removePart(index)}
                                        error={errors[`parts.${index}.amount`] ?? errors[`parts.${index}.subscription_id`]}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-start gap-3">
                <div className="gl-sp-search relative min-w-0 flex-1 basis-72">
                    <Icon name="search" className="pointer-events-none absolute inset-y-0 inset-s-4 my-auto h-[18px] w-[18px] text-gray-400" />
                    <Input
                        id="split_search"
                        type="search"
                        aria-label="إضافة مشترك إلى هذه الدفعة"
                        autoComplete="off"
                        value={term}
                        onChange={(event) => setTerm(event.target.value)}
                        placeholder={parts.length === 0 ? 'ابحث عن مشترك بالاسم أو رقم الحساب أو الجوال…' : 'إضافة مشترك آخر إلى هذه الدفعة…'}
                        disabled={parts.length >= MAX_PARTS}
                        className={`${inputClass} field-room-start-wide`}
                    />
                    {found.searched && (
                        <ul className="animate-modal-panel absolute inset-x-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl p-2 gl-pop">
                            {found.subscriptions.length === 0 && (
                                <li className="px-3 py-3 text-center text-sm text-gray-500">لا يوجد مشترك يطابق بحثك.</li>
                            )}
                            {found.subscriptions.map((subscription) => {
                                const added = parts.some((part) => part.subscription.id === subscription.id);

                                return (
                                    <li key={subscription.id}>
                                        <Button data-raw="" variant="ghost"
                                            isDisabled={added}
                                            onClick={() => addSubscription(subscription)}
                                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition hover:bg-gray-50 disabled:opacity-40"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <b className="block truncate text-[14.5px] text-gray-900">{subscription.fullName}</b>
                                                <small className="block text-xs font-medium text-gray-500">
                                                    <span dir="ltr" className="font-display">
                                                        {subscription.accountNumber}
                                                    </span>
                                                    {subscription.meterBoxNumber && `، طبلون ${subscription.meterBoxNumber}`}
                                                </small>
                                            </span>
                                            <span
                                                className={`whitespace-nowrap rounded-[10px] px-2 py-1 font-display text-[13px] font-bold ${added ? 'bg-gray-100 text-gray-700' : BALANCE_CHIPS[describeBalance(subscription.balance).tone]}`}
                                            >
                                                {added ? 'مُضاف' : balanceText(describeBalance(subscription.balance))}
                                            </span>
                                        </Button>
                                    </li>
                                );
                            })}
                            {found.hasMore && (
                                <li className="px-3 py-2 text-center text-xs text-gray-500">هناك نتائج أخرى؛ أضف إلى البحث ما يضيّقه.</li>
                            )}
                        </ul>
                    )}
                </div>
                {parts.length > 0 && (
                    <SecondaryKey onClick={addIdentitySiblings} className="h-[50px]">
                        <Icon name="users" className="h-4 w-4" />
                        كل اشتراكات هذه الهوية
                    </SecondaryKey>
                )}
            </div>
            {identityNote && <p className="mt-2 text-[13.5px] text-gray-600">{identityNote}</p>}
            <InputError message={errors.parts} className="mt-2" />
        </section>
    );
}

/** The most subscriptions one transfer is divided between (the server's limit). */
export const MAX_PARTS = 20;

export const STATUS_DOTS = { active: 'bg-emerald-500', suspended: 'bg-amber-500', disconnected: 'bg-gray-400' };
