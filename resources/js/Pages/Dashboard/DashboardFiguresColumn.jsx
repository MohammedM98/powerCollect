import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import ChartStudio from '@/Components/ChartStudio';
import KpiTile from '@/Components/KpiTile';
import Panel from '@/Components/Panel';
import SplitBar from '@/Components/SplitBar';
import StatStrip, { ChangePill, Spark, Stat } from '@/Components/StatStrip';
import { formatMoney, formatNumber, formatShortDay, percentOf } from '@/lib/format';
import { TileLink } from './DashboardParts';

/** The home page's main column: collections, subscriptions, boxes, readings and disconnections for the period. */
export default function DashboardFiguresColumn({
    attention,
    can,
    collections,
    debts,
    filters,
    meterBoxes,
    methodParts,
    openStatement,
    period,
    periodOptions,
    readings,
    subscriptions,
    tiles,
    topBreaker,
    visit,
}) {
    return (
        <div className="gl-col">
            {collections && (
                <section className="gl-glass gl-panel gl-rise" style={{ '--i': 1 }} aria-label="التحصيل">
                    <StatStrip>
                        <Stat
                            label="المحصّل اليوم"
                            value={collections.today.total}
                            unit="₪"
                            format={formatMoney}
                            hint={`${formatNumber(collections.today.count)} دفعة حتى الآن`}
                        />
                        <Stat
                            label={`آخر ${period}`}
                            value={collections.total}
                            unit="₪"
                            format={formatMoney}
                            badge={<ChangePill change={collections.change} />}
                            hint={`الفترة السابقة ${formatMoney(collections.previousTotal)} ₪`}
                        />
                        <Stat
                            label="دفعات الفترة"
                            value={collections.count}
                            hint={`نقدي ${formatMoney(collections.cash)} · حوالات ${formatMoney(collections.transfers)} ₪`}
                        >
                            <Spark values={collections.series.map((day) => Number(day.value) || 0)} />
                        </Stat>
                    </StatStrip>
                    <ChartStudio
                        title="استوديو التحصيل"
                        total={collections.total}
                        change={collections.change}
                        formatTotal={formatMoney}
                        series={collections.series}
                        dayLabel={formatShortDay}
                        periods={periodOptions}
                        period={filters.days}
                        onPeriodChange={(days) => visit({ days })}
                    />
                </section>
            )}
            {!collections && (
                <div className="gl-seg self-start" role="group" aria-label="الفترة">
                    {periodOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={filters.days === option.value}
                            onClick={() => visit({ days: option.value })}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}

            {(attention.length > 0 || debts !== null || collections) && (
                <div className="gl-grid gl-g3">
                    {attention.length > 0 && (
                        <Panel index={2} title="بانتظارك" sub="ما يحتاج متابعة اليوم">
                            {attention.map(({ key, icon, title, subtitle, count, href, tone }) => (
                                <Link key={key} href={href} prefetch={false} className="gl-attn">
                                    <span className="gl-dot" style={{ '--gl-c': tone === 'red' ? 'var(--gl-bad)' : 'var(--gl-warn)' }} />
                                    <span className="min-w-0 flex-1">
                                        <b className="block truncate font-semibold">{title}</b>
                                        <small className="gl-sub">{subtitle}</small>
                                    </span>
                                    <b className="gl-num">{formatNumber(count)}</b>
                                    <span className="!text-[color:var(--gl-faint)]">
                                        <Icon name={icon} className="h-4 w-4" />
                                    </span>
                                </Link>
                            ))}
                        </Panel>
                    )}
                    {debts === undefined ? (
                        <Panel index={3} title="أكبر المدينين">
                            <div className="space-y-3 py-2">
                                <div className="gl-skel" />
                                <div className="gl-skel w-2/3" />
                                <div className="gl-skel w-1/2" />
                            </div>
                        </Panel>
                    ) : (
                        debts && (
                            <Panel
                                index={3}
                                title="أكبر المدينين"
                                sub={`${formatNumber(debts.count)} مدين · ₪ ${formatMoney(debts.total)}`}
                                right={
                                    <Link href="/receivables" className="gl-btn gl-sec gl-sm">
                                        الكل
                                    </Link>
                                }
                            >
                                {debts.top.length === 0 ? (
                                    <p className="gl-empty-line">لا ديون مستحقة.</p>
                                ) : (
                                    debts.top.map((debtor) => (
                                        <div key={debtor.subscriptionId} className="gl-row">
                                            <div className="gl-av" style={{ color: 'var(--gl-bad)' }}>
                                                {(debtor.name ?? '').slice(0, 1)}
                                            </div>
                                            <div className="gl-t">
                                                <b>{debtor.name}</b>
                                                <small className="gl-num">
                                                    ₪ {formatMoney(debtor.balance)} · منذ {formatNumber(debtor.oldestDays)} يومًا
                                                </small>
                                            </div>
                                            {can?.viewSubscriptions && (
                                                <button
                                                    type="button"
                                                    className="gl-btn gl-sec gl-sm"
                                                    onClick={() => openStatement(debtor)}
                                                    aria-haspopup="dialog"
                                                    aria-label={`كشف حساب ${debtor.name}`}
                                                >
                                                    كشف
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </Panel>
                        )
                    )}
                    {collections && (
                        <Panel index={4} title="طرق الدفع" sub={`آخر ${period} · ₪ ${formatMoney(collections.total)}`}>
                            <SplitBar parts={methodParts} label="النقد والحوالات" formatValue={(value) => `₪ ${formatMoney(value)}`} />
                        </Panel>
                    )}
                </div>
            )}

            {tiles > 0 && (
                <div className="gl-grid gl-g4">
                    {subscriptions && (
                        <TileLink href="/subscriptions">
                            <KpiTile
                                hero
                                index={5}
                                icon="users"
                                label="المشتركون النشطون"
                                value={subscriptions.active}
                                hint={`من ${formatNumber(subscriptions.total)} · ${formatNumber(subscriptions.newInPeriod)} جديد في آخر ${period}`}
                            >
                                <div className="gl-split" role="img" aria-label="حالات المشتركين">
                                    {[
                                        [subscriptions.active, 'var(--gl-ok)'],
                                        [subscriptions.suspended, 'var(--gl-warn)'],
                                        [subscriptions.disconnected, 'var(--gl-faint)'],
                                    ].map(
                                        ([count, color], index) =>
                                            subscriptions.total > 0 &&
                                            count > 0 && (
                                                <i
                                                    key={color}
                                                    style={{ '--i': index, width: `${(count / subscriptions.total) * 100}%`, background: color }}
                                                />
                                            ),
                                    )}
                                </div>
                            </KpiTile>
                        </TileLink>
                    )}
                    {meterBoxes && (
                        <TileLink href="/meter-boxes">
                            <KpiTile
                                index={6}
                                icon="table"
                                label="الطبلونات"
                                value={meterBoxes.total}
                                hint={
                                    readings
                                        ? `قُرئ ${percentOf(readings.approved + readings.pending, readings.total)}% من العدادات هذا الأسبوع`
                                        : `${formatNumber(meterBoxes.empty)} بلا مشتركين نشطين`
                                }
                            />
                        </TileLink>
                    )}
                    {subscriptions && (
                        <KpiTile
                            index={7}
                            icon="bolt"
                            label="الأمبير المتعاقد عليه"
                            value={subscriptions.contractedAmperes}
                            unit="أمبير"
                            hint={topBreaker ? `الأكثر: قاطع ${topBreaker.ampere} أمبير (${topBreaker.share}%)` : 'لا قواطع للمشتركين النشطين'}
                        />
                    )}
                    {debts === undefined ? (
                        <div className="gl-glass gl-kpi">
                            <div className="gl-skel w-1/2" />
                            <div className="gl-skel mt-6 h-8 w-2/3" />
                        </div>
                    ) : (
                        debts && (
                            <TileLink href="/receivables">
                                <KpiTile
                                    index={8}
                                    icon="clock"
                                    label="الديون المستحقة"
                                    value={formatMoney(debts.total)}
                                    unit="₪"
                                    hint={`${formatNumber(debts.count)} مدين · أكثر من 90 يومًا ${debts.olderShare}%`}
                                />
                            </TileLink>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
