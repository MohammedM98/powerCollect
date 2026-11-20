import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import SortableTh from '@/Components/DataTable/SortableTh';
import Pagination from '@/Components/DataTable/Pagination';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import ActionsTh from '@/Components/DataTable/ActionsTh';
import { useDataTable } from '@/hooks/useDataTable';
import { useRowClick } from '@/hooks/useRowClick';
import Icon from '@/Components/Icon';
import { formatNumber, timeAgo } from '@/lib/format';
import { openQuickMessage } from '@/lib/quickMessage';
import { ChannelLabel, DeliveryCounts, KindPill, MessageText } from './MessageParts';
import { Button } from '@heroui/react';
import { AddKey, Figure } from '@/Components/UI';
import PageHeader from '@/Components/PageHeader';

/**
 * Every send of messages to subscriptions, newest first; a send opens to
 * its messages one by one.
 */
export default function Index({ batches, canSend, filters, filterOptions, monthSummary }) {
    const rowClick = useRowClick();

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
                <table className="data-table w-full text-sm text-start">
                    <thead>
                        <tr>
                            <SortableTh column="created_at" label="الوقت" sortState={filters} onSort={sort} />
                            <th>النوع</th>
                            <th>الرسالة</th>
                            <th>طريقة الإرسال</th>
                            <th>الفرع</th>
                            <th>الحالة</th>
                            <th>أرسلها</th>
                            <ActionsTh />
                        </tr>
                    </thead>
                    <tbody>
                        {batches.data.length === 0 ? (
                            <tr>
                                <td colSpan={8}>
                                    {search || Object.values(filterValues).some(Boolean) ? (
                                        <p className="gl-rp-empty">لا توجد رسائل مطابقة للبحث والتصفية.</p>
                                    ) : (
                                        <div className="gl-empty-how">
                                            <span className="gl-set-ico" data-tone="clr" aria-hidden="true"><Icon name="send" /></span>
                                            <b>لم تُرسل رسائل بعد</b>
                                            <p>أرسل للمدينين تذكيرًا بأرصدتهم، أو قراءة الأسبوع لكل مشترك.</p>
                                            {canSend && <Button onPress={() => router.visit('/messages/create')}><Icon name="plus" className="h-4 w-4" />رسالة جديدة</Button>}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            batches.data.map((batch) => (
                                <tr key={batch.id} {...rowClick(() => openBatch(batch))}>
                                    <td className="text-gray-600" title={new Date(batch.createdAt).toLocaleString('ar-EG-u-nu-latn')}>
                                        {timeAgo(batch.createdAt)}
                                    </td>
                                    <td>
                                        <KindPill kind={batch.kind} label={batch.kindLabel} />
                                    </td>
                                    <td className="max-w-md whitespace-normal! text-gray-700">
                                        <MessageText text={batch.excerpt} />
                                    </td>
                                    <td>
                                        <ChannelLabel channel={batch.channel} label={batch.channelLabel} />
                                    </td>
                                    <td className="text-gray-600">{batch.branchName}</td>
                                    <td>
                                        <DeliveryCounts batch={batch} />
                                    </td>
                                    <td className="text-gray-600">{batch.createdBy ?? '—'}</td>
                                    <td className="text-end">
                                        <RowActionsMenu onView={() => openBatch(batch)} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination meta={batches} filters={filters} baseUrl="/messages" />
        </AuthenticatedLayout>
    );
}
