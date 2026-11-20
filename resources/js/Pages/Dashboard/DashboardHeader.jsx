import Icon from '@/Components/Icon';
import WordReveal from '@/Components/WordReveal';
import { formatWeekDay } from '@/lib/weekDays';
import { SearchableSelect, SegmentedChoice } from '@/Components/UI';

/** The home page's heading, as in the redesign: the greeting and the day; the governorate and branch as filter pills, and the period. */
export default function DashboardHeader({
    auth,
    branchOptions,
    branchScope,
    branchView,
    filters,
    governorateOptions,
    greet,
    periodOptions,
    scope,
    scopeLine,
    visit,
}) {
    return (
        <div className="gl-phead gl-rise">
            <div className="min-w-0">
                <h1>
                    <WordReveal text={greet}>
                        <span>{auth.user.name}</span>
                    </WordReveal>
                </h1>
                <p>{[scopeLine, formatWeekDay(scope.today)].filter(Boolean).join('، ')}</p>
            </div>
            <div className="gl-phead-actions">
                {branchScope && governorateOptions.length > 0 && (
                    <SearchableSelect
                        variant="pill"
                        prefix={<span className="gl-filter-name"><Icon name="map" className="h-[15px] w-[15px]" /></span>}
                        className="gl-filter-item"
                        value={filters.governorate ?? ''}
                        onChange={(value) => visit({ governorate: value || null, branch: null })}
                        options={governorateOptions}
                        placeholder="كل المحافظات"
                        searchable={governorateOptions.length > 6}
                        active={Boolean(filters.governorate)}
                        portal
                        />
                )}
                {branchScope && (
                    <SearchableSelect
                        variant="pill"
                        prefix={<span className="gl-filter-name"><Icon name="building" className="h-[15px] w-[15px]" /></span>}
                        className="gl-filter-item"
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
                        placeholder="جميع الفروع"
                        searchPlaceholder="ابحث عن فرع..."
                        active={Boolean(filters.branch)}
                        portal
                        />
                )}
                {!scope.company && scope.label && (
                    <span className="gl-pill gl-info self-center">
                        <Icon name="lock" className="h-3.5 w-3.5" />
                        فرعك: {scope.label}
                    </span>
                )}
                <SegmentedChoice label="الفترة" value={filters.days} onChange={(days) => visit({ days })} options={periodOptions} />
            </div>
        </div>
    );
}
