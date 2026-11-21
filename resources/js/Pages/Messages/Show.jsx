import { Button } from '@heroui/react';
import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Icon from '@/Components/Icon';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import Pagination from '@/Components/DataTable/Pagination';
import { useDataTable } from '@/hooks/useDataTable';
import { ChannelLabel, DeliveryCounts, KIND_ICONS, MessageStatusPill, MessageText } from './MessageParts';
import PageHeader, { BackLink } from '@/Components/PageHeader';
import { ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, SecondaryKey } from '@/Components/UI';

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * One send: its wording, how many went out, and every subscription's own
 * message. A WhatsApp send is sent from here one message at a time — the
 * button opens WhatsApp with the text written and marks it sent. Failed
 * SMS can be sent again.
 */
export default function Show({ batch, messages, canUpdate, filters, filterOptions }) {
    const baseUrl = `/messages/${batch.id}`;
    const { search, setSearch, setPerPage, filterValues, setFilter, clearFilters } = useDataTable(baseUrl, filters);
    const isWhatsApp = batch.channel === 'whatsapp';

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
                        title={<span className="inline-flex items-center gap-3"><Icon name={KIND_ICONS[batch.kind] ?? 'note'} className="h-7 w-7 shrink-0 text-gray-500" />{batch.kindLabel}</span>}
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

            <section className="mb-6 rounded-card border border-gray-100 bg-surface p-5 shadow-card">
                <div className="mb-2 text-sm font-semibold text-gray-700">نص الرسالة</div>
                <p className="whitespace-pre-line leading-7 text-gray-900">
                    <MessageText text={batch.body} />
                </p>
                <div className="mt-4 border-t border-gray-100 pt-3">
                    <DeliveryCounts batch={batch} />
                </div>
                {isWhatsApp && batch.pending > 0 && (
                    <p role="note" className="mt-3 flex items-start gap-2 rounded-control bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                        <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
                        اضغط «إرسال واتساب» بجانب كل مشترك ليفتح المحادثة والرسالة مكتوبة، ثم اضغط إرسال في واتساب. تُسجَّل الرسالة مرسلة عند فتحها.
                    </p>
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
                        {isWhatsApp && <ListColumn actions />}
                    </ListHeader>
                    <ListBody empty={<span className="text-gray-500">لا توجد نتائج مطابقة.</span>}>
                        {messages.data.map((message) => (
                            <ListRow key={message.id} id={message.id}>
                                <ListCell>
                                    <div className="font-semibold text-gray-900">{message.subscriptionName ?? '—'}</div>
                                    {message.accountNumber && <div className="text-xs text-gray-500">{message.accountNumber}</div>}
                                </ListCell>
                                <ListCell dir="ltr" className="text-gray-700">
                                    {message.phone}
                                </ListCell>
                                <ListCell className="min-w-[260px] max-w-lg whitespace-normal! text-gray-700">{message.body}</ListCell>
                                <ListCell>
                                    <MessageStatusPill status={message.status} label={message.statusLabel} />
                                    {message.error && <div className="mt-1 max-w-xs text-xs text-brand-600">{message.error}</div>}
                                </ListCell>
                                <ListCell className="text-gray-600">
                                    {message.sentAt ? DATE_TIME_FORMAT.format(new Date(message.sentAt)) : '—'}
                                    {message.sentBy && <div className="text-xs text-gray-500">{message.sentBy}</div>}
                                </ListCell>
                                {isWhatsApp && (
                                    <ListCell className="text-end">
                                        <Button data-raw="" variant="ghost"
                                            onClick={() => openWhatsApp(message)}
                                            aria-label={`${message.status === 'sent' ? 'فتح المحادثة مجددًا مع' : 'إرسال عبر واتساب إلى'} ${message.subscriptionName ?? message.phone}`}
                                            title={message.status === 'sent' ? 'أُرسلت — افتح المحادثة مجددًا' : 'افتح واتساب والرسالة مكتوبة'}
                                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-control px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 ${
                                                message.status === 'sent'
                                                    ? 'border border-gray-200 text-gray-600 hover:text-gray-900'
                                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
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
        </AuthenticatedLayout>
    );
}
