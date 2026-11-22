import Icon from '@/Components/UI/Icon';
import { CheckBox, RadioCards, Switch } from '@/Components/UI';

export function auditScopeLabel(settings, branches) {
    return settings.scope === 'all' ? 'كل الفروع' : branches.filter((branch) => settings.branch_ids.includes(branch.id)).map((branch) => branch.name).join('، ') || 'لم يُحدّد فرع';
}

export function auditSettingsChanges(saved, current, options) {
    const changes = [];
    const scopeKey = (settings) => `${settings.scope}:${settings.scope === 'selected' ? [...settings.branch_ids].sort((a, b) => a - b).join(',') : ''}`;
    if (scopeKey(saved) !== scopeKey(current)) {
        changes.push({ key: 'scope', label: 'فروع التدقيق', before: auditScopeLabel(saved, options.branches), after: auditScopeLabel(current, options.branches) });
    }
    for (const action of options.actions) {
        if (saved.actions.includes(action.value) !== current.actions.includes(action.value)) {
            changes.push({ key: action.value, label: action.label, before: saved.actions.includes(action.value) ? 'مسموح' : 'غير مسموح', after: current.actions.includes(action.value) ? 'مسموح' : 'غير مسموح', added: current.actions.includes(action.value), risk: action.value.startsWith('approve_') ? 'danger' : 'sensitive' });
        }
    }
    return changes;
}

export function AuditWorkSummary({ employee, options, value, enabled }) {
    return <aside className="space-y-4 rounded-card border border-(--ma-line) bg-(--ma-solid) p-4 shadow-card sm:p-6" aria-label="ملخص عمل التدقيق">
        <h3 className="flex items-center gap-2 font-bold text-(--ma-ink)"><Icon name="shield" className="h-5 w-5" />عمل التدقيق لـ {employee.name}</h3>
        <dl className="space-y-3 text-sm"><div><dt className="text-(--ma-muted)">نوع المستخدم</dt><dd className="font-semibold text-(--ma-ink)">{employee.roleLabel}</dd></div><div><dt className="text-(--ma-muted)">الفرع الإداري</dt><dd className="font-semibold text-(--ma-ink)">{employee.branchName ?? 'بلا فرع إداري'}</dd></div><div><dt className="text-(--ma-muted)">فروع التدقيق</dt><dd className="font-semibold text-(--ma-ink)">{enabled ? auditScopeLabel(value, options.branches) : 'التدقيق غير مفعّل'}</dd></div></dl>
        {enabled && <div className="space-y-2 border-t border-(--ma-line) pt-3"><p className="text-sm font-semibold text-(--ma-ink)">ما يستطيع تنفيذه</p><p className="text-sm leading-7 text-(--ma-muted)">عرض الصناديق المغلقة</p>{options.actions.filter((action) => value.actions.includes(action.value)).map((action) => <p key={action.value} className="flex items-start gap-2 text-sm leading-7 text-(--ma-muted)"><Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-(--ma-pay)" />{action.label}</p>)}</div>}
        {employee.isActive === false && <p role="status" className="rounded-control bg-(--ma-warn-s) p-3 text-sm text-(--ma-warn)">الحساب موقوف؛ لا يستطيع الدخول حتى إعادة تفعيله.</p>}
    </aside>;
}

export default function AuditAccessCard({ employee, options, value, enabled, onEnabledChange, onChange, disabled, embedded = false }) {
    const blocked = disabled || !enabled;
    function toggleAction(key, checked) {
        let actions = checked ? [...value.actions, key] : value.actions.filter((action) => action !== key);
        if (key === 'approve_boxes' && !checked) actions = actions.filter((action) => action !== 'approve_periods');
        onChange({ ...value, actions });
    }
    return <section className={embedded ? 'bg-(--ma-solid) p-4 sm:p-6' : 'm-4 rounded-row border border-(--ma-line) bg-(--ma-solid) p-4 sm:m-6'} aria-label="عمل التدقيق المالي">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-graphite-gradient text-white"><Icon name="shield" className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="font-bold text-(--ma-ink)">{embedded ? 'إتاحة التدقيق لهذا الموظف' : 'عمل التدقيق المالي'}</h3><p className="mt-1 text-sm leading-6 text-(--ma-muted)">حدّد أين يعمل الموظف وما يستطيع تنفيذه في التدقيق.</p></div><Switch checked={enabled} onChange={onEnabledChange} disabled={disabled} ariaLabel="تفعيل التدقيق المالي" /></div>
        <dl className="mt-4 grid gap-3 rounded-control bg-(--ma-tile) p-4 text-sm sm:grid-cols-2"><div><dt className="text-(--ma-muted)">نوع المستخدم / المسمى الوظيفي</dt><dd className="mt-1 font-semibold text-(--ma-ink)">{employee.roleLabel}</dd></div><div><dt className="text-(--ma-muted)">الفرع الإداري للموظف</dt><dd className="mt-1 font-semibold text-(--ma-ink)">{employee.branchName ?? 'بلا فرع إداري'}</dd></div></dl>
        {!enabled && <p className="mt-3 text-sm leading-7 text-(--ma-muted)">فعّل التدقيق لمنح الوصول إلى الصناديق المغلقة، ثم اختر الفروع والإجراءات أدناه.</p>}
        <fieldset disabled={blocked} className="mt-6 min-w-0"><legend className="font-semibold text-(--ma-ink)">نطاق فروع التدقيق</legend><p className="mt-1 text-sm leading-7 text-(--ma-muted)">الفرع الإداري يبقى كما هو؛ هذا الاختيار يحدد الفروع التي يراجعها.</p><RadioCards label="نطاق فروع التدقيق" name={`audit-scope-${employee.id}`} className="mt-3 flex flex-wrap gap-3" value={value.scope} onChange={(scope) => onChange({ ...value, scope })} isDisabled={blocked} options={[{ value: 'all', label: 'كل الفروع' }, { value: 'selected', label: 'فروع محددة' }]} itemClassName={() => 'flex cursor-pointer items-center gap-2 rounded-control border border-(--ma-line) px-3 py-2 text-sm font-semibold text-(--ma-ink)'} />
        {value.scope === 'selected' && <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto rounded-control border border-(--ma-line) p-3 sm:grid-cols-2">{options.branches.map((branch) => <label key={branch.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-(--ma-ink)"><CheckBox checked={value.branch_ids.includes(branch.id)} onChange={(event) => onChange({ ...value, branch_ids: event.target.checked ? [...value.branch_ids, branch.id] : value.branch_ids.filter((id) => id !== branch.id) })} />{branch.name}</label>)}{value.branch_ids.length === 0 && <p className="text-sm text-(--ma-brand) sm:col-span-2">اختر فرعًا واحدًا على الأقل.</p>}</div>}</fieldset>
        <div className="mt-6"><h4 className="font-semibold text-(--ma-ink)">الإجراءات المسموحة</h4><p className="mt-1 text-sm leading-7 text-(--ma-muted)">كل خيار مستقل، ويعمل داخل الفروع المحددة فقط.</p><div className="mt-3 divide-y divide-(--ma-line) rounded-control border border-(--ma-line)">{options.actions.map((action) => {
            const requiresBoxes = action.value === 'approve_periods' && !value.actions.includes('approve_boxes');
            return <div key={action.value} className="flex items-start gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-6 text-(--ma-ink)">{action.label}</p><p className="mt-1 text-sm leading-6 text-(--ma-muted)">{action.hint}</p>{requiresBoxes && <p className="mt-1 text-sm text-(--ma-warn)">فعّل اعتماد الصناديق أولًا.</p>}</div><Switch checked={value.actions.includes(action.value)} onChange={(checked) => toggleAction(action.value, checked)} disabled={blocked || requiresBoxes} ariaLabel={action.label} /></div>;
        })}</div></div>
    </section>;
}
