import { useEffect, useMemo, useRef, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import SettingsLayout from '@/Layouts/SettingsLayout';
import Icon from '@/Components/Icon';
import ConfirmDialog from '@/Components/ConfirmDialog';
import EmployeeList from './PermissionPeople';
import { SectionRow } from './PermissionMatrix';
import { PermissionSummary } from './PermissionInsights';
import './PermissionDesign.css';
import { useDataTable } from '@/hooks/useDataTable';
import { permissionEntries, riskCounts, riskLevel, roleColors, sectionIds, sectionModel } from '@/lib/permissions';
import PageHeader from '@/Components/PageHeader';
import { PermissionChangeReview } from './PermissionReview';
import { PermissionEditor } from './PermissionEditor';

export { SectionRow, PermissionSummary, PermissionChangeReview };

export default function Permissions({
    users,
    selectedUser,
    permissionGroups,
    roleTemplates,
    filters,
    filterOptions,
    scopedToOwnBranch,
    auditOptions = null,
    delegation = null,
}) {
    const hasUnsavedChanges = useRef(false);
    const [selectedDirty, setSelectedDirty] = useState(false);
    const editorRef = useRef(null);
    const searchRef = useRef(null);
    // The employee picked while the current one has unsaved changes, waiting on "discard them?".
    const [pendingEmployee, setPendingEmployee] = useState(null);
    // The last save, kept for a short while so it can be undone.
    const [lastSave, setLastSave] = useState(null);
    const [undoing, setUndoing] = useState(false);
    const { search, setSearch, filterValues, setFilter } = useDataTable('/settings/permissions', filters, { selected: selectedUser?.id });
    const sections = useMemo(() => permissionGroups.map(sectionModel).filter((section) => sectionIds(section).length > 0), [permissionGroups]);
    const colorOf = useMemo(
        () => roleColors((filterOptions.find((group) => group.key === 'user_type_id')?.options ?? []).map((option) => option.label)),
        [filterOptions],
    );
    const allCount = useMemo(() => permissionEntries(sections).length, [sections]);

    function statsOf(user) {
        const counts = riskCounts(sections, user.permissionIds);
        const risk = riskLevel(sections, user.permissionIds);

        return { ...counts, share: allCount ? Math.round((counts.total / allCount) * 100) : 0, level: risk.level, label: risk.label };
    }

    useEffect(() => {
        if (!lastSave) {
            return;
        }

        const timer = setTimeout(() => setLastSave(null), 15000);
        return () => clearTimeout(timer);
    }, [lastSave]);

    function undoLastSave() {
        if (!lastSave || undoing) {
            return;
        }

        setUndoing(true);
        router.put('/settings/permissions', lastSave.previous, {
            preserveScroll: true,
            onFinish: () => {
                setUndoing(false);
                setLastSave(null);
            },
        });
    }

    function selectEmployee(user) {
        if (user.id === selectedUser?.id) {
            return;
        }

        if (hasUnsavedChanges.current) {
            setPendingEmployee(user);
        } else {
            openEmployee(user);
        }
    }

    function openEmployee(user) {
        setPendingEmployee(null);
        router.get(
            '/settings/permissions',
            {
                search,
                sort: filters.sort,
                direction: filters.direction,
                per_page: filters.per_page,
                filter: filterValues,
                page: users.current_page,
                selected: user.id,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['selectedUser'],
                onSuccess: () => {
                    // On narrow screens the editor sits below the list: bring it into view.
                    if (window.innerWidth < 1024) {
                        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                },
            },
        );
    }

    // "/" jumps to the employee search; J and K move to the next and previous employee.
    useEffect(() => {
        function onKeyDown(event) {
            if (event.target.closest?.('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            if (event.key === '/') {
                event.preventDefault();
                searchRef.current?.focus();
            } else if (event.key === 'j' || event.key === 'k') {
                const index = users.data.findIndex((user) => user.id === selectedUser?.id);
                const next = users.data[index + (event.key === 'j' ? 1 : -1)];

                if (next) {
                    selectEmployee(next);
                }
            }
        }

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    });

    return (
        <SettingsLayout
            header={
                <PageHeader title="إدارة صلاحيات الموظفين" info="اختر موظفًا، وحدّد ما يستطيع فعله في كل قسم، ثم راجع التغييرات وأكّد حفظها." />
            }
        >
            <Head title="الصلاحيات" />

            <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
                <EmployeeList
                    users={users}
                    selectedId={selectedUser?.id}
                    selectedDirty={selectedDirty}
                    filters={filters}
                    filterOptions={filterOptions}
                    search={search}
                    onSearchChange={setSearch}
                    filterValues={filterValues}
                    onFilterChange={setFilter}
                    onSelect={selectEmployee}
                    searchRef={searchRef}
                    colorOf={colorOf}
                    statsOf={statsOf}
                />

                <div ref={editorRef} className="min-w-0 scroll-mt-24">
                    {selectedUser ? (
                        <PermissionEditor
                            // A fresh editor per employee and per saved state, so the levels always start from what's stored.
                            key={`${selectedUser.id}:${selectedUser.permissionIds.join(',')}:${(selectedUser.grantableIds ?? []).join(',')}:${JSON.stringify(selectedUser.auditSettings)}`}
                            employee={selectedUser}
                            auditOptions={auditOptions}
                            delegation={delegation}
                            sections={sections}
                            templates={roleTemplates}
                            copySources={users.data.filter((user) => user.id !== selectedUser.id)}
                            scopedToOwnBranch={scopedToOwnBranch}
                            colorOf={colorOf}
                            onSaved={setLastSave}
                            onDirtyChange={(dirty) => {
                                hasUnsavedChanges.current = dirty;
                                setSelectedDirty(dirty);
                            }}
                        />
                    ) : (
                        <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-card border border-dashed border-gray-200 bg-surface p-8 text-center">
                            <Icon name="shield" className="h-10 w-10 text-gray-300" />
                            <p className="mt-3 text-sm font-medium text-gray-600">لا يوجد موظفون لإدارة صلاحياتهم.</p>
                        </div>
                    )}
                </div>
            </div>

            <p className="mt-4 hidden flex-wrap gap-4 text-xs text-gray-500 lg:flex">
                <span>
                    <span className="kbd">/</span> بحث عن موظف
                </span>
                <span>
                    <span className="kbd">J</span> <span className="kbd">K</span> الموظف التالي والسابق
                </span>
                <span>
                    <span className="kbd">Ctrl</span> + <span className="kbd">S</span> مراجعة وحفظ
                </span>
            </p>

            {lastSave && !selectedDirty && (
                <div className="pm-toast" role="status">
                    <Icon name="check" className="h-5 w-5 shrink-0 text-emerald-400" strokeWidth={2.5} />
                    <span className="min-w-0 flex-1">حُفظت صلاحيات {lastSave.name}.</span>
                    <button type="button" onClick={undoLastSave} disabled={undoing} className="pm-toast-action">
                        <Icon name="undo" className="h-4 w-4" />
                        {undoing ? 'جارٍ التراجع...' : 'تراجع عن الحفظ'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setLastSave(null)}
                        aria-label="إخفاء"
                        className="rounded-lg p-1 text-white/70 hover:text-white"
                    >
                        <Icon name="close" className="h-4 w-4" />
                    </button>
                </div>
            )}

            <ConfirmDialog
                show={Boolean(pendingEmployee)}
                onConfirm={() => openEmployee(pendingEmployee)}
                onCancel={() => setPendingEmployee(null)}
                title="تجاهل التغييرات؟"
                message={`لديك تعديلات على صلاحيات ${selectedUser?.name ?? 'هذا الموظف'} لم تُحفظ بعد. إذا انتقلت إلى موظف آخر فستفقدها.`}
                confirmLabel="تجاهل التغييرات"
                cancelLabel="البقاء ومتابعة التعديل"
                icon="alert"
                tone="danger"
            />
        </SettingsLayout>
    );
}

export { PermissionEditor };
