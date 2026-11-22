import { Button } from '@heroui/react';
import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Icon from '@/Components/UI/Icon';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import Pagination from '@/Components/DataTable/Pagination';
import { useDataTable } from '@/hooks/useDataTable';
import { ChannelLabel, DeliveryCounts, KIND_ICONS, MessageStatusPill, MessageText } from './MessageParts';
import PageHeader, { BackLink } from '@/Components/PageHeader';
import { ConfirmDialog, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, Notice, SecondaryKey } from '@/Components/UI';

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * One send: its wording, how many went out, and every subscription's own
 * message. A WhatsApp send is sent from here one message at a time — the
 * button opens WhatsApp with the text written and marks it sent. Failed
 * SMS can be sent again. An SMS the gateway did not confirm is settled one
 * at a time, once someone has checked: it arrived, or it is sent again.
 */
export default function Show({ batch, messages, canUpdate, filters, filterOptions }) {
    const baseUrl = `/messages/${batch.id}`;
    const { search, setSearch, setPerPage, filterValues, setFilter, clearFilters } = useDataTable(baseUrl, filters);
    const isWhatsApp = batch.channel === 'whatsapp';
    const settlesUnconfirmed = canUpdate && !isWhatsApp && (batch.unconfirmed ?? 0) > 0;
    const [settling, setSettling] = useState(null);

    function settle() {
        router.put(`${baseUrl}/messages/${settling.message.id}/unconfirmed`, { outcome: settling.outcome }, { preserveScroll: true, onFinish: () => setSettling(null) });
    }

    function openWhatsApp(message) {
        window.open(message.whatsAppLink, '_blank', 'noopener');

        if (canUpdate && message.status !== 'sent') {
            router.put(`${baseUrl}/messages/${message.id}/sent`, {}, { preserveScroll: true, preserveState: true });
        }
    }

    function retry() {
        router.post(`${baseUrl}/retry`, {}, { preserveScroll: true });
    }

    return (
        <AuthenticatedLayout
            header={
                <>
                    <PageHeader
                        eyebrow={<BackLink href="/messages">الرسائل</BackLink>}
                        title={<span className="inline-flex items-center gap-3"><Icon name={KIND_ICONS[batch.kind] ?? 'note'} className="h-7 w-7 shrink-0 text-(--ma-muted)" />{batch.kindLabel}</span>}
                        titleAddon={<span className="text-base font-semibold"><ChannelLabel channel={batch.channel} label={batch.channelLabel} /></span>}
                        meta={`${DATE_TIME_FORMAT.format(new Date(batch.createdAt))} — ${batch.createdBy ?? '—'} — ${batch.branchName}`}
                        actions={
                            canUpdate && !isWhatsApp && batch.failed > 0 && (
                                <SecondaryKey onClick={retry}>
                                    <Icon name="repeat" className="h-4 w-4" />
                                    إعادة إرسال ما فشل ({batch.failed})
                                </SecondaryKey>
                            )
                        }
                    />
                </>
            }
        >
            <Head title={`${batch.kindLabel} — الرسائل`} />

            <section className="mb-6 rounded-card border border-(--ma-line) bg-(--ma-solid) p-4 shadow-card">
                <div className="mb-2 text-sm font-semibold text-(--ma-ink)">نص الرسالة</div>
                <p className="whitespace-pre-line leading-7 text-(--ma-ink)">
                    <MessageText text={batch.body} />
                </p>
                <div className="mt-4 border-t border-(--ma-line) pt-3">
                    <DeliveryCounts batch={batch} />
                </div>
                {isWhatsApp && batch.pending > 0 && (
                    <Notice role="note" tone="warn" icon="info" className="mt-3">
                        اضغط «إرسال واتساب» بجانب كل مشترك ليفتح المحادثة والرسالة مكتوبة، ثم اضغط إرسال في واتساب. تُسجَّل الرسالة مرسلة عند فتحها.
                    </Notice>
                )}
            </section>

            <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="بحث بالهاتف أو النص..."
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={messages.total}
                filterMenu={
                    <DataTableFilterMenu
                        tableKey="subscription-messages"
                        groups={filterOptions}
                        values={filterValues}
                        onChange={setFilter}
                        onClear={clearFilters}
                    />
                }
            />

            <div className="data-table-container">
                <ListTable aria-label="رسائل الدفعة">
                    <ListHeader>
                        <ListColumn id="subscription" isRowHeader>المشترك</ListColumn>
                        <ListColumn id="phone">الهاتف</ListColumn>
                        <ListColumn id="body">الرسالة</ListColumn>
                        <ListColumn id="status">الحالة</ListColumn>
                        <ListColumn id="sent_at">وقت الإرسال</ListColumn>
                        {(isWhatsApp || settlesUnconfirmed) && <ListColumn actions />}
                    </ListHeader>
                    <ListBody empty={<span className="text-(--ma-muted)">لا توجد نتائج مطابقة.</span>}>
                        {messages.data.map((message) => (
                            <ListRow key={message.id} id={message.id}>
                                <ListCell>
                                    <div className="font-semibold text-(--ma-ink)">{message.subscriptionName ?? '—'}</div>
                                    {message.accountNumber && <div className="text-xs text-(--ma-muted)">{message.accountNumber}</div>}
                                </ListCell>
                                <ListCell dir="ltr" className="text-(--ma-ink)">
                                    {message.phone}
                                </ListCell>
                                <ListCell className="min-w-[260px] max-w-lg whitespace-normal! text-(--ma-ink)">{message.body}</ListCell>
                                <ListCell>
                                    <MessageStatusPill status={message.status} label={message.statusLabel} />
                                    {message.error && <div className="mt-1 max-w-xs text-xs text-(--ma-brand)">{message.error}</div>}
                                </ListCell>
                                <ListCell className="text-(--ma-muted)">
                                    {message.sentAt ? DATE_TIME_FORMAT.format(new Date(message.sentAt)) : '—'}
                                    {message.sentBy && <div className="text-xs text-(--ma-muted)">{message.sentBy}</div>}
                                </ListCell>
                                {settlesUnconfirmed && (
                                    <ListCell className="text-end">
                                        {message.status === 'unconfirmed' && (
                                            <span className="inline-flex gap-2">
                                                <SecondaryKey onClick={() => setSettling({ message, outcome: 'delivered' })} aria-label={`وصلت الرسالة إلى ${message.subscriptionName ?? message.phone}`}>
                                                    <Icon name="check" className="h-4 w-4" />
                                                    وصلت
                                                </SecondaryKey>
                                                <SecondaryKey onClick={() => setSettling({ message, outcome: 'resend' })} aria-label={`أعد إرسال الرسالة إلى ${message.subscriptionName ?? message.phone}`}>
                                                    <Icon name="repeat" className="h-4 w-4" />
                                                    لم تصل، أعد الإرسال
                                                </SecondaryKey>
                                            </span>
                                        )}
                                    </ListCell>
                                )}
                                {isWhatsApp && (
                                    <ListCell className="text-end">
                                        <Button data-raw="" variant="ghost"
                                            onClick={() => openWhatsApp(message)}
                                            aria-label={`${message.status === 'sent' ? 'فتح المحادثة مجددًا مع' : 'إرسال عبر واتساب إلى'} ${message.subscriptionName ?? message.phone}`}
                                            title={message.status === 'sent' ? 'أُرسلت — افتح المحادثة مجددًا' : 'افتح واتساب والرسالة مكتوبة'}
                                            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-control px-3 py-2 text-xs font-semibold transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ma-ink) ${
                                                message.status === 'sent'
                                                    ? 'border border-(--ma-line) text-(--ma-muted) hover:text-(--ma-ink)'
                                                    : 'bg-(--ma-pay-btn) text-white hover:brightness-110'
                                            }`}
                                        >
                                            <Icon name={message.status === 'sent' ? 'repeat' : 'chat'} className="h-3.5 w-3.5" />
                                            {message.status === 'sent' ? 'فتح مجددًا' : 'إرسال واتساب'}
                                        </Button>
                                    </ListCell>
                                )}
                            </ListRow>
                        ))}
                    </ListBody>
                </ListTable>
            </div>

            <Pagination meta={messages} filters={filters} baseUrl={baseUrl} />

            <ConfirmDialog
                show={settling !== null}
                onCancel={() => setSettling(null)}
                onConfirm={settle}
                tone={settling?.outcome === 'resend' ? 'warning' : 'primary'}
                icon={settling?.outcome === 'resend' ? 'repeat' : 'check'}
                title={settling?.outcome === 'resend' ? 'إعادة إرسال الرسالة؟' : 'تسجيل الرسالة واصلة؟'}
                message={settling?.outcome === 'resend'
                    ? 'تأكد أولًا أن الرسالة لم تصل إلى المشترك، وإلا وصلته مرتين.'
                    : 'سجّلها واصلة إذا تأكدت من المشترك أو من مزوّد الرسائل أنها وصلت.'}
                confirmLabel={settling?.outcome === 'resend' ? 'نعم، أعد الإرسال' : 'نعم، وصلت'}
            />
        </AuthenticatedLayout>
    );
}
