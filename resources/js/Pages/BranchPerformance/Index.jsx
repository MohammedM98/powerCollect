import { Head, Link, router } from '@inertiajs/react';
import { Card, Chip } from '@heroui/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sparkline from '@/Components/Charts/Sparkline';
import { Figure, ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable, SegmentedChoice } from '@/Components/UI';
import { formatMoney, formatNumber, percentOf, timeAgo } from '@/lib/format';
import { branchPlace } from './BranchMark';
import PageHeader from '@/Components/PageHeader';

const SORTS = [
    { value: 'collection', label: 'نسبة التحصيل' },
    { value: 'revenue', label: 'التحميلات' },
    { value: 'debts', label: 'الديون' },
    { value: 'subscriptions', label: 'المشتركون' },
    { value: 'activity', label: 'النشاط' },
];

const rate = (collected, charged) => (Number(charged) > 0 ? Math.round((Number(collected) / Number(charged)) * 100) : null);

/** A branch's collection rate as a bar with its figure, green from 70%, amber from 40%, red below. */
function RateBar({ value }) {
    if (value === null) {
        return <Chip size="sm" variant="soft" className="gl-bp-none">لا تحميل</Chip>;
    }
    const tone = value >= 70 ? 'pay' : value >= 40 ? 'warn' : 'owe';

    return (
        <span className="gl-bp-rate" data-tone={tone}>
            <span className="gl-rp-share"><span style={{ width: `${Math.min(100, value)}%` }} /></span>
            <b>{value}%</b>
        </span>
    );
}

/**
 * How every branch is doing, for the Super Admin, as one league table: the
 * totals across branches, then each branch ranked by the chosen figure —
 * what it charged and collected, its collection rate, what its subscribers
 * owe and how much of that is over 90 days, its last two weeks' entries,
 * its subscribers and its latest entry. A branch's name opens its page.
 */
export default function Index({ sort, summary, branches }) {
    function changeSort(next) {
        router.get('/branch-performance', next === 'revenue' ? {} : { sort: next }, { preserveState: true, preserveScroll: true, replace: true });
    }

    const totalRate = rate(summary.collectedTotal, summary.chargesTotal);
    const quiet = branches.filter((branch) => branch.weekEntries === 0).length;

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    eyebrow={`${formatNumber(summary.branches)} فروع، ${formatNumber(summary.activeBranches)} نشطة`}
                    title="أداء الفروع"
                    info="ترتيب الفروع بأرقامها منذ البداية: التحميلات والتحصيل والديون والنشاط. اضغط اسم الفرع لتفاصيل عمله اليومية."
                />
            }
        >
            <Head title="أداء الفروع" />

            <div className="gl-rp-figs">
                <Figure dark label="المقبوضات، كل الفروع" hint={`من ${formatMoney(summary.chargesTotal)} ₪ تحميلات، منذ البداية`}><bdi dir="ltr">{formatMoney(summary.collectedTotal)}</bdi> <span className="gl-rp-unit">₪</span></Figure>
                <Figure tone="pay" label="نسبة التحصيل" hint="المقبوضات ÷ التحميلات">{totalRate === null ? '—' : `${totalRate}%`}</Figure>
                <Figure tone="owe" label="الديون الآن" hint={`منها ${formatMoney(summary.older)} ₪ أكثر من 90 يومًا`}><bdi dir="ltr">{formatMoney(summary.owed)}</bdi> <span className="gl-rp-unit">₪</span></Figure>
                <Figure tone={quiet > 0 ? 'warn' : null} label="الفروع النشطة" hint={`${formatNumber(summary.weekEntries)} إدخال في 7 أيام، ${formatNumber(summary.staff)} موظف`}>{formatNumber(branches.length - quiet)} <span className="gl-rp-unit">من {formatNumber(branches.length)}</span></Figure>
            </div>

            <Card className="gl-rp-panel gl-bp" data-excel-source="custom">
                <Card.Header className="gl-rp-head">
                    <span className="gl-bp-sort-label">ترتيب حسب</span>
                    <SegmentedChoice label="ترتيب الفروع" value={sort} onChange={changeSort} options={SORTS} />
                </Card.Header>
                <Card.Content>
                    {branches.length === 0 ? (
                        <p className="gl-rp-empty">لا توجد فروع بعد.</p>
                    ) : (
                        <div className="gl-rp-scroll">
                            <ListTable className="gl-rp-table" aria-label="ترتيب الفروع">
                                <ListHeader>
                                    <ListColumn id="rank"><span className="sr-only">الترتيب</span></ListColumn>
                                    <ListColumn id="name" isRowHeader>الفرع</ListColumn>
                                    <ListColumn id="charges" className="num">التحميلات</ListColumn>
                                    <ListColumn id="collected" className="num">المقبوضات</ListColumn>
                                    <ListColumn id="rate">نسبة التحصيل</ListColumn>
                                    <ListColumn id="owed" className="num">الديون</ListColumn>
                                    <ListColumn id="older" className="num">+90 يومًا</ListColumn>
                                    <ListColumn id="sparkline">آخر 14 يومًا</ListColumn>
                                    <ListColumn id="subscriptions">المشتركون</ListColumn>
                                    <ListColumn id="last">آخر حركة</ListColumn>
                                </ListHeader>
                                <ListBody>
                                    {branches.map((branch) => (
                                        <ListRow key={branch.id} id={branch.id} data-quiet={branch.weekEntries === 0 || undefined}>
                                            <ListCell><span className="gl-bp-rank" data-top={branch.rank === 1 || undefined}>{branch.rank}</span></ListCell>
                                            <ListCell>
                                                <Link href={`/branch-performance/${branch.id}`} className="gl-bp-name">{branch.name}</Link>
                                                <small className="gl-bp-place">{[branchPlace(branch), `${formatNumber(branch.staff)} موظف`, !branch.isActive && 'متوقف'].filter(Boolean).join('، ')}</small>
                                            </ListCell>
                                            <ListCell className="num"><bdi dir="ltr">{formatMoney(branch.chargesTotal)}</bdi></ListCell>
                                            <ListCell className="num" data-tone="pay"><b><bdi dir="ltr">{formatMoney(branch.collectedTotal)}</bdi></b></ListCell>
                                            <ListCell><RateBar value={branch.collectionRate} /></ListCell>
                                            <ListCell className="num" data-tone={Number(branch.owed) > 0 ? 'owe' : undefined}><bdi dir="ltr">{formatMoney(branch.owed)}</bdi><small className="gl-bp-place">{formatNumber(branch.debtors)} مدين</small></ListCell>
                                            <ListCell className="num" data-tone={Number(branch.older) > 0 ? 'owe' : undefined}><bdi dir="ltr">{formatMoney(branch.older)}</bdi></ListCell>
                                            <ListCell><Sparkline values={branch.sparkline} label={`إدخالات ${branch.name} في آخر 14 يومًا`} className="h-7 w-24" /></ListCell>
                                            <ListCell>{formatNumber(branch.activeSubscriptions)} نشط<small className="gl-bp-place">{percentOf(branch.activeSubscriptions, branch.subscriptions)}% من {formatNumber(branch.subscriptions)}</small></ListCell>
                                            <ListCell>{branch.lastEntryAt ? timeAgo(branch.lastEntryAt) : <Chip size="sm" variant="soft" className="gl-bp-none" data-tone="warn">لا حركة</Chip>}</ListCell>
                                        </ListRow>
                                    ))}
                                    <ListRow id="totals" className="is-total">
                                        <ListCell />
                                        <ListCell>المجموع، {formatNumber(summary.branches)} فروع</ListCell>
                                        <ListCell className="num"><bdi dir="ltr">{formatMoney(summary.chargesTotal)}</bdi></ListCell>
                                        <ListCell className="num"><bdi dir="ltr">{formatMoney(summary.collectedTotal)}</bdi></ListCell>
                                        <ListCell>{totalRate === null ? '—' : `${totalRate}%`}</ListCell>
                                        <ListCell className="num"><bdi dir="ltr">{formatMoney(summary.owed)}</bdi></ListCell>
                                        <ListCell className="num"><bdi dir="ltr">{formatMoney(summary.older)}</bdi></ListCell>
                                        <ListCell>{formatNumber(summary.weekEntries)} في 7 أيام</ListCell>
                                        <ListCell>{formatNumber(summary.activeSubscriptions)} نشط</ListCell>
                                        <ListCell />
                                    </ListRow>
                                </ListBody>
                            </ListTable>
                        </div>
                    )}
                </Card.Content>
            </Card>
        </AuthenticatedLayout>
    );
}
