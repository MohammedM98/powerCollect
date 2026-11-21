import { Button } from '@heroui/react';
import { Link } from '@inertiajs/react';
import Icon from '@/Components/UI/Icon';
import ChartStudio from '@/Components/Charts/ChartStudio';
import CountUp from '@/Components/Charts/CountUp';
import Panel from '@/Components/Panel';
import SplitBar from '@/Components/Charts/SplitBar';
import { ChangePill } from '@/Components/Charts/StatStrip';
import { formatMoney, formatNumber, formatShortDay, percentOf } from '@/lib/format';

/**
 * The period's collections as the redesign's hero card: the total with its
 * change against the period before, three small tiles (today, the period's
 * payments, how people paid), and the chart across the card's foot.
 */
export function CollectionsHero({ collections, period, filters }) {
    const cashShare = percentOf(collections.cash, Number(collections.cash) + Number(collections.transfers));

    return (
        <section className="gl-card gl-panel gl-rise gl-hero-collect" style={{ '--i': 3 }} aria-label="التحصيل">
            <div className="gl-hero-collect-head">
                <h2>
                    المحصّل في آخر {period}
                    <ChangePill change={collections.change} />
                </h2>
                <b className="gl-hero-collect-total gl-num">
                    <CountUp value={collections.total} format={formatMoney} /> <span>₪</span>
                </b>
                <small>الفترة السابقة <b className="gl-num">{formatMoney(collections.previousTotal)} ₪</b></small>
            </div>
            <div className="gl-hero-collect-tiles">
                <div>
                    <small>المحصّل اليوم</small>
                    <b className="gl-num">{formatMoney(collections.today.total)} <span>₪</span></b>
                    <span>{formatNumber(collections.today.count)} دفعة حتى الآن</span>
                </div>
                <div>
                    <small>دفعات الفترة</small>
                    <b className="gl-num">{formatNumber(collections.count)}</b>
                    <span>نقدي {formatMoney(collections.cash)}، حوالات {formatMoney(collections.transfers)} ₪</span>
                </div>
                <div>
                    <small>طرق الدفع</small>
                    <i className="gl-hero-collect-split" aria-hidden="true"><span style={{ width: `${cashShare}%` }} /></i>
                    <span>نقدي {cashShare}%، حوالات {100 - cashShare}%</span>
                </div>
            </div>
            <ChartStudio bare title="التحصيل" total={collections.total} change={collections.change} formatTotal={formatMoney} series={collections.series} dayLabel={formatShortDay} period={filters.days} />
        </section>
    );
}

/** What waits on someone: each count opens its page; nothing waiting reads green and quiet. */
export function AttentionPanel({ attention }) {
    return (
        <Panel index={2} title="بانتظارك" sub="ما يحتاج متابعة اليوم">
            {attention.map(({ key, icon, title, subtitle, count, href, tone }) => (
                <Link key={key} href={href} prefetch={false} className="gl-attn">
                    <span className="gl-ico">
                        <Icon name={icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <b className="block truncate font-semibold">{title}</b>
                        <small className="gl-sub">{subtitle}</small>
                    </span>
                    <span className={`gl-pill gl-num ${count > 0 ? (tone === 'red' ? 'gl-bad' : 'gl-warn') : 'gl-ok'}`}>{formatNumber(count)}</span>
                    <Icon name="chevron-left" className="h-4 w-4 shrink-0 text-gray-400" />
                </Link>
            ))}
        </Panel>
    );
}

/** The largest debts, each opening its statement; a skeleton while they load. */
export function DebtorsPanel({ debts, can, openStatement }) {
    if (debts === undefined) {
        return (
            <Panel index={8} title="أكبر المدينين">
                <div className="space-y-3 py-2">
                    <div className="gl-skel" />
                    <div className="gl-skel w-2/3" />
                    <div className="gl-skel w-1/2" />
                </div>
            </Panel>
        );
    }

    if (!debts) {
        return null;
    }

    return (
        <Panel
            index={8}
            title="أكبر المدينين"
            sub={`${formatNumber(debts.count)} مدين، ${formatMoney(debts.total)} ₪`}
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
                        <div className="gl-av gl-av-bad">{(debtor.name ?? '').slice(0, 1)}</div>
                        <div className="gl-t">
                            <b>{debtor.name}</b>
                            <small className="gl-num">
                                {formatMoney(debtor.balance)} ₪، منذ {formatNumber(debtor.oldestDays)} يومًا
                            </small>
                        </div>
                        {can?.viewSubscriptions && (
                            <Button data-raw="" variant="ghost" className="gl-btn gl-sec gl-sm" onClick={() => openStatement(debtor)} aria-haspopup="dialog" aria-label={`كشف حساب ${debtor.name}`}>
                                كشف
                            </Button>
                        )}
                    </div>
                ))
            )}
        </Panel>
    );
}

/** How the period's money came in: cash and transfers, with their totals and shares. */
export function MethodsPanel({ collections, methodParts, period }) {
    return (
        <Panel index={13} title="طرق الدفع" sub={`آخر ${period}، ${formatMoney(collections.total)} ₪`}>
            <SplitBar parts={methodParts} label="النقد والحوالات" formatValue={(value) => `${formatMoney(value)} ₪`} />
        </Panel>
    );
}
