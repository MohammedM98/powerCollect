import { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import Icon from '@/Components/Icon';

/** The working branch the page shows when it has no branch bar of its own, and how to change it; null when there is none to show. */
function useWorkingBranch() {
    const { branchView } = usePage().props;
    const [switching, setSwitching] = useState(false);
    const shown = Boolean(branchView);

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
 * The super admin's working branch in the top bar, on every page and every
 * screen: the branch's name (or all branches) and the picker that changes
 * it; the choice stays for the rest of their visit, across pages.
 */
export function WorkingBranchChip() {
    const working = useWorkingBranch();

    if (!working) {
        return null;
    }

    const { branchView, switching, changeBranch } = working;

    return (
        <label className="tn-branch-chip" title="فرع العمل: يبقى اختيارك معك أثناء التنقل حتى تغيّره">
            <Icon name="building" className="h-[18px] w-[18px]" />
            <select aria-label="تغيير فرع العمل" value={branchView.current?.id ?? ''} onChange={changeBranch} disabled={switching}>
                <option value="">كل الفروع</option>
                {branchView.options.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <Icon name="chevron-down" className="h-3.5 w-3.5" />
        </label>
    );
}
