import { Button } from '@heroui/react';
import { useState } from 'react';
import { Head } from '@inertiajs/react';
import SettingsLayout from '@/Layouts/SettingsLayout';
import DataTableToolbar from '@/Components/DataTable/DataTableToolbar';
import DataTableFilterMenu from '@/Components/DataTable/DataTableFilterMenu';
import RowActionsMenu from '@/Components/DataTable/RowActionsMenu';
import RowIdentity from '@/Components/DataTable/RowIdentity';
import Pagination from '@/Components/DataTable/Pagination';
import { useDataTable } from '@/hooks/useDataTable';
import { useDeleteRecord } from '@/hooks/useDeleteRecord';
import BranchModal from './BranchModal';
import DomainModal from './DomainModal';
import PageHeader from '@/Components/PageHeader';
import { AddKey, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, StatusPill } from '@/Components/UI';

export default function Index({ branches, canCreate, filters, filterOptions, governorates, areas, canManageDomains = false, domainRoutingEnabled = false }) {
    const [domainBranch, setDomainBranch] = useState(null);
    const [modalBranch, setModalBranch] = useState(null);
    const [creating, setCreating] = useState(false);
    const { requestDelete, deleteDialog } = useDeleteRecord('الفرع');
    const { search, setSearch, sort, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable('/branches', filters);

    return (
        <SettingsLayout
            header={
                <PageHeader title="الفروع" actions={canCreate && <AddKey onClick={() => setCreating(true)}>فرع جديد</AddKey>} />
            }
        >
            <Head title="الفروع" />
            {canManageDomains && !domainRoutingEnabled && <p className="mb-5 rounded-control border border-gray-200 bg-surface p-4 text-sm leading-7 text-gray-600">يمكنك تجهيز روابط الفروع هنا. تشغيلها يحتاج ربط DNS وHTTPS بالاستضافة وتفعيل توجيه الدومينات عند النشر.</p>}

            <DataTableToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="بحث بالاسم أو الهاتف..."
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={branches.total}
                filterMenu={
                    <DataTableFilterMenu
                        tableKey="branches"
                        groups={filterOptions}
                        values={filterValues}
                        onChange={setFilter}
                        onChangeMany={setFilters}
                        onClear={clearFilters}
                    />
                }
            />

            <div className="data-table-container">
                <ListTable aria-label="الفروع" sort={filters} onSort={sort}>
                    <ListHeader>
                        <ListColumn id="name" sortable isRowHeader>الاسم</ListColumn>
                        <ListColumn id="phone" sortable>الهاتف</ListColumn>
                        <ListColumn id="governorate">المحافظة</ListColumn>
                        <ListColumn id="area">المنطقة</ListColumn>
                        <ListColumn id="domain">رابط الفرع</ListColumn>
                        <ListColumn id="is_active" sortable>الحالة</ListColumn>
                        <ListColumn actions />
                    </ListHeader>
                    <ListBody empty={<span className="text-gray-500">لا توجد نتائج مطابقة.</span>}>
                        {branches.data.map((branch) => (
                            <ListRow key={branch.id} id={branch.id} onOpen={branch.canUpdate ? () => setModalBranch(branch) : null}>
                                <ListCell>
                                    <RowIdentity
                                        icon="pin"
                                        name={branch.name}
                                        subtitle={branch.governorate?.name}
                                        status={branch.is_active ? 'green' : 'gray'}
                                    />
                                </ListCell>
                                <ListCell className="text-gray-600" dir="ltr">
                                    {branch.phone}
                                </ListCell>
                                <ListCell className="text-gray-600">{branch.governorate?.name ?? '—'}</ListCell>
                                <ListCell className="text-gray-600">{branch.area?.name ?? '—'}</ListCell>
                                <ListCell onClick={(e) => e.stopPropagation()}><div className="space-y-2">
                                    {branch.domain ? <><p dir="ltr" className="text-start text-xs text-gray-600">{branch.domain}</p><StatusPill tone={branch.domain_enabled ? 'green' : 'gray'} label={branch.domain_enabled ? 'الرابط مفعّل' : 'الرابط متوقف'} /></> : <p className="text-gray-400">لم يُحدد رابط</p>}
                                    <div className="flex flex-wrap gap-3 text-xs font-semibold">{canManageDomains && <Button data-raw="" variant="ghost" onClick={() => setDomainBranch(branch)} className="text-brand-600 hover:underline">إدارة الرابط</Button>}{domainRoutingEnabled && branch.url && <a href={branch.url} className="text-gray-700 hover:underline">فتح الفرع</a>}</div>
                                </div></ListCell>
                                <ListCell>
                                    <StatusPill tone={branch.is_active ? 'green' : 'gray'} label={branch.is_active ? 'نشط' : 'متوقف'} />
                                </ListCell>
                                <ListCell className="text-end">
                                    {(branch.canUpdate || branch.canDelete) && (
                                        <RowActionsMenu>
                                            {branch.canDelete && (
                                                <Button data-raw="" variant="ghost" type="submit" onClick={() => requestDelete(`/branches/${branch.id}`, branch.name)}>حذف</Button>
                                            )}
                                            {branch.canUpdate && <Button data-raw="" variant="ghost" type="submit" onClick={() => setModalBranch(branch)}>تعديل</Button>}
                                        </RowActionsMenu>
                                    )}
                                </ListCell>
                            </ListRow>
                        ))}
                    </ListBody>
                </ListTable>
            </div>

            <Pagination meta={branches} filters={filters} baseUrl="/branches" />
            {domainBranch && <DomainModal key={domainBranch.id} branch={domainBranch} onClose={() => setDomainBranch(null)} routingEnabled={domainRoutingEnabled} />}

            <BranchModal show={creating} onClose={() => setCreating(false)} branch={null} governorates={governorates} areas={areas} />

            {/* Keyed by branch id so switching who's being edited remounts
                the form with fresh initial values — useForm() only captures
                its initial data once, it won't pick up a changed `branch`
                prop on an already-mounted instance. */}
            {modalBranch && (
                <BranchModal
                    key={modalBranch.id}
                    show
                    onClose={() => setModalBranch(null)}
                    branch={modalBranch}
                    governorates={governorates}
                    areas={areas}
                />
            )}

            {deleteDialog}
        </SettingsLayout>
    );
}
