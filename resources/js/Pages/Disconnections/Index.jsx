import { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import { BranchFilterBanner, splitBranchFilter } from '@/Components/BranchBanner';
import RowIdentity from '@/Components/DataTable/RowIdentity';
import Pagination from '@/Components/DataTable/Pagination';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import { Button, FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import { AddKey, Figure, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, StatusPill } from '@/Components/UI';
import Modal from '@/Components/Modal';
import FormSelect from '@/Components/Form/FormSelect';
import Icon from '@/Components/Icon';
import { useDataTable } from '@/hooks/useDataTable';
import { formatMoney, formatNumber } from '@/lib/format';
import PageHeader from '@/Components/PageHeader';

/** A new list: its name and notes, and its branch for the Super Admin. */
function NewListModal({ branchOptions, onClose }) {
    const form = useForm({ title: '', notes: '', branch_id: '' });

    function submit(event) {
        event.preventDefault();
        form.post('/disconnection-lists', { onSuccess: onClose });
    }

    return (
        <Modal show onClose={onClose} maxWidth="lg">
            <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="new-list-title" className="gl-win">
                <div className="gl-win-head">
                    <span className="gl-set-ico" aria-hidden="true"><Icon name="power" /></span>
                    <div className="min-w-0">
                        <h2 id="new-list-title" className="gl-set-title">قائمة قطع جديدة</h2>
                        <p className="gl-set-desc">تُضاف إليها المشتركون يدويًا بعد إنشائها. لا يُقطع أي مشترك ولا تُرسل أي رسالة تلقائيًا.</p>
                    </div>
                </div>
                <div className="gl-win-body space-y-4">
                    <TextField isRequired isInvalid={Boolean(form.errors.title)} value={form.data.title} onChange={(value) => form.setData('title', value)} maxLength={150} className="gl-set-field" autoFocus>
                        <Label>اسم القائمة</Label>
                        <Input id="list-title" />
                        <FieldError>{form.errors.title}</FieldError>
                    </TextField>
                    {branchOptions.length > 0 && (
                        <FormSelect id="list-branch" label="الفرع" required value={form.data.branch_id} onChange={(value) => form.setData('branch_id', value)} options={branchOptions} placeholder="اختر الفرع" error={form.errors.branch_id} />
                    )}
                    <TextField isInvalid={Boolean(form.errors.notes)} value={form.data.notes} onChange={(value) => form.setData('notes', value)} className="gl-set-field">
                        <Label>ملاحظات</Label>
                        <TextArea id="list-notes" rows={3} />
                        <FieldError>{form.errors.notes}</FieldError>
                    </TextField>
                </div>
                <div className="gl-win-foot">
                    <Button type="button" onPress={onClose} className="gl-win-cancel">إلغاء</Button>
                    <Button type="submit" isDisabled={form.processing}>إنشاء القائمة</Button>
                </div>
            </form>
        </Modal>
    );
}

/** No lists yet: how a list works, in its three steps, and the key to start one. */
function DisconnectionEmptyState({ canCreate, onCreate }) {
    return (
        <div className="gl-empty-how">
            <span className="gl-set-ico" data-tone="owe" aria-hidden="true"><Icon name="power" /></span>
            <b>لا توجد قوائم قطع بعد</b>
            <p>أنشئ قائمة، وأدرج فيها المدينين، ثم أنذرهم وحدّد موعد القطع.</p>
            <ol>
                <li><b>1. أدرج المدينين</b><span>يدويًا أو من المرشحين حسب المبلغ</span></li>
                <li><b>2. أرسل الإنذار</b><span>رسالة بالموعد والمستحق</span></li>
                <li><b>3. أكّد القطع</b><span>وتُحمَّل رسوم القطع على المشترك</span></li>
            </ol>
            {canCreate && <Button onPress={onCreate}><Icon name="plus" className="h-4 w-4" />قائمة جديدة</Button>}
        </div>
    );
}

/**
 * The branch's disconnection lists: how many wait, how many are overdue,
 * and what was disconnected and charged. Each list opens to its subscribers.
 */
export default function Index({ lists, summary, canCreate, branchOptions, branchScope, filters, filterOptions }) {
    const [creating, setCreating] = useState(false);
    const { search, setSearch, sort, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable('/disconnection-lists', filters);
    // The Super Admin picks the branch in the banner above the figures, not among the filters; clearing those keeps it.
    const branchFilter = splitBranchFilter(branchScope, filterOptions, filterValues);

    return (
        <AuthenticatedLayout
            scope={branchScope?.name ?? null}
            header={
                <PageHeader title="قوائم القطع" info="قوائم يديرها كل فرع يدويًا: الإدراج والمواعيد والإنذارات وتأكيد القطع الفعلي." actions={canCreate && <AddKey onClick={() => setCreating(true)}>قائمة جديدة</AddKey>} />
            }
        >
            <Head title="قوائم القطع" />
            {branchScope && <BranchFilterBanner scope={branchScope} eyebrow="تعرض الآن قوائم القطع لـ" group={branchFilter.branch} value={filterValues.branch_id} onChange={(value) => setFilter('branch_id', value)} />}

            <div className="gl-rp-figs gl-sub-figs">
                <Figure dark label="بانتظار القطع" hint={`في ${formatNumber(summary.openLists)} قائمة مفتوحة`}>{formatNumber(summary.scheduled)} <span className="gl-rp-unit">مشترك</span></Figure>
                <Figure tone={summary.overdue > 0 ? 'owe' : null} label="متأخر، بانتظار إجراء" hint="مرّ موعده ولم يُتخذ إجراء؛ لا يُقطع تلقائيًا">{formatNumber(summary.overdue)}</Figure>
                <Figure tone="warn" label="خلال 7 أيام" hint={`إنذارات هذا الشهر: ${formatNumber(summary.warningsThisMonth)}`}>{formatNumber(summary.upcoming)}</Figure>
                <Figure tone="pay" label="قُطع هذا الشهر" hint={`رسوم القطع: ${formatMoney(summary.feesThisMonth)} ₪`}>{formatNumber(summary.disconnectedThisMonth)}</Figure>
            </div>

            <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="بحث باسم القائمة..."
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={lists.total}
                printable={false}
                filterMenu={
                    <DataTableFilterMenu tableKey="disconnection_lists" groups={branchFilter.groups} values={branchFilter.values} onChange={setFilter} onChangeMany={setFilters} onClear={() => branchFilter.clear(setFilters, clearFilters)} />
                }
            />

            <div className="data-table-container">
                <ListTable aria-label="قوائم القطع" sort={filters} onSort={sort}>
                    <ListHeader>
                        <ListColumn id="title" sortable isRowHeader>القائمة</ListColumn>
                        <ListColumn id="branch">الفرع</ListColumn>
                        <ListColumn id="scheduled">بانتظار القطع</ListColumn>
                        <ListColumn id="next_date">أقرب موعد</ListColumn>
                        <ListColumn id="disconnected">تم قطعهم</ListColumn>
                        <ListColumn id="fees">رسوم القطع</ListColumn>
                        <ListColumn id="created_at" sortable>أنشئت</ListColumn>
                        <ListColumn actions />
                    </ListHeader>
                    <ListBody
                        empty={search || Object.values(filterValues).some(Boolean) ? <p className="gl-rp-empty">لا توجد قوائم مطابقة للبحث والتصفية.</p> : <DisconnectionEmptyState canCreate={canCreate} onCreate={() => setCreating(true)} />}
                    >
                        {lists.data.map((list) => (
                            <ListRow key={list.id} id={list.id} onOpen={() => router.visit(`/disconnection-lists/${list.id}`)}>
                                <ListCell data-label="القائمة">
                                    <RowIdentity icon="power" name={<Link href={`/disconnection-lists/${list.id}`} className="hover:underline">{list.title}</Link>} subtitle={list.notes || `${formatNumber(list.itemsCount)} مشترك مدرج`} />
                                    {list.isClosed && <span className="mt-1 inline-block"><StatusPill tone="gray" label="مغلقة" /></span>}
                                </ListCell>
                                <ListCell data-label="الفرع" className="text-gray-600">{list.branchName}</ListCell>
                                <ListCell data-label="بانتظار القطع">
                                    <b className="font-display">{formatNumber(list.scheduledCount)}</b>
                                    {list.overdueCount > 0 && <span className="ms-2"><StatusPill tone="red" label={`${formatNumber(list.overdueCount)} متأخر`} /></span>}
                                </ListCell>
                                <ListCell data-label="أقرب موعد" className="whitespace-nowrap text-gray-600" dir="ltr">{list.nextDate ?? '—'}</ListCell>
                                <ListCell data-label="تم قطعهم" className="text-gray-600">{formatNumber(list.disconnectedCount)}</ListCell>
                                <ListCell data-label="رسوم القطع" className="whitespace-nowrap font-semibold text-gray-700">{formatMoney(list.feesTotal)} ₪</ListCell>
                                <ListCell data-label="أنشئت" className="whitespace-nowrap text-xs text-gray-500">
                                    {list.createdBy}
                                    <span className="block" dir="ltr">{list.createdAt.slice(0, 10)}</span>
                                </ListCell>
                                <ListCell data-actions="" className="text-end">
                                    <RowActionsMenu onView={() => router.visit(`/disconnection-lists/${list.id}`)} />
                                </ListCell>
                            </ListRow>
                        ))}
                    </ListBody>
                </ListTable>
            </div>

            <Pagination meta={lists} filters={filters} baseUrl="/disconnection-lists" />

            {creating && <NewListModal branchOptions={branchOptions} onClose={() => setCreating(false)} />}
        </AuthenticatedLayout>
    );
}
