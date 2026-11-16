import KpiTile from '@/Components/KpiTile';
import { formatMoney, formatNumber, percentOf } from '@/lib/format';
import { TileLink } from './DashboardParts';

/** The home page's overview row: active subscribers, meter boxes, contracted amperes and the debts owed, each opening its page. */
export default function DashboardTiles({ subscriptions, meterBoxes, readings, debts, period, topBreaker }) {
    const tiles = [subscriptions, meterBoxes, subscriptions, debts !== null].filter(Boolean).length;

    if (tiles === 0) {
        return null;
    }

    return (
        <div className="gl-grid gl-g4">
            {subscriptions && (
                <TileLink href="/subscriptions">
                    <KpiTile
                        hero
                        index={2}
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
                                    count > 0 && <i key={color} style={{ '--i': index, width: `${(count / subscriptions.total) * 100}%`, background: color }} />,
                            )}
                        </div>
                    </KpiTile>
                </TileLink>
            )}
            {meterBoxes && (
                <TileLink href="/meter-boxes">
                    <KpiTile
                        index={3}
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
                    index={4}
                    icon="bolt"
                    label="الأمبير المتعاقد عليه"
                    value={subscriptions.contractedAmperes}
                    unit="أمبير"
                    hint={topBreaker ? `الأكثر: قاطع ${topBreaker.ampere} أمبير (${topBreaker.share}%)` : 'لا قواطع للمشتركين النشطين'}
                />
            )}
            {debts === undefined ? (
                <div className="gl-card gl-kpi">
                    <div className="gl-skel w-1/2" />
                    <div className="gl-skel mt-6 h-8 w-2/3" />
                </div>
            ) : (
                debts && (
                    <TileLink href="/receivables">
                        <KpiTile
                            index={5}
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
    );
}
