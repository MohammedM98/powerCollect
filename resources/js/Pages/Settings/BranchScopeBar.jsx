import { router } from '@inertiajs/react';
import BranchBanner from '@/Components/BranchBanner';
import { SettingsSelect } from '@/Components/Settings/SettingsKit';

/**
 * Whose schedule a schedule page shows: every branch or one
 * branch's. The Super Admin picks it from the list; a Branch Admin only ever
 * has their own branch, so sees its name. A company save also replaces
 * schedules previously customized for individual branches.
 */
export default function BranchScopeBar({ path, scope, branch, branches, followsCompany, branchesWithOwn, locked }) {
    let note;
    if (!branch) {
        note = `عند الحفظ تُطبّق مواعيد الشركة على جميع الفروع، وتتجاوز أي مواعيد مخصصة لها${branchesWithOwn > 0 ? `، بما فيها إعدادات ${branchesWithOwn} من الفروع المحفوظة` : ''}. تبقى القراءات والأسابيع السابقة محفوظة بتواريخها.`;
    } else if (followsCompany) {
        note = `الفرع «${branch.name}» يتبع حاليًا إعدادات الشركة. يمكنك تخصيص مواعيده هنا؛ وعند تعميم مواعيد الشركة لاحقًا تُستبدل مواعيد هذا الفرع أيضًا.`;
    } else {
        note = `الحفظ هنا يخص الفرع «${branch.name}» وحده. عند تعميم مواعيد الشركة تُستبدل هذه المواعيد بإعدادات الشركة.`;
    }

    function pick(value) {
        router.get(path, { branch: value || 'all' });
    }

    return (
        <BranchBanner scope={scope} eyebrow="تضبط الآن مواعيد القراءات لـ" allLabel="إعدادات الشركة" className="mt-5"
            ownControls
            controls={branches.length > 0 ? (
                <div className="flex w-full flex-col gap-1.5 sm:w-72" title={locked ? 'احفظ التغييرات أو تراجع عنها قبل تغيير الفرع.' : undefined}>
                    <span className="gl-label">نطاق المواعيد</span>
                    <SettingsSelect label="نطاق المواعيد" value={branch?.id ?? ''} isDisabled={locked} onChange={pick}
                        options={[{ value: '', label: 'جميع الفروع — إعدادات الشركة' }, ...branches.map((item) => ({ value: item.value, label: `${item.label}${item.hasOwn ? '، إعدادات محفوظة' : ''}` }))]} />
                </div>
            ) : null}>
            <p className="text-sm leading-relaxed gl-text-muted">{note}</p>
        </BranchBanner>
    );
}
