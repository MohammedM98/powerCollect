import { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';

/** The working branch the page shows when it has no branch bar of its own, and how to change it; null when there is none to show. */
function useWorkingBranch() {
    const { branchView, branchScope, scope } = usePage().props;
    const [switching, setSwitching] = useState(false);
    const shown = Boolean(branchView) && !branchScope && !['branch', 'all', 'governorate'].includes(scope?.level);

    function changeBranch(event) {
        setSwitching(true);
        router.flushAll();
        router.put('/branch-view', { branch_id: event.target.value ? Number(event.target.value) : null }, {
            preserveState: false,
            onFinish: () => setSwitching(false),
        });
    }

    return shown ? { branchView, switching, changeBranch } : null;
}

/**
 * The super admin's working branch in the top bar: a dot, the branch name (or all branches),
 * and the picker that changes it for the rest of their visit.
 */
export function WorkingBranchChip() {
    const working = useWorkingBranch();

    if (!working) {
        return null;
    }

    const { branchView, switching, changeBranch } = working;

    return (
        <label className="tn-branch-chip" title="فرع العمل: يبقى اختيارك معك أثناء التنقل حتى تغيّره">
            <i aria-hidden="true" />
            <select aria-label="تغيير فرع العمل" value={branchView.current?.id ?? ''} onChange={changeBranch} disabled={switching}>
                <option value="">جميع الفروع</option>
                {branchView.options.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <Icon name="chevron-down" className="h-3.5 w-3.5" />
        </label>
    );
}

/**
 * The super admin's working branch, as a slim scope bar over pages that
 * have no branch bar of their own (on phones; wide screens show the chip in
 * the top bar): which branch they work in (or all of them) and the picker
 * that changes it for the rest of their visit.
 */
export default function BranchViewSwitcher() {
    const working = useWorkingBranch();

    if (!working) {
        return null;
    }

    const { branchView, switching, changeBranch } = working;

    return (
        <section aria-label="فرع العمل الحالي" className="gl-scope mb-5 lg:hidden">
            <div className="gl-scope-row">
                <span aria-hidden="true" className="gl-scope-ico"><Icon name="building" className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                    <p className="gl-scope-eyebrow">يبقى اختيارك معك أثناء التنقل حتى تغيّره. صلاحيات المدير العام محفوظة.</p>
                    <h2 className="gl-scope-name !text-base">{branchView.current ? `تعمل الآن ضمن فرع ${branchView.current.name}` : 'تعرض الآن جميع الفروع'}</h2>
                </div>
                <label className="flex w-full flex-col gap-1.5 sm:w-60">
                    <span className="gl-label">تغيير فرع العمل</span>
                    <select aria-label="تغيير فرع العمل" value={branchView.current?.id ?? ''} onChange={changeBranch} disabled={switching} className="h-11 w-full font-bold">
                        <option value="">جميع الفروع</option>
                        {branchView.options.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                </label>
            </div>
        </section>
    );
}
