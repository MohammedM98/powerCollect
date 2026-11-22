import { useEffect, useId, useRef, useState } from 'react';
import { useHttp } from '@inertiajs/react';
import DialogFrame from '@/Components/UI/DialogFrame';
import FormField from '@/Components/Form/FormField';
import Icon from '@/Components/UI/Icon';
import Pagination from '@/Components/DataTable/Pagination';
import { ChannelLabel, KindPill, MessageStatusPill } from './MessageParts';
import { Notice, SearchableSelect, SecondaryKey } from '@/Components/UI';

const DATE_TIME = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
const dateTime = (value) => value ? DATE_TIME.format(new Date(value)) : '—';

export default function SubscriptionMessageHistoryModal({ subscription, onClose }) {
    const titleId = useId();
    const [kind, setKind] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState(null);
    const http = useHttp();
    const httpRef = useRef(http);
    httpRef.current = http;
    const requestKey = JSON.stringify([subscription.id, kind, status, page, attempt]);
    const current = result?.key === requestKey ? result : null;
    const messages = current?.data?.messages;

    useEffect(() => {
        let active = true;
        const client = httpRef.current;
        const query = new URLSearchParams({ page, ...(kind ? { kind } : {}), ...(status ? { status } : {}) });
        client.get(`/subscriptions/${subscription.id}/messages?${query}`)
            .then((data) => { if (active) setResult({ key: requestKey, data }); })
            .catch(() => { if (active) setResult({ key: requestKey, error: 'تعذّر تحميل سجل الرسائل. حاول مرة أخرى.' }); });
        return () => { active = false; client.cancel(); };
    }, [requestKey, subscription.id, kind, status, page]);

    const footer = (
        <>
            <p role="status" className="me-auto text-sm text-(--ma-muted)">{messages ? <><bdi dir="ltr">{messages.total.toLocaleString('en')}</bdi> رسالة{kind || status ? ' مطابقة' : ' مسجلة'}</> : 'سجل الرسائل للاشتراك المختار'}</p>
            <SecondaryKey onClick={onClose}>إغلاق</SecondaryKey>
        </>
    );

    return (
        <DialogFrame
            show
            onClose={onClose}
            title="سجل رسائل المشترك"
            description={<>{subscription.display_name ?? subscription.fullName}، الاشتراك <bdi dir="ltr">{subscription.account_number ?? subscription.accountNumber}</bdi></>}
            icon="messages"
            maxWidth="5xl"
            footer={footer}
        >
            <div className="space-y-4" aria-busy={!current}>
                <div className="relative z-10 grid gap-4 sm:grid-cols-2">
                    <FormField id={`${titleId}-kind`} label="نوع الرسالة">
                        <SearchableSelect value={kind} onChange={(value) => { setKind(value); setPage(1); }} options={result?.data?.kinds ?? []} placeholder="كل الأنواع" searchable={false} />
                    </FormField>
                    <FormField id={`${titleId}-status`} label="حالة الإرسال">
                        <SearchableSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={result?.data?.statuses ?? []} placeholder="كل الحالات" searchable={false} />
                    </FormField>
                </div>

                {!current ? (
                    <div role="status" aria-label="جارٍ تحميل سجل الرسائل" className="animate-pulse space-y-3">{[1, 2, 3].map((row) => <div key={row} className="h-36 rounded-[18px] bg-(--ma-tile)" />)}</div>
                ) : current.error ? (
                    <div role="alert" className="rounded-[18px] bg-(--ma-tile) p-6 text-center shadow-(--ma-hl)"><p className="mb-4 text-base text-(--ma-ink)">{current.error}</p><SecondaryKey onClick={() => setAttempt((value) => value + 1)}>إعادة المحاولة</SecondaryKey></div>
                ) : messages.data.length === 0 ? (
                    <div className="rounded-[18px] bg-(--ma-tile) px-4 py-8 text-center shadow-(--ma-hl)"><Icon name="messages" className="mx-auto mb-3 h-8 w-8 text-(--ma-faint)" /><p className="text-base text-(--ma-ink)">{kind || status ? 'لا توجد رسائل مطابقة للتصفية.' : 'لا توجد رسائل مسجلة لهذا الاشتراك بعد.'}</p></div>
                ) : (
                    <div className="space-y-4">
                        {messages.data.map((message) => (
                            <article key={message.id} aria-label={`رسالة ${message.kindLabel}`} className="rounded-[18px] bg-(--ma-tile) p-4 shadow-(--ma-hl)">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--ma-line) pb-3">
                                    <div className="flex flex-wrap items-center gap-3"><KindPill kind={message.kind} label={message.kindLabel} /><ChannelLabel channel={message.channel} label={message.channelLabel} /></div>
                                    <MessageStatusPill status={message.status} label={message.statusLabel} />
                                </div>
                                <p className="whitespace-pre-wrap wrap-break-word py-4 text-base leading-8 text-(--ma-ink)">{message.body}</p>
                                <dl className="grid gap-x-6 gap-y-3 border-t border-(--ma-line) pt-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                    <div><dt className="text-(--ma-muted)">رقم المستلم وقت الإرسال</dt><dd className="mt-1 font-semibold text-(--ma-ink)"><bdi dir="ltr">{message.phone}</bdi></dd></div>
                                    <div><dt className="text-(--ma-muted)">تاريخ التسجيل</dt><dd className="mt-1 text-(--ma-ink)">{dateTime(message.createdAt)}</dd></div>
                                    <div><dt className="text-(--ma-muted)">سجّلها</dt><dd className="mt-1 text-(--ma-ink)">{message.createdBy ?? '—'}</dd></div>
                                    {message.sentAt && <div><dt className="text-(--ma-muted)">تاريخ الإرسال المسجّل</dt><dd className="mt-1 text-(--ma-ink)">{dateTime(message.sentAt)}</dd></div>}
                                    {message.sentBy && <div><dt className="text-(--ma-muted)">أرسلها</dt><dd className="mt-1 text-(--ma-ink)">{message.sentBy}</dd></div>}
                                </dl>
                                {message.error && <Notice tone="danger" className="mt-4">سبب فشل الإرسال: {message.error}</Notice>}
                            </article>
                        ))}
                        <Pagination meta={messages} onPageChange={setPage} />
                    </div>
                )}
            </div>
        </DialogFrame>
    );
}
