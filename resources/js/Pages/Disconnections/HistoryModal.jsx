import DialogFrame from '@/Components/UI/DialogFrame';
import Icon from '@/Components/UI/Icon';
import { balanceInText } from '@/lib/balance';
import { formatMoney, formatDate } from '@/lib/format';
import { Notice, StatusPill } from '@/Components/UI';

const EVENT_ICONS = { added: 'plus', extended: 'calendar', warned: 'send', removed: 'undo', disconnected: 'power' };

/** What changed in one step, in a line. */
function eventDetails(event, reasonLabels) {
    const before = event.old ?? {};
    const after = event.new ?? {};

    switch (event.type) {
        case 'added':
            return [`السبب: ${reasonLabels[after.reason] ?? after.reason}`, `الموعد: ${formatDate(after.scheduled_for)}`, `الرصيد عند الإدراج: ${balanceInText(after.balance)}`, after.note && `ملاحظة: ${after.note}`].filter(Boolean).join('، ');
        case 'extended':
            return `من ${formatDate(before.scheduled_for)} إلى ${formatDate(after.scheduled_for)}`;
        case 'warned':
            return after.channel === 'whatsapp' ? 'عبر واتساب' : 'رسالة SMS';
        case 'disconnected':
            return `رسوم القطع: ${formatMoney(after.fee)} ₪، الخدمة: مفصول`;
        default:
            return '';
    }
}

/**
 * Everything that happened to one subscriber on the list, oldest first:
 * who did it and when, and what changed. The history is never edited.
 */
export default function HistoryModal({ history, loading, reasonOptions, onClose }) {
    const reasonLabels = Object.fromEntries(reasonOptions.map((option) => [option.value, option.label]));

    return (
        <DialogFrame
            show
            onClose={onClose}
            title="سجل المشترك في القائمة"
            description={history && <>{history.name} <bdi dir="ltr" className="font-display">{history.accountNumber}</bdi></>}
            icon="history"
            tone="blue"
            maxWidth="2xl"
        >
            {loading || !history ? (
                <p className="py-8 text-center text-sm text-(--ma-muted)">جارٍ التحميل…</p>
            ) : (
                <ol className="relative space-y-6 border-s border-(--ma-line) ps-6">
                    {history.events.map((event) => (
                        <li key={event.id} className="relative">
                            <span className="absolute inset-s-[-35px] flex h-7 w-7 items-center justify-center rounded-full bg-(--ma-tile) text-(--ma-muted) shadow-(--ma-hl)">
                                <Icon name={EVENT_ICONS[event.type] ?? 'history'} className="h-3.5 w-3.5" />
                            </span>
                            <p className="font-semibold text-(--ma-ink)">{event.typeLabel}</p>
                            <p className="text-xs text-(--ma-muted)">
                                {event.userName}، <bdi dir="ltr">{event.at}</bdi>
                            </p>
                            {eventDetails(event, reasonLabels) && <p className="mt-1 text-sm text-(--ma-ink)">{eventDetails(event, reasonLabels)}</p>}
                            {event.reason && <p className="mt-1 text-sm text-(--ma-muted)">السبب: {event.reason}</p>}
                            {event.message && (
                                <Notice icon="send" className="mt-2">
                                    <p className="whitespace-pre-line">{event.message.body}</p>
                                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-(--ma-muted)">
                                        <bdi dir="ltr">{event.message.phone}</bdi>
                                        <StatusPill tone={event.message.status === 'sent' ? 'green' : event.message.status === 'failed' ? 'red' : 'amber'} label={event.message.statusLabel} />
                                        {event.message.error && <span>{event.message.error}</span>}
                                    </p>
                                </Notice>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </DialogFrame>
    );
}
