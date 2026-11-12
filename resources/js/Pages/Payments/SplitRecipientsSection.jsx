import Icon from '@/Components/Icon';
import InputError from '@/Components/InputError';
import SecondaryButton from '@/Components/SecondaryButton';
import { describeBalance } from '@/lib/accountStatement';
import { initials, normalizeDecimalInput } from '@/lib/format';
import { balanceText, BALANCE_CHIPS, FieldLabel } from '@/Pages/Subscriptions/AccountFormParts';
import { inputClass } from '@/Pages/Subscriptions/PaymentModal';

/** One subscription of the split, laid out like the subscription strip of the payment form, with the share it pays. */
function PartRow({ part, onAmount, onRemove, error }) {
    const after = describeBalance(Number(part.subscription.balance) - Number(part.amount || 0));

    return (
        <li className="grid gap-2">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3 rounded-[18px] border border-gray-100 bg-gray-50 px-3.5 py-3">
                <div className="flex min-w-0 flex-1 basis-52 items-center gap-3.5">
                    <span className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-graphite-gradient font-display text-[15px] font-bold text-white">
                        {initials(part.subscription.fullName)}
                        <span
                            className={`absolute -bottom-0.5 -start-0.5 h-[13px] w-[13px] rounded-full border-[2.5px] border-gray-50 ${STATUS_DOTS[part.subscription.status] ?? 'bg-gray-400'}`}
                            aria-hidden="true"
                        />
                    </span>
                    <div className="min-w-0">
                        <p className="break-words text-[16.5px] font-bold text-gray-900">{part.subscription.fullName}</p>
                        <p className="text-[13.5px] text-gray-500">
                            حساب{' '}
                            <span dir="ltr" className="font-display">
                                {part.subscription.accountNumber}
                            </span>
                            {part.subscription.meterBoxNumber && ` · طبلون ${part.subscription.meterBoxNumber}`}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[12.5px] text-gray-500">الرصيد الحالي</span>
                    <span
                        className={`whitespace-nowrap rounded-[10px] px-2.5 py-0.5 font-display text-[15px] font-bold ${BALANCE_CHIPS[describeBalance(part.subscription.balance).tone]}`}
                    >
                        {balanceText(describeBalance(part.subscription.balance))}
                    </span>
                </div>

                <div className="w-36">
                    <label htmlFor={`part-${part.subscription.id}`} className="sr-only">
                        {`مبلغ ${part.subscription.fullName}`}
                    </label>
                    <div className="relative">
                        <input
                            id={`part-${part.subscription.id}`}
                            inputMode="decimal"
                            autoComplete="off"
                            dir="ltr"
                            placeholder="0.00"
                            aria-label={`مبلغ ${part.subscription.fullName}`}
                            value={part.amount}
                            onChange={(event) => onAmount(normalizeDecimalInput(event.target.value))}
                            className={`${inputClass} pe-9 text-end font-display text-lg font-bold`}
                        />
                        <span
                            className="pointer-events-none absolute inset-y-0 end-3.5 flex items-center font-display text-base font-bold text-gray-400"
                            aria-hidden="true"
                        >
                            ₪
                        </span>
                    </div>
                </div>

                <div className="flex w-28 flex-col items-end gap-0.5">
                    <span className="text-[12.5px] text-gray-500">بعد الدفعة</span>
                    <span
                        className={`whitespace-nowrap rounded-[10px] px-2.5 py-0.5 font-display text-[15px] font-bold ${BALANCE_CHIPS[after.tone]}`}
                    >
                        {balanceText(after)}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={`إزالة ${part.subscription.fullName}`}
                    className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-900"
                >
                    <Icon name="close" className="h-[18px] w-[18px]" />
                </button>
            </div>
            {error && <InputError message={error} />}
        </li>
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
        <div>
            <FieldLabel htmlFor="split_search" required hint="أي مشتركين تختارهم، ولو بهويات مختلفة">
                توزيع المبلغ على المشتركين
            </FieldLabel>

            {parts.length > 0 && (
                <ul className="mb-3 grid gap-2.5">
                    {parts.map((part, index) => (
                        <PartRow
                            key={part.subscription.id}
                            part={part}
                            onAmount={(amount) => setAmount(index, amount)}
                            onRemove={() => removePart(index)}
                            error={errors[`parts.${index}.amount`] ?? errors[`parts.${index}.subscription_id`]}
                        />
                    ))}
                </ul>
            )}

            <div className="flex flex-wrap items-start gap-3">
                <div className="relative min-w-0 flex-1 basis-72">
                    <Icon name="search" className="pointer-events-none absolute inset-y-0 start-4 my-auto h-[18px] w-[18px] text-gray-400" />
                    <input
                        id="split_search"
                        type="search"
                        aria-label="إضافة مشترك إلى هذه الدفعة"
                        autoComplete="off"
                        value={term}
                        onChange={(event) => setTerm(event.target.value)}
                        placeholder={parts.length === 0 ? 'ابحث عن مشترك بالاسم أو رقم الحساب أو الجوال…' : 'إضافة مشترك آخر إلى هذه الدفعة…'}
                        disabled={parts.length >= MAX_PARTS}
                        className={`${inputClass} ps-11`}
                    />
                    {found.searched && (
                        <ul className="animate-modal-panel absolute inset-x-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-gray-100 bg-surface p-1.5 shadow-lift">
                            {found.subscriptions.length === 0 && (
                                <li className="px-3 py-3 text-center text-sm text-gray-500">لا يوجد مشترك يطابق بحثك.</li>
                            )}
                            {found.subscriptions.map((subscription) => {
                                const added = parts.some((part) => part.subscription.id === subscription.id);

                                return (
                                    <li key={subscription.id}>
                                        <button
                                            type="button"
                                            disabled={added}
                                            onClick={() => addSubscription(subscription)}
                                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition hover:bg-gray-50 disabled:opacity-40"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <b className="block truncate text-[14.5px] text-gray-900">{subscription.fullName}</b>
                                                <small className="block text-xs font-medium text-gray-500">
                                                    <span dir="ltr" className="font-display">
                                                        {subscription.accountNumber}
                                                    </span>
                                                    {subscription.meterBoxNumber && ` · طبلون ${subscription.meterBoxNumber}`}
                                                </small>
                                            </span>
                                            <span
                                                className={`whitespace-nowrap rounded-[10px] px-2 py-0.5 font-display text-[13px] font-bold ${added ? 'bg-gray-100 text-gray-700' : BALANCE_CHIPS[describeBalance(subscription.balance).tone]}`}
                                            >
                                                {added ? 'مُضاف' : balanceText(describeBalance(subscription.balance))}
                                            </span>
                                        </button>
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
                    <SecondaryButton onClick={addIdentitySiblings} className="h-[50px]">
                        <Icon name="users" className="h-4 w-4" />
                        كل اشتراكات هذه الهوية
                    </SecondaryButton>
                )}
            </div>
            {identityNote && <p className="mt-2 text-[13.5px] text-gray-600">{identityNote}</p>}
            <InputError message={errors.parts} className="mt-2" />
        </div>
    );
}

/** The most subscriptions one transfer is divided between (the server's limit). */
export const MAX_PARTS = 20;

export const STATUS_DOTS = { active: 'bg-emerald-500', suspended: 'bg-amber-500', disconnected: 'bg-gray-400' };
