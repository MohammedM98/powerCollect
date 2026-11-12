import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { auditSettingsChanges } from './AuditAccessCard';
import PermissionGuide, { PermissionExplanation } from './PermissionGuide';
import { PermissionCompare } from './PermissionInsights';
import GrantRightPanel, { grantRightChanges } from './PermissionDelegation';
import { matrixGroups } from '@/lib/permissionGuide';
import { copyWorkPermissions, individualChanges, matchesQuery, matrixExtras, permissionEntries, riskCounts, riskLevel, roleColors, samePermissions } from '@/lib/permissions';
import { PermissionReviewDialog, PermissionSaveBar } from './PermissionReview';
import PermissionMatrixView from './PermissionMatrixView';
import PermissionHero from './PermissionHero';
import PermissionSummaryView from './PermissionSummaryView';
import { useLeaveWarning } from '@/hooks/useLeaveWarning';

export const defaultColorOf = roleColors([]);

/** Whether the grid's explanations were left on, remembered per browser. */
export function storedExplaining() {
    try {
        return localStorage.getItem('permissions.explaining') === '1';
    } catch {
        return false;
    }
}

export const TABS = [
    { key: 'matrix', label: 'الصلاحيات', icon: 'table' },
    { key: 'summary', label: 'ماذا يستطيع؟', icon: 'sparkles' },
    { key: 'compare', label: 'مقارنة', icon: 'repeat' },
];

/**
 * One employee's permissions. A dark header with who they are, how much
 * they hold and how risky it is, and ways to copy a colleague or print
 * their guide; then three views: the grid of every section by action, what
 * they can do in plain words, and a comparison with a colleague. Once
 * something changes, a bar offers to review and save; dangerous grants
 * must be acknowledged in the review before they are saved.
 */
export function PermissionEditor({
    employee,
    sections,
    templates,
    copySources,
    scopedToOwnBranch,
    onDirtyChange,
    auditOptions,
    delegation = null,
    colorOf = defaultColorOf,
    onSaved,
}) {
    const saved = employee.permissionIds;
    const savedKeys = employee.grantableIds ?? [];
    const savedAudit =
        auditOptions && !saved.includes(auditOptions.permissionId) && employee.auditSettingsConfigured === false
            ? { scope: 'selected', branch_ids: employee.branchId ? [employee.branchId] : [], actions: [] }
            : employee.auditSettings;
    const { data, setData, put, transform, processing, errors } = useForm({
        permissions: { [employee.id]: [...saved] },
        ...(auditOptions ? { audit_settings: { [employee.id]: savedAudit } } : {}),
        ...(delegation ? { grantable: { [employee.id]: [...savedKeys] } } : {}),
    });
    const selected = data.permissions[employee.id];
    // The right to hand on is kept only for permissions the employee still holds, and given only to whoever manages permissions.
    const canDelegate = Boolean(delegation && selected.includes(delegation.managePermissionsId));
    const keys = (data.grantable?.[employee.id] ?? []).filter((id) => selected.includes(id));
    const keyChanges = delegation ? grantRightChanges(savedKeys, keys) : { added: 0, removed: 0 };
    const auditValue = data.audit_settings?.[employee.id];
    const auditEnabled = Boolean(auditOptions && selected.includes(auditOptions.permissionId));
    const auditDraftInitialized = useRef(Boolean(auditOptions && (saved.includes(auditOptions.permissionId) || employee.auditSettingsConfigured)));
    const auditChanges = auditOptions ? auditSettingsChanges(savedAudit, auditValue, auditOptions) : [];
    const [tab, setTab] = useState('matrix');
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState('all');
    const [openSections, setOpenSections] = useState(new Set());
    const [guideAudience, setGuideAudience] = useState(null);
    const [explanation, setExplanation] = useState(null);
    const [explaining, setExplainingState] = useState(storedExplaining);
    const [reviewing, setReviewing] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);
    const changes = useMemo(() => individualChanges(sections, saved, selected), [sections, saved, selected]);
    const auditGrants =
        auditEnabled && !saved.includes(auditOptions.permissionId)
            ? auditOptions.actions
                  .filter((action) => auditValue.actions.includes(action.value) && action.value.startsWith('approve_'))
                  .map((action) => ({ ...action, added: true, risk: 'danger' }))
            : auditEnabled
              ? auditChanges
              : [];
    const dangerousGrants = [...changes, ...auditGrants].filter((change) => change.added && change.risk === 'danger');
    const dirty = !samePermissions(saved, selected) || auditChanges.length > 0 || keyChanges.added + keyChanges.removed > 0;
    const tabs = canDelegate ? [...TABS, { key: 'delegation', label: 'حق المنح', icon: 'key' }] : TABS;
    const activeTab = tabs.some((item) => item.key === tab) ? tab : 'matrix';
    const takenFromOthers = changes.filter((change) => !change.added && employee.grantsGiven?.[change.id] > 0);
    const grantedBy = Object.entries(
        Object.values(employee.grantedBy ?? {}).reduce((counts, name) => ({ ...counts, [name]: (counts[name] ?? 0) + 1 }), {}),
    );
    const template = templates.find((item) => item.role === employee.role);
    const deviations = template ? individualChanges(sections, template.permissionIds, selected).length : null;
    const color = colorOf(employee.roleLabel);
    const counts = riskCounts(sections, selected);
    const heroRisk = riskLevel(sections, selected);
    const allCount = permissionEntries(sections).length;
    const locked = employee.lockedPermissions ?? [];
    const firstName = employee.name.split(' ')[0];
    const needle = query.trim();

    const { matching, groups } = matrixGroups(sections, selected, saved, query, mode, auditChanges.length > 0);
    const allOpen = matching.length > 0 && matching.every((section) => openSections.has(section.key));

    function setExplaining(on) {
        setExplainingState(on);
        try {
            localStorage.setItem('permissions.explaining', on ? '1' : '0');
        } catch {
            // Private windows may refuse storage; the switch still works for this visit.
        }
    }

    /** Sets the selected permissions; switching the audit on for the first time starts its work at the employee's own branch. */
    function setSelected(ids) {
        if (
            auditOptions &&
            !auditDraftInitialized.current &&
            ids.includes(auditOptions.permissionId) &&
            !selected.includes(auditOptions.permissionId)
        ) {
            setAudit({ scope: 'selected', branch_ids: employee.branchId ? [employee.branchId] : [], actions: [] });
            auditDraftInitialized.current = true;
        }
        setData('permissions', { [employee.id]: ids });
    }

    function setAudit(value) {
        setData('audit_settings', { [employee.id]: value });
    }

    function setKeys(ids) {
        setData('grantable', { [employee.id]: ids });
    }

    /** Copy a colleague's work permissions; financial audit access and its scope stay a separate decision. */
    function copyFrom(user) {
        setSelected(copyWorkPermissions(sections, selected, user.permissionIds));
    }

    function discard() {
        setData((current) => ({
            ...current,
            permissions: { [employee.id]: [...saved] },
            ...(auditOptions ? { audit_settings: { [employee.id]: savedAudit } } : {}),
            ...(delegation ? { grantable: { [employee.id]: [...savedKeys] } } : {}),
        }));
    }

    /** Searching opens the sections whose match is among their options, so it can be seen. */
    function search(value) {
        setQuery(value);
        const text = value.trim();
        setOpenSections(
            new Set(
                text
                    ? sections
                          .filter((section) =>
                              matrixExtras(section).some((group) =>
                                  group.items.some((item) => matchesQuery(item.label, text) || matchesQuery(item.hint ?? '', text)),
                              ),
                          )
                          .map((section) => section.key)
                    : [],
            ),
        );
    }

    function toggleSection(key, next) {
        setOpenSections((old) => {
            const updated = new Set(old);
            next ? updated.add(key) : updated.delete(key);
            return updated;
        });
    }

    function save() {
        if (dirty && !processing) {
            setAcknowledged(false);
            setReviewing(true);
        }
    }

    function confirmSave() {
        if (dirty && !processing && (dangerousGrants.length === 0 || acknowledged)) {
            const previous = {
                permissions: { [employee.id]: [...saved] },
                ...(auditOptions ? { audit_settings: { [employee.id]: savedAudit } } : {}),
                ...(delegation ? { grantable: { [employee.id]: [...savedKeys] } } : {}),
            };
            transform((current) => (current.grantable ? { ...current, grantable: { [employee.id]: keys } } : current));
            put('/settings/permissions', {
                preserveScroll: true,
                onSuccess: () => {
                    setReviewing(false);
                    onSaved?.({ employeeId: employee.id, name: employee.name, previous });
                },
                onError: () => setReviewing(false),
            });
        }
    }

    useEffect(() => {
        onDirtyChange(dirty);
    }, [dirty, onDirtyChange]);

    useLeaveWarning(dirty);

    // Ctrl+S (⌘S) saves.
    useEffect(() => {
        function onKeyDown(event) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                if (!reviewing) {
                    save();
                }
            }
        }

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    });

    const added = changes.filter((item) => item.added).length;
    const removed = changes.length - added;
    const after = riskCounts(sections, selected);
    const before = riskCounts(sections, saved);

    return (
        <div className="min-w-0 space-y-4">
            <PermissionHero
                activeTab={activeTab}
                allCount={allCount}
                color={color}
                colorOf={colorOf}
                copyFrom={copyFrom}
                copySources={copySources}
                counts={counts}
                deviations={deviations}
                dirty={dirty}
                employee={employee}
                grantedBy={grantedBy}
                heroRisk={heroRisk}
                locked={locked}
                processing={processing}
                sections={sections}
                selected={selected}
                setGuideAudience={setGuideAudience}
                setSelected={setSelected}
                setTab={setTab}
                tabs={tabs}
                template={template}
            />

            {activeTab === 'matrix' && (
                <PermissionMatrixView
                    allOpen={allOpen}
                    auditChanges={auditChanges}
                    auditEnabled={auditEnabled}
                    auditOptions={auditOptions}
                    auditValue={auditValue}
                    employee={employee}
                    explaining={explaining}
                    groups={groups}
                    matching={matching}
                    mode={mode}
                    needle={needle}
                    openSections={openSections}
                    processing={processing}
                    query={query}
                    saved={saved}
                    scopedToOwnBranch={scopedToOwnBranch}
                    search={search}
                    sections={sections}
                    selected={selected}
                    setAudit={setAudit}
                    setExplaining={setExplaining}
                    setExplanation={setExplanation}
                    setGuideAudience={setGuideAudience}
                    setMode={setMode}
                    setOpenSections={setOpenSections}
                    setSelected={setSelected}
                    toggleSection={toggleSection}
                />
            )}

            {activeTab === 'summary' && (
                <PermissionSummaryView
                    employee={employee}
                    sections={sections}
                    selected={selected}
                    template={template}
                    scopedToOwnBranch={scopedToOwnBranch}
                    firstName={firstName}
                    auditOptions={auditOptions}
                    auditEnabled={auditEnabled}
                    auditValue={auditValue}
                />
            )}

            {activeTab === 'compare' && (
                <div id="permission-view-compare" role="tabpanel" aria-labelledby="permission-tab-compare">
                    <PermissionCompare
                        employee={employee}
                        sections={sections}
                        selected={selected}
                        colleagues={copySources}
                        colorOf={colorOf}
                        disabled={processing}
                        onAddMissing={(ids) => setSelected([...new Set([...selected, ...ids])])}
                        onMatch={copyFrom}
                    />
                </div>
            )}

            {activeTab === 'delegation' && (
                <div id="permission-view-delegation" role="tabpanel" aria-labelledby="permission-tab-delegation">
                    <GrantRightPanel
                        sections={sections}
                        selected={selected}
                        grantable={keys}
                        delegableIds={delegation.delegableIds}
                        grantsGiven={employee.grantsGiven}
                        firstName={firstName}
                        disabled={processing}
                        onChange={setKeys}
                    />
                </div>
            )}

            <PermissionExplanation entry={explanation} onClose={() => setExplanation(null)} />
            {guideAudience && (
                <PermissionGuide
                    key={guideAudience}
                    show
                    onClose={() => setGuideAudience(null)}
                    sections={sections}
                    employee={employee}
                    selected={selected}
                    scopedToOwnBranch={scopedToOwnBranch}
                    auditOptions={auditOptions}
                    auditValue={auditValue}
                    initialAudience={guideAudience}
                />
            )}
            {/* Room at the end of the page, so the bar never hides the last section. */}
            {dirty && <div className="h-20" aria-hidden="true" />}

            <PermissionSaveBar
                dirty={dirty}
                errors={errors}
                changes={changes}
                auditChanges={auditChanges}
                firstName={firstName}
                added={added}
                removed={removed}
                dangerousGrants={dangerousGrants}
                processing={processing}
                onDiscard={discard}
                onSave={save}
            />

            <PermissionReviewDialog
                show={reviewing}
                employee={employee}
                changes={changes}
                auditChanges={auditChanges}
                keyChanges={keyChanges}
                takenFromOthers={takenFromOthers}
                dangerousGrants={dangerousGrants}
                added={added}
                removed={removed}
                before={before}
                after={after}
                heroRisk={heroRisk}
                firstName={firstName}
                acknowledged={acknowledged}
                onAcknowledgedChange={setAcknowledged}
                dirty={dirty}
                processing={processing}
                onCancel={() => setReviewing(false)}
                onConfirm={confirmSave}
            />
        </div>
    );
}
