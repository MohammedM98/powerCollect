import AuditAccessCard, { auditScopeLabel } from './AuditAccessCard';
import Icon from '@/Components/Icon';
import { MatrixHead, MatrixLegend, SectionRow, TriToggle } from './PermissionMatrix';
import { filterSections, sectionIds, withGroupAccess, withSectionsAll, withToggled } from '@/lib/permissions';
import Switch from '@/Components/Switch';

const MODES = [
    ['all', 'الكل'],
    ['enabled', 'المفعّلة'],
    ['sensitive', 'فيها صلاحيات خاصة'],
    ['changed', 'المعدّلة'],
];

/** What each group of sections covers, shown with «الشرح» on. */
const GROUP_NOTES = {
    basic: 'بيانات العمل اليومي: المشتركون والطبلونات والقواطع وأسعار الكيلو.',
    readings: 'إدخال القراءات الأسبوعية واعتمادها، وتوزيع الطبلونات على القرّاء الميدانيين والكشوف الورقية.',
    finance: 'الدفعات والحركات المالية والتقارير وقوائم القطع. أغلب خياراتها حساسة لأنها تغيّر أرصدة المشتركين.',
    audit: 'مراجعة الصناديق المغلقة ومبالغ البنك واعتماد الفروق. يمنحه السوبر أدمن لأشخاص محددين مع فروع تدقيقهم.',
    communication: 'رسائل المشتركين وقوالب الطباعة المشتركة لكل الشركة.',
    administration: 'حسابات الموظفين والفروع والمناطق. يدير أغلبها السوبر أدمن من اللوحة المركزية.',
};

/** The employee's permissions as a grid: every section by action, grouped, with a search, a filter by state, the explanations and the audit access card. */
export default function PermissionMatrixView({
    allOpen,
    auditChanges,
    auditEnabled,
    auditOptions,
    auditValue,
    employee,
    explaining,
    groups,
    matching,
    mode,
    needle,
    openSections,
    processing,
    query,
    saved,
    scopedToOwnBranch,
    search,
    sections,
    selected,
    setAudit,
    setExplaining,
    setExplanation,
    setGuideAudience,
    setMode,
    setOpenSections,
    setSelected,
    toggleSection,
}) {
    return (
        <div id="permission-view-matrix" role="tabpanel" aria-labelledby="permission-tab-matrix" className="space-y-4">
            <section className="pm-card pm-matrix" aria-label="جدول الصلاحيات">
                <div className="pm-tools">
                    <div className="pm-search">
                        <Icon name="search" className="pointer-events-none absolute inset-y-0 start-3.5 my-auto h-[18px] w-[18px] text-gray-400" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => search(event.target.value)}
                            placeholder="ابحث بكلمة: دفعة، خصم، اعتماد، حذف..."
                            aria-label="ابحث عن صلاحية"
                            className="block w-full py-2 pe-3 ps-10 text-sm"
                        />
                    </div>
                    <div className="pm-modes" role="group" aria-label="تصفية الأقسام">
                        {MODES.map(([value, label]) => (
                            <button key={value} type="button" onClick={() => setMode(value)} aria-pressed={mode === value} className="pm-mode">
                                {label}
                                <span className="font-display">{filterSections(sections, selected, saved, '', value).length}</span>
                            </button>
                        ))}
                    </div>
                    <div className="pm-tool-actions">
                        <span className="me-2 inline-flex items-center">
                            <Switch checked={explaining} onChange={setExplaining} label="الشرح" ariaLabel="إظهار شرح الأقسام والأزرار" />
                        </span>
                        <button
                            type="button"
                            className="pm-ghost-button"
                            disabled={processing || matching.length === 0}
                            title="يجعل كل قسم معروض للعرض فقط"
                            onClick={() => setSelected(withGroupAccess(matching, selected, true))}
                        >
                            <Icon name="eye" className="h-4 w-4" />
                            عرض فقط
                        </button>
                        <button
                            type="button"
                            className="pm-ghost-button"
                            disabled={processing || matching.length === 0}
                            title="يسحب صلاحيات الأقسام المعروضة"
                            onClick={() => setSelected(withSectionsAll(matching, selected, false))}
                        >
                            <Icon name="close" className="h-4 w-4" />
                            سحب الكل
                        </button>
                        <button
                            type="button"
                            className="pm-ghost-button"
                            onClick={() => setOpenSections(allOpen ? new Set() : new Set(matching.map((section) => section.key)))}
                        >
                            <Icon name={allOpen ? 'collapse' : 'expand'} className="h-4 w-4" />
                            {allOpen ? 'طيّ الكل' : 'فتح الكل'}
                        </button>
                        <button type="button" className="pm-ghost-button is-brand" onClick={() => setGuideAudience('all')}>
                            <Icon name="document" className="h-4 w-4" />
                            دليل الصلاحيات
                        </button>
                    </div>
                </div>
                {needle && matching.length > 0 && (
                    <p className="pm-found" aria-live="polite">
                        تطابق <b className="font-display">{matching.length}</b> {matching.length === 1 ? 'قسمًا' : 'أقسام'}
                    </p>
                )}

                {explaining && (
                    <div className="pm-explain-note">
                        <p>
                            كل خانة صلاحية مستقلة: تحديد «تعديل» لا يمنح «عرض» أو «إضافة» معه. الخيارات الخاصة بكل قسم تفتح من «خيارات»، و«ⓘ» تحت أي
                            خانة يشرح ما تتيحه وحدودها.{' '}
                            {scopedToOwnBranch
                                ? 'تمنح وتسحب الصلاحيات المتاحة هنا لموظفي فرعك فقط؛ التفويض الإداري والصلاحيات العامة يديرها السوبر أدمن.'
                                : 'لتمكين مدير الفرع من إضافة موظفين وتوزيع صلاحياتهم، فعّل له «إضافة المستخدمين» و«إدارة صلاحيات موظفي الفرع». المسمى الوظيفي وحده لا يمنح صلاحيات.'}
                        </p>
                        <dl>
                            <dt>عرض فقط</dt>
                            <dd>يترك لكل قسم ظاهر صلاحية العرض فقط ويسحب ما سواها.</dd>
                            <dt>سحب الكل</dt>
                            <dd>يسحب كل صلاحيات الأقسام الظاهرة.</dd>
                            <dt>فتح الكل</dt>
                            <dd>يفتح خيارات كل الأقسام دفعة واحدة دون تغيير شيء.</dd>
                            <dt>الكل</dt>
                            <dd>آخر عمود: يمنح أو يسحب كل صلاحيات القسم أو المجموعة.</dd>
                            <dt>دليل الصلاحيات</dt>
                            <dd>دليل كامل قابل للبحث والطباعة لكل الصلاحيات.</dd>
                        </dl>
                    </div>
                )}

                <div className={`pm-grid ${explaining ? 'is-explaining' : ''}`}>
                    <MatrixHead />
                    {groups.length === 0 ? (
                        <div className="px-5 py-12 text-center text-sm text-gray-500">
                            <Icon name="search" className="mx-auto h-8 w-8 text-gray-300" />
                            <p className="mt-2">لا توجد صلاحيات تطابق البحث أو التصفية.</p>
                            <button
                                type="button"
                                onClick={() => {
                                    search('');
                                    setMode('all');
                                }}
                                className="mt-2 font-semibold text-brand-600"
                            >
                                عرض كل الصلاحيات
                            </button>
                        </div>
                    ) : (
                        groups.map((group) => {
                            const ids = group.sections.flatMap(sectionIds);
                            const held = ids.filter((id) => selected.includes(id)).length;

                            return (
                                <section key={group.key} className="pm-group" aria-label={group.label}>
                                    <div className="pm-group-head">
                                        <span className="pm-group-icon">
                                            <Icon name={group.icon} className="h-4 w-4" />
                                        </span>
                                        <h4>{group.label}</h4>
                                        <span
                                            className="pm-group-count"
                                            style={{ '--fill': `${ids.length ? Math.round((held / ids.length) * 100) : 0}%` }}
                                        >
                                            <b className="font-display">{held}</b> من <b className="font-display">{ids.length}</b>
                                            <i aria-hidden="true" />
                                        </span>
                                        <span className="flex-1" />
                                        {group.sections.some((section) => section.ladder?.actions.includes('view') || section.key === 'reports') && (
                                            <button
                                                type="button"
                                                onClick={() => setSelected(withGroupAccess(group.sections, selected, true))}
                                                disabled={processing}
                                                className="pm-link-button"
                                            >
                                                عرض فقط للمجموعة
                                            </button>
                                        )}
                                        <TriToggle
                                            ids={ids}
                                            selected={selected}
                                            onChange={(on) => setSelected(withSectionsAll(group.sections, selected, on))}
                                            disabled={processing}
                                            label={`كل صلاحيات ${group.label}`}
                                        />
                                        {explaining && GROUP_NOTES[group.key] && <p className="pm-group-note">{GROUP_NOTES[group.key]}</p>}
                                    </div>
                                    {group.sections.map((section) =>
                                        section.key === 'financial_audit' && auditOptions ? (
                                            <SectionRow
                                                key={section.key}
                                                section={section}
                                                selected={selected}
                                                saved={saved}
                                                onChange={setSelected}
                                                disabled={processing}
                                                open={openSections.has(section.key)}
                                                onToggle={(next) => toggleSection(section.key, next)}
                                                onExplain={setExplanation}
                                                explaining={explaining}
                                                query={query}
                                                summary={
                                                    auditEnabled
                                                        ? `مفعّل · ${auditScopeLabel(auditValue, auditOptions.branches)}`
                                                        : 'غير مفعّل · يمنحه السوبر أدمن لأشخاص محددين'
                                                }
                                                changed={auditChanges.length > 0}
                                            >
                                                <AuditAccessCard
                                                    embedded
                                                    employee={employee}
                                                    options={auditOptions}
                                                    value={auditValue}
                                                    enabled={auditEnabled}
                                                    onEnabledChange={(checked) =>
                                                        setSelected(withToggled(selected, auditOptions.permissionId, checked))
                                                    }
                                                    onChange={setAudit}
                                                    disabled={processing}
                                                />
                                            </SectionRow>
                                        ) : (
                                            <SectionRow
                                                key={section.key}
                                                section={section}
                                                selected={selected}
                                                saved={saved}
                                                onChange={setSelected}
                                                disabled={processing}
                                                open={openSections.has(section.key)}
                                                onToggle={(next) => toggleSection(section.key, next)}
                                                onExplain={setExplanation}
                                                explaining={explaining}
                                                query={query}
                                            />
                                        ),
                                    )}
                                </section>
                            );
                        })
                    )}
                </div>

                <MatrixLegend />
            </section>
        </div>
    );
}
