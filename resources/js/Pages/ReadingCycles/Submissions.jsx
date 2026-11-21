import { Button, Input } from '@heroui/react';
import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import Pagination from '@/Components/DataTable/Pagination';
import { useDataTable } from '@/hooks/useDataTable';
import PageHeader from '@/Components/PageHeader';
import { ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, StatusPill } from '@/Components/UI';

const TONES = { accepted: 'green', needs_review: 'amber', rejected: 'red' };

/**
 * The readings a cycle's field readers uploaded, with what became of each.
 * Those held for review — taken outside the reading day, after a box was
 * reassigned, or in conflict with a reading already there — are saved or
 * refused here by a supervisor.
 */
export default function Submissions({ cycle, submissions, canReview, filters, filterOptions }) {
    const { search, setSearch, sort, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable(`/reading-cycles/${cycle.id}/submissions`, filters);
    const [notes, setNotes] = useState({});

    function review(submission, decision) {
        router.post(`/reading-submissions/${submission.id}/review`, { decision, note: notes[submission.id] ?? '' }, { preserveScroll: true });
    }

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    eyebrow={<><Link href="/reading-cycles" className="hover:underline">توزيع القراءات</Link> / <Link href={`/reading-cycles/${cycle.id}`} className="hover:underline">{cycle.branchName}، {cycle.readingDate}</Link></>}
                    title="القراءات الميدانية"
                    info="كل قراءة رفعها التطبيق ومصيرها. المحفوظة للمراجعة لا تُحتسب حتى يقبلها مشرف."
                />
            }
        >
            <Head title="القراءات الميدانية" />

            <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                showSearch={false}
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={submissions.total}
                printable={false}
                filterMenu={<DataTableFilterMenu tableKey="reading_submissions" groups={filterOptions} values={filterValues} onChange={setFilter} onChangeMany={setFilters} onClear={clearFilters} />}
            />

            <div className="data-table-container">
                <ListTable aria-label="القراءات الميدانية" sort={filters} onSort={sort}>
                    <ListHeader>
                        <ListColumn id="name" isRowHeader>المشترك</ListColumn>
                        <ListColumn id="box">الطبلون</ListColumn>
                        <ListColumn id="reader">القارئ</ListColumn>
                        <ListColumn id="reading">القراءة</ListColumn>
                        <ListColumn id="captured_at" sortable>وقت التسجيل</ListColumn>
                        <ListColumn id="received_at" sortable>وقت الوصول</ListColumn>
                        <ListColumn id="status">الحالة</ListColumn>
                        {canReview && <ListColumn id="review">المراجعة</ListColumn>}
                    </ListHeader>
                    <ListBody empty={<span className="text-gray-500">لا توجد قراءات مرفوعة.</span>}>
                        {submissions.data.map((submission) => (
                            <ListRow key={submission.id} id={submission.id}>
                                <ListCell data-label="المشترك">
                                    <b className="text-gray-900">{submission.name}</b>
                                    <span className="block text-xs text-gray-500" dir="ltr">{submission.accountNumber}</span>
                                </ListCell>
                                <ListCell data-label="الطبلون" className="text-gray-600">{submission.boxLabel}</ListCell>
                                <ListCell data-label="القارئ" className="text-gray-600">{submission.readerName}</ListCell>
                                <ListCell data-label="القراءة" className="font-display font-semibold">{submission.currentReading}</ListCell>
                                <ListCell data-label="وقت التسجيل" className="whitespace-nowrap text-xs text-gray-600" dir="ltr">{submission.capturedAt}</ListCell>
                                <ListCell data-label="وقت الوصول" className="whitespace-nowrap text-xs text-gray-600" dir="ltr">{submission.receivedAt}</ListCell>
                                <ListCell data-label="الحالة">
                                    <StatusPill tone={TONES[submission.status]} label={submission.statusLabel} />
                                    {submission.issue && <span className="mt-1 block max-w-[16rem] text-xs text-gray-600">{submission.issue}</span>}
                                    {submission.reviewedBy && <span className="mt-1 block text-xs text-gray-500">راجعها {submission.reviewedBy}{submission.reviewNote ? `: ${submission.reviewNote}` : ''}</span>}
                                </ListCell>
                                {canReview && (
                                    <ListCell data-label="المراجعة">
                                        {submission.status === 'needs_review' ? (
                                            <div className="flex min-w-56 flex-col gap-2">
                                                <Input type="text" placeholder="ملاحظة (اختياري)" value={notes[submission.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [submission.id]: event.target.value }))} className="block w-full text-xs" />
                                                <div className="flex gap-2">
                                                    <Button data-raw="" variant="ghost" onClick={() => review(submission, 'accept')} className="rounded-control bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">قبول كقراءة الأسبوع</Button>
                                                    <Button data-raw="" variant="ghost" onClick={() => review(submission, 'reject')} className="rounded-control border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">رفض</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </ListCell>
                                )}
                            </ListRow>
                        ))}
                    </ListBody>
                </ListTable>
            </div>

            <Pagination meta={submissions} filters={filters} baseUrl={`/reading-cycles/${cycle.id}/submissions`} />
        </AuthenticatedLayout>
    );
}
