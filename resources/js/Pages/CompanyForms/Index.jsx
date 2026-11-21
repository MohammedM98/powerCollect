import { Button } from '@heroui/react';
import { useEffect, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Icon from '@/Components/Icon';
import ChoiceChips from '@/Components/ChoiceChips';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import Pagination from '@/Components/DataTable/Pagination';
import IssueModal from './IssueModal';
import { timeAgo } from '@/lib/format';
import PageHeader from '@/Components/PageHeader';
import { AddKey, ConfirmDialog, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, SecondaryKey, StatusPill, secondaryButtonClass } from '@/Components/UI';

const MODES = { blank: 'نموذج فارغ', filled: 'نسخة معبأة', archive: 'طلب ورقي مؤرشف' };

export default function Index({ templates, documents, filters, canManage, canIssue }) {
    const [search, setSearch] = useState(filters.search);
    const [issuing, setIssuing] = useState(null);
    const [archiving, setArchiving] = useState(null);
    const history = filters.view === 'documents';
    useEffect(() => setSearch(filters.search), [filters.search]);
    useEffect(() => {
        if (search === filters.search) return undefined;
        const timer = setTimeout(() => router.get('/company-forms', { search, view: filters.view, per_page: filters.per_page }, { preserveState: true, preserveScroll: true, replace: true }), 300);
        return () => clearTimeout(timer);
    }, [search, filters.search, filters.view, filters.per_page]);
    function visit(changes) { router.get('/company-forms', { ...filters, search, ...changes }, { preserveState: true, preserveScroll: true, replace: true }); }

    return <AuthenticatedLayout header={<PageHeader title="نماذج الشركة" info="نماذج جاهزة للطباعة، فارغة أو معبأة، مع أرشيف النسخ والطلبات الورقية." actions={<>{canIssue && <SecondaryKey onClick={() => setIssuing({ mode: 'archive' })}><Icon name="history" className="h-4 w-4" />أرشفة طلب ورقي</SecondaryKey>}{canManage && <AddKey href="/company-forms/create">نموذج جديد أو مستورد</AddKey>}</>} />}>
        <Head title="نماذج الشركة" />
        <div className="mb-6"><ChoiceChips label="أقسام نماذج الشركة" options={[{ value: 'templates', label: 'مكتبة النماذج', icon: 'document' }, { value: 'documents', label: 'النسخ الصادرة والأرشيف', icon: 'history' }]} value={filters.view} onChange={(view) => visit({ view })} /></div>
        <DataTableToolbar search={search} onSearchChange={setSearch} placeholder={history ? 'بحث بعنوان المستند أو رقم الطلب الورقي…' : 'بحث باسم النموذج أو تصنيفه…'} perPage={filters.per_page} onPerPageChange={(per_page) => visit({ per_page })} total={history ? documents.total : templates.total} printable={false} />
        {history ? <>
            <div className="data-table-container"><ListTable aria-label="النسخ الصادرة والأرشيف" className="data-table w-full text-start text-sm"><ListHeader><ListColumn id="title" isRowHeader>المستند</ListColumn><ListColumn id="mode">نوع النسخة</ListColumn><ListColumn id="subscription">الاشتراك</ListColumn><ListColumn id="paper">الطلب الورقي</ListColumn><ListColumn id="created_by">أصدره</ListColumn><ListColumn id="created_at">التاريخ</ListColumn><ListColumn id="view">عرض</ListColumn></ListHeader><ListBody empty={<div className="text-center text-gray-500">لا توجد مستندات مطابقة.</div>}>{documents.data.map((document) => <ListRow key={document.id} id={document.id}><ListCell><b className="text-gray-900">{document.title}</b><span className="mt-1 block font-display text-xs text-gray-500">#{document.id}</span></ListCell><ListCell><StatusPill tone={document.mode === 'archive' ? 'amber' : 'gray'} label={MODES[document.mode]} /></ListCell><ListCell>{document.subscriptionName ?? '—'}</ListCell><ListCell><bdi>{document.paperReference ?? '—'}</bdi>{document.paperDate && <span className="mt-1 block text-xs text-gray-500">{document.paperDate}</span>}</ListCell><ListCell>{document.createdBy ?? '—'}</ListCell><ListCell className="text-gray-500">{timeAgo(document.createdAt)}</ListCell><ListCell><Link href={`/company-documents/${document.id}`} className={secondaryButtonClass}><Icon name="eye" className="h-4 w-4" />عرض وطباعة</Link></ListCell></ListRow>)}</ListBody></ListTable></div>
            <Pagination meta={documents} filters={filters} baseUrl="/company-forms" pageParam="documents_page" />
        </> : <>
            <div className="rounded-b-panel border border-t-0 border-gray-100 bg-gray-50 p-4">
                {templates.data.length === 0 ? <div className="rounded-card border border-gray-100 bg-surface p-8 text-center"><Icon name="document" className="mx-auto mb-3 h-10 w-10 text-gray-400" /><p className="text-base text-gray-700">{search ? 'لا توجد نماذج مطابقة.' : 'ابدأ بنموذج طلب اشتراك، أو استورد النموذج المعتمد لدى الشركة.'}</p>{canManage && <div className="mt-6"><AddKey href="/company-forms/create">إنشاء أول نموذج</AddKey></div>}</div> : <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">{templates.data.map((template) => <article key={template.id} className="flex min-w-0 flex-col rounded-card border border-gray-100 bg-surface p-4 shadow-card"><div className="mb-4 flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600"><Icon name={template.imported ? 'layers' : 'document'} /></span><StatusPill tone="gray" label={template.imported ? 'نموذج مستورد' : 'نموذج مصمم'} /></div><p className="text-xs text-gray-500">{template.category}</p><h2 className="mt-1 font-sans text-lg font-bold text-gray-900">{template.name}</h2><p className="mt-2 text-xs text-gray-500">الإصدار {template.version}، {template.updatedBy ?? 'الشركة'}</p>{template.sourceName && <p className="mt-1 truncate text-xs text-gray-500" title={template.sourceName}>{template.sourceName}</p>}<div className="mt-6 flex flex-1 flex-wrap content-end items-end gap-2">{canIssue && <><SecondaryKey onClick={() => setIssuing({ templateId: template.id, mode: 'blank' })}><Icon name="printer" className="h-4 w-4" />طباعة فارغة</SecondaryKey><SecondaryKey onClick={() => setIssuing({ templateId: template.id, mode: 'filled' })}><Icon name="user" className="h-4 w-4" />تعبئة وطباعة</SecondaryKey></>}{canManage && <><Link href={`/company-forms/${template.id}/edit`} className="inline-flex items-center gap-2 rounded-control px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-500/10"><Icon name="pencil" className="h-4 w-4" />تخصيص</Link><Button data-raw="" variant="ghost" onClick={() => setArchiving(template)} className="rounded-control p-2 text-gray-400 hover:bg-brand-500/5 hover:text-brand-600" aria-label={`إخفاء ${template.name} من المكتبة`}><Icon name="history" className="h-4 w-4" /></Button></>}</div></article>)}</div>}
            </div>
            <Pagination meta={templates} filters={filters} baseUrl="/company-forms" pageParam="templates_page" />
        </>}
        {issuing && <IssueModal {...issuing} onClose={() => setIssuing(null)} />}
        <ConfirmDialog show={Boolean(archiving)} title="إخفاء النموذج من المكتبة؟" message="يبقى أرشيف النسخ الصادرة والملفات الأصلية محفوظًا. يتوقف النموذج عن الظهور ضمن خيارات الإصدار الجديدة." confirmLabel="إخفاء النموذج" icon="history" onCancel={() => setArchiving(null)} onConfirm={() => router.delete(`/company-forms/${archiving.id}`, { preserveScroll: true, onSuccess: () => setArchiving(null) })} />
    </AuthenticatedLayout>;
}
