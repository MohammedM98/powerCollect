import { useMemo, useState } from 'react';
import DialogFrame from '@/Components/UI/DialogFrame';
import Icon from '@/Components/UI/Icon';
import PermissionPanel from './PermissionPanel';
import { auditScopeLabel } from './AuditAccessCard';
import { ICONS, permissionGuideEntries, permissionGuideHtml } from '@/lib/permissionGuide';
import { Notice, PrimaryKey, SecondaryKey, SegmentedChoice, TextInput } from '@/Components/UI';

export function PermissionExplanation({ entry, onClose }) {
    return (
        <DialogFrame
            show={Boolean(entry)}
            onClose={onClose}
            title={entry?.label}
            description={entry?.sectionLabel}
            icon="info"
            tone="blue"
            maxWidth="2xl"
            footer={<SecondaryKey onClick={onClose}>فهمت</SecondaryKey>}
        >
            <div>
                <h3 className="font-bold text-(--ma-ink)">ماذا تسمح؟</h3>
                <p className="mt-2 text-base leading-8 text-(--ma-muted)">{entry?.description}</p>
            </div>
            <div>
                <h3 className="font-bold text-(--ma-ink)">حدود الصلاحية</h3>
                <p className="mt-2 text-base leading-8 text-(--ma-muted)">{entry?.limit}</p>
            </div>
            <Notice>{entry?.delegation}</Notice>
        </DialogFrame>
    );
}

export default function PermissionGuide({ show, onClose, sections, employee, selected, scopedToOwnBranch, auditOptions, auditValue, initialAudience = 'all' }) {
    const [query, setQuery] = useState('');
    const [audience, setAudience] = useState(initialAudience);
    const [error, setError] = useState('');
    const entries = useMemo(() => permissionGuideEntries(sections), [sections]);
    const included = audience === 'selected' ? entries.filter(entry => selected.includes(entry.id)) : entries;
    const normalize = value => value.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
    const matching = included.filter(entry => normalize(`${entry.label} ${entry.description} ${entry.limit} ${entry.sectionLabel}`).includes(normalize(query.trim())));
    const auditActions = auditOptions && (audience === 'all' || selected.includes(auditOptions.permissionId))
        ? auditOptions.actions.filter(action => audience === 'all' || auditValue?.actions.includes(action.value)) : [];
    const auditScope = auditOptions && auditValue ? auditScopeLabel(auditValue, auditOptions.branches) : '';
    function html() {
        return permissionGuideHtml({ title: audience === 'selected' ? `دليل صلاحيات ${employee.name}` : 'دليل الصلاحيات المتاحة', entries: included, auditActions,
            scopeNote: audience === 'selected' ? `${employee.roleLabel}، ${employee.branchName ?? 'بلا فرع'}${auditOptions && selected.includes(auditOptions.permissionId) ? `، فروع التدقيق: ${auditScope}` : ''}، بحسب الاختيارات الحالية؛ التعديلات لا تُعتمد إلا بعد حفظها.` : scopedToOwnBranch ? 'الصلاحيات التي يحق لك إدارتها لموظفي فرعك.' : 'جميع الصلاحيات المتاحة للإدارة في النظام.',
            lockedPermissions: audience === 'selected' ? employee.lockedPermissions ?? [] : [],
        });
    }
    function download() {
        const url = URL.createObjectURL(new Blob([html()], { type: 'text/html;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = 'دليل الصلاحيات.html'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function print() {
        const target = window.open('', '_blank');
        if (!target) { setError('تعذّر فتح الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مجددًا.'); return; }
        target.opener = null;
        target.document.open(); target.document.write(html()); target.document.close();
        target.document.fonts.ready.then(() => { target.focus(); target.print(); });
    }
    const footer = (
        <>
            <SecondaryKey onClick={onClose}>إغلاق</SecondaryKey>
            <SecondaryKey onClick={download}><Icon name="document" className="h-4 w-4" />تنزيل HTML</SecondaryKey>
            <PrimaryKey onClick={print}><Icon name="printer" className="h-4 w-4" />طباعة / حفظ PDF</PrimaryKey>
        </>
    );

    return (
        <DialogFrame
            show={show}
            onClose={onClose}
            title="دليل الصلاحيات"
            description="ماذا تسمح كل صلاحية، وما حدودها ومن يستطيع تفويضها؟"
            icon="shield"
            maxWidth="6xl"
            footer={footer}
        >
            <div className="space-y-4">
                <SegmentedChoice
                    label="محتوى دليل الصلاحيات"
                    value={audience}
                    onChange={setAudience}
                    options={[
                        { value: 'all', label: scopedToOwnBranch ? 'كل الصلاحيات المتاحة لك' : 'كل الصلاحيات' },
                        { value: 'selected', label: `صلاحيات ${employee.name} المختارة` },
                    ]}
                />
                <p className="text-sm leading-7 text-(--ma-muted)">الطباعة والتنزيل يشملان الدليل المختار كاملًا، حتى لو كانت البطاقات مغلقة أو نتائج البحث محدودة. دليل الموظف يعكس الاختيارات الحالية.</p>
                <TextInput type="search" aria-label="البحث في دليل الصلاحيات" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم الصلاحية أو وظيفتها…" className="block w-full" />
                <p className="text-xs text-(--ma-muted)">عدد الصلاحيات المطابقة: <bdi dir="ltr">{matching.length}</bdi></p>
                {sections.filter((section) => matching.some((entry) => entry.section === section.key)).map((section) => (
                    <PermissionPanel key={`${audience}:${section.key}`} title={section.label} icon={ICONS[section.key]} count={matching.filter((entry) => entry.section === section.key).length} summary="الوظيفة والحدود ونطاق التفويض">
                        {matching.filter((entry) => entry.section === section.key).map((entry) => (
                            <article key={entry.id} className="permission-guide-entry">
                                <h4>{entry.label}</h4>
                                <p>{entry.description}</p>
                                <small><b>حدودها:</b> {entry.limit}</small>
                                <small>{entry.delegation}</small>
                            </article>
                        ))}
                    </PermissionPanel>
                ))}
                {matching.length === 0 && <p className="py-6 text-center text-(--ma-muted)">لا توجد صلاحيات مطابقة.</p>}
                {auditActions.length > 0 && (
                    <PermissionPanel key={`audit-${audience}`} title="إجراءات التدقيق المالي" icon="shield" count={auditActions.length} summary="مرتبطة بتفعيل التدقيق وفروعه المسموحة">
                        {auditActions.map((action) => (
                            <article key={action.value} className="permission-guide-entry">
                                <h4>{action.label}</h4>
                                <p>{action.hint}</p>
                            </article>
                        ))}
                    </PermissionPanel>
                )}
                {audience === 'selected' && employee.lockedPermissions?.length > 0 && <Notice>صلاحيات محفوظة خارج نطاق إدارتك: {employee.lockedPermissions.join('، ')}.</Notice>}
                {error && <Notice tone="danger" role="alert">{error}</Notice>}
            </div>
        </DialogFrame>
    );
}
