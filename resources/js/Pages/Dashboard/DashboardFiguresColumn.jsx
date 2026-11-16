import { Link } from '@inertiajs/react';
import ChartStudio from '@/Components/ChartStudio';
import KpiTile from '@/Components/KpiTile';
import Panel from '@/Components/Panel';
import SplitBar from '@/Components/SplitBar';
import StatStrip, { ChangePill, Spark, Stat } from '@/Components/StatStrip';
import { formatMoney, formatNumber, formatShortDay, percentOf } from '@/lib/format';
import { TileLink } from './DashboardParts';

/** The home page's main column: collections, subscriptions, boxes, readings and disconnections for the period. */
export default function DashboardFiguresColumn({
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
    topBreaker,
    visit,
}) {
    return (
        <div className="gl-col">
            {collections && (
                <section className="gl-card gl-panel gl-rise" style={{ '--i': 1 }} aria-label="التحصيل">
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
                        title="أداء التحصيل"
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

            {(debts || collections) && (
                <div className="gl-grid gl-dashboard-details">
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

            {(meterBoxes || subscriptions) && (
                <div className="gl-grid gl-dashboard-details">
                    {meterBoxes && (
                        <TileLink href="/meter-boxes">
                            <KpiTile icon="table" label="الطبلونات" value={meterBoxes.total}
                                hint={readings ? 'قُرئ ' + percentOf(readings.approved + readings.pending, readings.total) + '% من العدادات هذا الأسبوع' : formatNumber(meterBoxes.empty) + ' بلا مشتركين نشطين'} />
                        </TileLink>
                    )}
                    {subscriptions && <KpiTile icon="bolt" label="الأمبير المتعاقد عليه" value={subscriptions.contractedAmperes} unit="أمبير"
                        hint={topBreaker ? 'الأكثر: قاطع ' + topBreaker.ampere + ' أمبير' : 'لا قواطع للمشتركين النشطين'} />}
                </div>
            )}
        </div>
    );
}
