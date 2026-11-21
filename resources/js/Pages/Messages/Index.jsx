import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import Pagination from '@/Components/DataTable/Pagination';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import { useDataTable } from '@/hooks/useDataTable';
import Icon from '@/Components/Icon';
import { formatNumber, timeAgo } from '@/lib/format';
import { openQuickMessage } from '@/lib/quickMessage';
import { ChannelLabel, DeliveryCounts, KindPill, MessageText } from './MessageParts';
import { Button } from '@heroui/react';
import { AddKey, Figure, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable } from '@/Components/UI';
import PageHeader from '@/Components/PageHeader';

/**
 * Every send of messages to subscriptions, newest first; a send opens to
 * its messages one by one.
 */
export default function Index({ batches, canSend, filters, filterOptions, monthSummary }) {

    function openBatch(batch) {
        router.visit(`/messages/${batch.id}`);
    }
    const { search, setSearch, sort, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable('/messages', filters);

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    title="الرسائل"
                    actions={
                        canSend && (
                            <>
                            <Button variant="secondary" onPress={() => openQuickMessage()} aria-keyshortcuts="M">
                                <Icon name="send" className="h-4 w-4" />
                                رسالة سريعة
                            </Button>
                            <AddKey href="/messages/create">رسالة جديدة</AddKey>
                            </>
                        )
                    }
                />
            }
        >
            <Head title="الرسائل" />

            {monthSummary && (
                <div className="gl-rp-figs gl-sub-figs">
                    <Figure dark label="رسائل هذا الشهر" hint={`في ${formatNumber(monthSummary.batches)} إرسال`}>{formatNumber(monthSummary.messages)}</Figure>
                    <Figure tone="pay" label="أُرسلت" hint={monthSummary.messages ? `${Math.round((monthSummary.sent / monthSummary.messages) * 100)}% من رسائل الشهر` : 'لا رسائل بعد'}>{formatNumber(monthSummary.sent)}</Figure>
                    <Figure tone="warn" label="بانتظار الإرسال" hint="تُرسل تباعًا">{formatNumber(monthSummary.pending)}</Figure>
                    <Figure tone={monthSummary.failed > 0 ? 'owe' : null} label="فشلت" hint="افتح الإرسال لمعرفة السبب وإعادته">{formatNumber(monthSummary.failed)}</Figure>
                </div>
            )}

            <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="بحث في نص الرسالة..."
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={batches.total}
                filterMenu={
                    <DataTableFilterMenu
                        tableKey="messages"
                        groups={filterOptions}
                        values={filterValues}
                        onChange={setFilter}
                        onChangeMany={setFilters}
                        onClear={clearFilters}
                    />
                }
            />

            <div className="data-table-container">
                <ListTable aria-label="الرسائل" sort={filters} onSort={sort}>
                    <ListHeader>
                        <ListColumn id="created_at" sortable>الوقت</ListColumn>
                        <ListColumn id="kind">النوع</ListColumn>
                        <ListColumn id="excerpt" isRowHeader>الرسالة</ListColumn>
                        <ListColumn id="channel">طريقة الإرسال</ListColumn>
                        <ListColumn id="branch">الفرع</ListColumn>
                        <ListColumn id="status">الحالة</ListColumn>
                        <ListColumn id="created_by">أرسلها</ListColumn>
                        <ListColumn actions />
                    </ListHeader>
                    <ListBody
                        empty={
                            search || Object.values(filterValues).some(Boolean) ? (
                                <p className="gl-rp-empty">لا توجد رسائل مطابقة للبحث والتصفية.</p>
                            ) : (
                                <div className="gl-empty-how">
                                    <span className="gl-set-ico" data-tone="clr" aria-hidden="true"><Icon name="send" /></span>
                                    <b>لم تُرسل رسائل بعد</b>
                                    <p>أرسل للمدينين تذكيرًا بأرصدتهم، أو قراءة الأسبوع لكل مشترك.</p>
                                    {canSend && <Button onPress={() => router.visit('/messages/create')}><Icon name="plus" className="h-4 w-4" />رسالة جديدة</Button>}
                                </div>
                            )
                        }
                    >
                        {batches.data.map((batch) => (
                            <ListRow key={batch.id} id={batch.id} onOpen={() => openBatch(batch)}>
                                <ListCell className="text-gray-600">
                                    <span title={new Date(batch.createdAt).toLocaleString('ar-EG-u-nu-latn')}>{timeAgo(batch.createdAt)}</span>
                                </ListCell>
                                <ListCell>
                                    <KindPill kind={batch.kind} label={batch.kindLabel} />
                                </ListCell>
                                <ListCell className="max-w-md whitespace-normal! text-gray-700">
                                    <MessageText text={batch.excerpt} />
                                </ListCell>
                                <ListCell>
                                    <ChannelLabel channel={batch.channel} label={batch.channelLabel} />
                                </ListCell>
                                <ListCell className="text-gray-600">{batch.branchName}</ListCell>
                                <ListCell>
                                    <DeliveryCounts batch={batch} />
                                </ListCell>
                                <ListCell className="text-gray-600">{batch.createdBy ?? '—'}</ListCell>
                                <ListCell className="text-end">
                                    <RowActionsMenu onView={() => openBatch(batch)} />
                                </ListCell>
                            </ListRow>
                        ))}
                    </ListBody>
                </ListTable>
            </div>

            <Pagination meta={batches} filters={filters} baseUrl="/messages" />
        </AuthenticatedLayout>
    );
}
