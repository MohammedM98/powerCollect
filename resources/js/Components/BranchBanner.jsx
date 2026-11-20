import ChoiceSelect from '@/Components/ChoiceSelect';
import { Link } from '@inertiajs/react';
import { useState } from 'react';
import Icon from '@/Components/Icon';
import SearchableSelect from '@/Components/SearchableSelect';
import { formatNumber } from '@/lib/format';
import { useBranchView } from '@/hooks/useBranchView';

/**
 * Shows whose figures the page contains: one branch's name, place, phone and
 * subscribers, a governorate's with how many branches
 * it has, or "جميع الفروع" with how many — so whoever sees more than one
 * branch never mistakes one branch's money for another's. `scope` is what App\Support\BranchScope::describe() sends.
 * With more than one `options` ({ value, label }), the branch is changed
 * here (`allValue` is the choice for every branch); a page with its own
 * pickers passes them as `controls` instead; `meta` adds a fact to
 * the line under the name (the period, say) and `children` a row under it
 * (a chip per branch when all are shown). On paper it prints as the
 * page's heading, without the colours and the controls. `className`
 * replaces its space below, for a page that spaces its parts itself. On a
 * phone the lead-in line is left to the chip and the pickers sit side by
 * side.
 */
/** "فرع واحد", "فرعان", "5 فروع", "12 فرعاً": a count of branches as Arabic says it. */
function branchCount(count) {
    if (count === 1) {
        return 'فرع واحد';
    }

    if (count === 2) {
        return 'فرعان';
    }

    return `${formatNumber(count)} ${count % 100 >= 3 && count % 100 <= 10 ? 'فروع' : 'فرعاً'}`;
}

export default function BranchBanner({ scope, eyebrow = 'تعرض الآن البيانات المالية لـ', allLabel = 'تقرير مجمّع', options = [], value = '', allValue = 'all', onChange = null, controls = null, ownControls = false, meta = null, children = null, className = 'mb-5' }) {
    const view = useBranchView();
    // The working branch is picked in the top bar (WorkingBranchChip) and kept across pages; the banner then only prints.
    const printOnly = view.available && !ownControls;
    const pickerOptions = view.available ? view.options : options;
    const pickerValue = view.available ? view.value || allValue : value;
    const pick = view.available ? view.changeBranch : onChange;
    const facts = [
        scope.place && { icon: 'pin', text: scope.place },
        scope.all && { icon: 'building', text: branchCount(scope.branches) },
        { icon: 'users', text: `${formatNumber(scope.subscribers)} مشترك` },
        scope.phone && { icon: 'phone', text: <bdi>{scope.phone}</bdi> },
        meta && { icon: 'calendar', text: meta },
    ].filter(Boolean);

    return (
        <section aria-label="الفرع المعروض" className={`gl-scope ${printOnly ? 'hidden print:block' : ''} print:mb-4 print:rounded-none print:border-0 print:border-b-2 print:border-[rgb(var(--brand-500))] print:bg-none print:p-0 print:pb-3 print:text-[rgb(var(--graphite-900))] print:shadow-none ${className}`}>
            <div className="gl-scope-row">
                <span aria-hidden="true" className="gl-scope-ico print:hidden">
                    <Icon name={scope.level === 'governorate' ? 'map' : scope.all ? 'layers' : 'building'} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="gl-scope-eyebrow">
                        <span className="hidden sm:inline print:inline">{eyebrow}</span>
                        <span className="gl-pill print:hidden" style={{ '--gl-c': scope.level === 'governorate' ? 'var(--gl-info)' : scope.all ? 'var(--gl-warn)' : scope.isActive ? 'var(--gl-ok)' : 'var(--gl-faint)' }}>
                            {scope.level === 'governorate' ? `محافظة، ${branchCount(scope.branches)}` : scope.all ? `${allLabel}، ${branchCount(scope.branches)}` : scope.isActive ? 'فرع واحد' : 'فرع واحد، متوقف'}
                        </span>
                    </p>
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <h2 className="gl-scope-name" dir="auto">{scope.name}</h2>
                        <ul className="gl-scope-facts print:text-[rgb(var(--silver-900))]">
                            {facts.map((fact) => (
                                <li key={fact.icon}>
                                    <Icon name={fact.icon} className="h-3.5 w-3.5 shrink-0 print:hidden" />
                                    <span className="gl-num">{fact.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                {controls && <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-end sm:gap-3 print:hidden">{controls}</div>}
                {!controls && pick && pickerOptions.length > 1 && (
                    <label className="flex w-full flex-col gap-1.5 sm:w-60 print:hidden">
                        <span className="gl-label">تغيير الفرع</span>
                        <span className="relative">
                            <ChoiceSelect
                                aria-label="تغيير الفرع"
                                value={pickerValue ?? ''}
                                disabled={view.switching}
                                onChange={(event) => pick(event.target.value)}
                                className="h-10 w-full appearance-none bg-none pe-10 ps-3.5 font-bold"
                            >
                                <option value={allValue}>جميع الفروع (تقرير مجمّع)</option>
                                {pickerOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </ChoiceSelect>
                            <Icon name="chevron-down" className="pointer-events-none absolute inset-e-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                        </span>
                    </label>
                )}
            </div>
            {children && <div className="mt-3 flex flex-wrap gap-2 border-t pt-3 print:hidden border-(--gl-line)!">{children}</div>}
        </section>
    );
}

/**
 * A list page's table filters, split for the banner: the `branch_id`
 * group (when the page has a banner) goes to the banner's picker, the
 * rest stay in the table's filter menu, which neither counts the branch
 * nor clears it.
 */
export function splitBranchFilter(scope, groups, values) {
    const branch = scope ? (groups ?? []).find((group) => group.key === 'branch_id') ?? null : null;

    return {
        branch,
        groups: branch ? groups.filter((group) => group !== branch) : groups,
        values: branch ? Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'branch_id')) : values,
        kept: branch ? ['branch_id'] : [],
        /** Clears the menu's filters, keeping the banner's branch. */
        clear: (setFilters, clearFilters) => (branch ? setFilters(Object.fromEntries(Object.keys(values).filter((key) => key !== 'branch_id').map((key) => [key, '']))) : clearFilters()),
    };
}

/**
 * The banner of a list page whose table narrows to one branch: the branch's
 * name, with the branch picked in it. `allowAll={false}` leaves out the
 * choice of every branch, for a page that always shows one.
 */
export function BranchFilterBanner({ scope, eyebrow, group, value, onChange, allowAll = true }) {
    const view = useBranchView();
    const options = view.available ? view.options : group?.options;
    return (
        <BranchBanner
            scope={scope}
            eyebrow={eyebrow}
            controls={
                options && (
                    <label className="gl-label flex w-full flex-col gap-1.5 sm:w-64">
                        الفرع
                        <SearchableSelect
                            value={view.available ? String(view.value) : value ?? ''}
                            onChange={view.available ? view.changeBranch : onChange}
                            options={options}
                            disabled={view.switching}
                            placeholder={allowAll ? (view.available ? 'جميع الفروع' : scope.allName ?? 'جميع الفروع') : scope.name}
                            searchPlaceholder="ابحث عن فرع..."
                            active={allowAll && Boolean(view.available ? view.value : value)}
                            clearable={allowAll}
                            portal
                        />
                    </label>
                )
            }
        />
    );
}

/**
 * The banner's row when every branch is shown: the branches with the
 * largest figure first, a few of them, then a button for the rest, so a
 * company of many branches keeps a short banner. Each item is
 * { key, href, name, figure, amount }, `amount` ordering them.
 */
export function BranchChips({ items, limit = 6 }) {
    const [showingAll, setShowingAll] = useState(false);
    const ordered = [...items].sort((first, second) => second.amount - first.amount);
    const shown = showingAll ? ordered : ordered.slice(0, limit);

    return (
        <>
            {shown.map((item) => (
                <BranchChip key={item.key} as={Link} href={item.href} name={item.name} figure={item.figure} />
            ))}
            {ordered.length > limit && (
                <BranchChip onClick={() => setShowingAll(!showingAll)} aria-expanded={showingAll} name={showingAll ? 'عرض أقل' : `+ ${formatNumber(ordered.length - limit)} فروع أخرى`} />
            )}
        </>
    );
}

/** A branch's button in the banner's row when every branch is shown, with a figure of its own (its collection, say). */
export function BranchChip({ href, onClick, name, figure = null, as: Element = 'button', ...props }) {
    return (
        <Element
            {...(Element === 'button' ? { type: 'button', onClick } : { href })}
            {...props}
            className="gl-chip gl-chip-sm"
        >
            {name}
            {figure && <small className="gl-num text-xs">{figure}</small>}
        </Element>
    );
}
