import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import SearchableSelect from '@/Components/SearchableSelect';
import WordReveal from '@/Components/WordReveal';
import { formatWeekDay } from '@/lib/weekDays';

/** The home page's heading: the greeting, the period tabs and the quick actions. */
export default function DashboardHeader({
    auth,
    branchOptions,
    branchScope,
    branchView,
    can,
    canCreateBranch,
    canCreateUser,
    filters,
    governorateOptions,
    greet,
    openCreateForm,
    scope,
    scopeLine,
    setFindingPayer,
    visit,
}) {
    return (
        <div className="gl-phead gl-rise">
            <div className="min-w-0">
                <h1>
                    <WordReveal text={greet}>
                        <span className="!text-[rgb(var(--gl-brand))]">{auth.user.name}</span>
                    </WordReveal>
                </h1>
                <p>{[scopeLine, formatWeekDay(scope.today)].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="gl-phead-actions">
                {branchScope && governorateOptions.length > 0 && (
                    <div className="w-full sm:w-52">
                        <SearchableSelect
                            value={filters.governorate ?? ''}
                            onChange={(value) => visit({ governorate: value || null, branch: null })}
                            options={governorateOptions}
                            placeholder="كل المحافظات"
                            searchable={governorateOptions.length > 6}
                            active={Boolean(filters.governorate)}
                            portal
                        />
                    </div>
                )}
                {branchScope && (
                    <div className="w-full sm:w-52">
                        <SearchableSelect
                            value={branchView.available ? String(branchView.value) : (filters.branch ?? '')}
                            onChange={branchView.available ? branchView.changeBranch : (value) => visit({ branch: value || null })}
                            options={
                                branchView.available
                                    ? branchView.options
                                    : branchOptions.filter(
                                          (branch) => !filters.governorate || String(branch.governorate) === String(filters.governorate),
                                      )
                            }
                            disabled={branchView.switching}
                            placeholder="كل الفروع"
                            searchPlaceholder="ابحث عن فرع..."
                            active={Boolean(filters.branch)}
                            portal
                        />
                    </div>
                )}
                {!scope.company && scope.label && (
                    <span className="gl-pill gl-info self-center">
                        <Icon name="lock" className="h-3.5 w-3.5" />
                        فرعك: {scope.label}
                    </span>
                )}
                {canCreateBranch ? (
                    <button type="button" className="gl-btn gl-sec" onClick={() => openCreateForm('branch')}>
                        <Icon name="plus" className="h-4 w-4" />
                        فرع جديد
                    </button>
                ) : canCreateUser ? (
                    <button type="button" className="gl-btn gl-sec" onClick={() => openCreateForm('user')}>
                        <Icon name="plus" className="h-4 w-4" />
                        مستخدم جديد
                    </button>
                ) : null}
                {can?.recordPayments &&
                    (can?.viewSubscriptions ? (
                        <button type="button" className="gl-btn" onClick={() => setFindingPayer(true)} aria-haspopup="dialog">
                            <Icon name="plus" className="h-4 w-4" />
                            تسجيل دفعة
                        </button>
                    ) : (
                        <Link href="/payments" className="gl-btn">
                            <Icon name="plus" className="h-4 w-4" />
                            تسجيل دفعة
                        </Link>
                    ))}
            </div>
        </div>
    );
}
