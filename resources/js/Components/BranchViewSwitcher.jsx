import { usePage } from '@inertiajs/react';
import { useBranchView } from '@/hooks/useBranchView';
import Icon from '@/Components/Icon';

/** The working branch and how to change it (the same way a page's banner did: kept for the visit, the page narrowed to it); null when there is none. */
function useWorkingBranch() {
    const { branchView } = usePage().props;
    const view = useBranchView();

    return branchView ? { branchView, switching: view.switching, changeBranch: (event) => view.changeBranch(event.target.value) } : null;
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
