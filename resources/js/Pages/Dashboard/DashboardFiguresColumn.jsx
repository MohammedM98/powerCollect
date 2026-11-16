import { Link } from '@inertiajs/react';
import Icon from '@/Components/Icon';
import ChartStudio from '@/Components/ChartStudio';
import Panel from '@/Components/Panel';
import SplitBar from '@/Components/SplitBar';
import StatStrip, { ChangePill, Spark, Stat } from '@/Components/StatStrip';
import { formatMoney, formatNumber, formatShortDay } from '@/lib/format';

/** The home page's main column: the period's collections and chart, what waits on someone, the largest debtors and how people paid. */
export default function DashboardFiguresColumn({
    attention,
    can,
    collections,
    debts,
    filters,
    methodParts,
    openStatement,
    period,
    periodOptions,
    visit,
}) {
    return (
        <div className="gl-col">
            {collections && (
                <section className="gl-card gl-panel gl-rise" style={{ '--i': 6 }} aria-label="التحصيل">
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
                        <Panel index={7} title="بانتظارك" sub="ما يحتاج متابعة اليوم">
                            {attention.map(({ key, icon, title, subtitle, count, href, tone }) => (
                                <Link key={key} href={href} prefetch={false} className="gl-attn">
                                    <span className="gl-ico">
                                        <Icon name={icon} className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <b className="block truncate font-semibold">{title}</b>
                                        <small className="gl-sub">{subtitle}</small>
                                    </span>
                                    {/* Nothing waiting reads green and quiet; something waiting takes its tone, so the eye lands on it first. */}
                                    <span className={`gl-pill gl-num ${count > 0 ? (tone === 'red' ? 'gl-bad' : 'gl-warn') : 'gl-ok'}`}>{formatNumber(count)}</span>
                                </Link>
                            ))}
                        </Panel>
                    )}
                    {debts === undefined ? (
                        <Panel index={8} title="أكبر المدينين">
                            <div className="space-y-3 py-2">
                                <div className="gl-skel" />
                                <div className="gl-skel w-2/3" />
                                <div className="gl-skel w-1/2" />
                            </div>
                        </Panel>
                    ) : (
                        debts && (
                            <Panel
                                index={8}
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
                        <Panel index={9} title="طرق الدفع" sub={`آخر ${period} · ₪ ${formatMoney(collections.total)}`}>
                            <SplitBar parts={methodParts} label="النقد والحوالات" formatValue={(value) => `₪ ${formatMoney(value)}`} />
                        </Panel>
                    )}
                </div>
            )}
        </div>
    );
}
