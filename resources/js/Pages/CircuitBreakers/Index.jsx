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
import { formatShekels } from '@/lib/currency';
import CircuitBreakerModal from './CircuitBreakerModal';
import PageHeader from '@/Components/PageHeader';
import { AddKey, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable } from '@/Components/UI';

export default function Index({ circuitBreakers, canCreate, filters, filterOptions }) {
    const [modalCircuitBreaker, setModalCircuitBreaker] = useState(null);
    const [creating, setCreating] = useState(false);
    const { requestDelete, deleteDialog } = useDeleteRecord('القاطع');
    const { setPerPage, sort, filterValues, setFilter, setFilters, clearFilters } = useDataTable('/circuit-breakers', filters);

    return (
        <SettingsLayout
            header={
                <PageHeader title="القواطع" actions={canCreate && <AddKey onClick={() => setCreating(true)}>قاطع جديد</AddKey>} />
            }
        >
            <Head title="القواطع" />

            <DataTableToolbar
                showSearch={false}
                perPage={filters.per_page}
                onPerPageChange={setPerPage}
                total={circuitBreakers.total}
                filterMenu={
                    <DataTableFilterMenu
                        tableKey="circuit_breakers"
                        groups={filterOptions}
                        values={filterValues}
                        onChange={setFilter}
                        onChangeMany={setFilters}
                        onClear={clearFilters}
                    />
                }
            />

            <div className="data-table-container">
                <ListTable aria-label="القواطع" sort={filters} onSort={sort}>
                    <ListHeader>
                        <ListColumn id="ampere" sortable isRowHeader>الأمبير</ListColumn>
                        <ListColumn id="minimum_payment" sortable>الحد الأدنى للدفع (شيكل)</ListColumn>
                        <ListColumn actions />
                    </ListHeader>
                    <ListBody empty={<span className="text-gray-500">لا توجد قواطع بعد.</span>}>
                        {circuitBreakers.data.map((circuitBreaker) => (
                            <ListRow
                                key={circuitBreaker.id}
                                id={circuitBreaker.id}
                                onOpen={circuitBreaker.canUpdate ? () => setModalCircuitBreaker(circuitBreaker) : null}
                            >
                                <ListCell>
                                    <RowIdentity icon="bolt" name={`${circuitBreaker.ampere}A`} />
                                </ListCell>
                                <ListCell className="text-gray-600">
                                    <bdi dir="ltr">{formatShekels(circuitBreaker.minimum_payment)}</bdi>
                                </ListCell>
                                <ListCell className="text-end">
                                    {(circuitBreaker.canUpdate || circuitBreaker.canDelete) && (
                                        <RowActionsMenu>
                                            {circuitBreaker.canDelete && (
                                                <Button data-raw="" variant="ghost" type="submit"
                                                    onClick={() =>
                                                        requestDelete(`/circuit-breakers/${circuitBreaker.id}`, `${circuitBreaker.ampere}A`)
                                                    }
                                                >
                                                    حذف
                                                </Button>
                                            )}
                                            {circuitBreaker.canUpdate && (
                                                <Button data-raw="" variant="ghost" type="submit" onClick={() => setModalCircuitBreaker(circuitBreaker)}>تعديل</Button>
                                            )}
                                        </RowActionsMenu>
                                    )}
                                </ListCell>
                            </ListRow>
                        ))}
                    </ListBody>
                </ListTable>
            </div>

            <Pagination meta={circuitBreakers} filters={filters} baseUrl="/circuit-breakers" />

            <CircuitBreakerModal show={creating} onClose={() => setCreating(false)} circuitBreaker={null} />
            {modalCircuitBreaker && (
                <CircuitBreakerModal
                    key={modalCircuitBreaker.id}
                    show
                    onClose={() => setModalCircuitBreaker(null)}
                    circuitBreaker={modalCircuitBreaker}
                />
            )}

            {deleteDialog}
        </SettingsLayout>
    );
}
