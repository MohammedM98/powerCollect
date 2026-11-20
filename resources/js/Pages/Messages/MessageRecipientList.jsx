import { Button } from '@heroui/react';
import Icon from '@/Components/Icon';
import InputError from '@/Components/InputError';
import { Card, FOCUS_RING } from './MessageFormParts';
import { CheckBox, PrimaryKey } from '@/Components/UI';

/** The recipients found: who has a phone, who is chosen, the stale-list warning and the message preview for each. */
export default function MessageRecipientList({
    allSelected,
    branchOptions,
    canSend,
    errors,
    isStale,
    maxRecipients,
    previewId,
    recipients,
    selected,
    sendBlocker,
    sending,
    setConfirming,
    setPreviewId,
    setSelected,
    toggle,
    withPhone,
}) {
    return (
        <Card
            icon="users"
            title="قائمة المستلمين"
            description={
                recipients === null ? 'لم تُعرض بعد.' : `${selected.size.toLocaleString('en')} محدد من ${recipients.length.toLocaleString('en')}`
            }
            actions={
                withPhone.length > 0 && (
                    <Button data-raw="" variant="ghost"
                        onClick={() => setSelected(new Set(allSelected ? [] : withPhone.map((recipient) => recipient.id)))}
                        className={`rounded text-xs font-semibold text-brand-600 hover:underline ${FOCUS_RING}`}
                    >
                        {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                    </Button>
                )
            }
        >
            <p className="sr-only" aria-live="polite">
                {recipients === null ? '' : `${selected.size} مشترك محدد من ${recipients.length}`}
            </p>
            {isStale && (
                <p
                    role="status"
                    className="mb-3 flex items-start gap-2 rounded-control bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300"
                >
                    <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                    تغيّرت الشروط — اضغط «تحديث المستلمين» قبل الإرسال.
                </p>
            )}
            {recipients !== null && recipients.length >= maxRecipients && (
                <p className="mb-3 text-sm text-amber-700">تُعرض أول {maxRecipients.toLocaleString('en')} مشترك فقط؛ ضيّق الشروط.</p>
            )}
            <InputError message={errors.subscription_ids} className="mb-3" />

            {recipients !== null && recipients.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-500">لا يوجد مشتركون يطابقون الشروط.</p>
            )}

            {recipients !== null && recipients.length > 0 && (
                <ul className="max-h-[560px] divide-y divide-gray-100 overflow-y-auto rounded-control border border-gray-100">
                    {recipients.map((recipient) => (
                        <li
                            key={recipient.id}
                            className={`flex items-center gap-3 px-3 py-2.5 text-sm ${previewId === recipient.id ? 'bg-brand-500/5' : ''}`}
                        >
                            <CheckBox
                                checked={selected.has(recipient.id)}
                                disabled={!recipient.phone}
                                onChange={() => toggle(recipient.id)}
                                aria-label={`إرسال إلى ${recipient.name}`}
                            />
                            <Button data-raw="" variant="ghost"
                                onClick={() => setPreviewId(recipient.id)}
                                aria-pressed={previewId === recipient.id}
                                aria-label={`معاينة رسالة ${recipient.name}`}
                                title="معاينة رسالته"
                                className={`group min-w-0 flex-1 rounded-lg text-start ${FOCUS_RING}`}
                            >
                                <span className="block truncate font-semibold text-gray-900">{recipient.name}</span>
                                <span className="block truncate text-xs text-gray-500">
                                    {recipient.accountNumber}
                                    {recipient.branchName && branchOptions.length > 0 && <> — {recipient.branchName}</>}
                                </span>
                            </Button>
                            {recipient.phone ? (
                                <span dir="ltr" className="shrink-0 text-xs text-gray-600">
                                    {recipient.phone}
                                </span>
                            ) : (
                                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-brand-600">
                                    <Icon name="warning" className="h-3.5 w-3.5" />
                                    لا يوجد رقم
                                </span>
                            )}
                            <Icon name="eye" className={`h-4 w-4 shrink-0 ${previewId === recipient.id ? 'text-brand-600' : 'text-gray-300'}`} />
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                {sendBlocker && (
                    <p id="send-blocker" className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Icon name="info" className="h-4 w-4 shrink-0" />
                        {sendBlocker}
                    </p>
                )}
                <PrimaryKey
                    type="button"
                    onClick={() => setConfirming(true)}
                    disabled={!canSend}
                    aria-busy={sending}
                    aria-describedby={sendBlocker ? 'send-blocker' : undefined}
                >
                    <Icon name="send" className="h-4 w-4" />
                    {sending ? 'جارٍ الإرسال...' : `إرسال إلى ${selected.size.toLocaleString('en')} مشترك`}
                </PrimaryKey>
            </div>
        </Card>
    );
}
