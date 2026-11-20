import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { Card, Chip, Switch, Label } from '@heroui/react';
import Icon from '@/Components/Icon';
import { cents, reportMoney, shortDate } from '@/lib/reportFormatting';
import { weekDayName } from '@/lib/weekDays';

/** Whole shekels' share of a total, as a percentage (0 when there is nothing to divide). */
const share = (part, whole) => (cents(whole) > 0 ? Math.round((cents(part) / cents(whole)) * 100) : 0);

/** A money figure, its shekel sign beside it. */
function Shekels({ value }) {
    return <><bdi dir="ltr">{reportMoney(value)}</bdi> <span className="gl-rp-unit">₪</span></>;
}

/** One headline figure on a HeroUI card: `tone` colours its mark and number, `dark` puts it on the charcoal. */
export function Figure({ label, children, hint = null, tone = null, dark = false, ...props }) {
    return (
        <Card className="gl-rp-fig" data-tone={tone ?? undefined} data-dark={dark || undefined} {...props}>
            <small>{tone && <i aria-hidden="true" />}{label}</small>
            <b>{children}</b>
            {hint && <p>{hint}</p>}
        </Card>
    );
}

/** A report section's glass card: its icon tile, title and a line, then its content. */
function Panel({ icon, tone = 'brand', title, note = null, aside = null, children, flush = false }) {
    // The page's own Excel exports every part of the report, so a panel's table gets no button of its own.
    return (
        <Card className="gl-rp-panel" data-tone={tone} data-flush={flush || undefined} data-excel-source="custom">
            <Card.Header className="gl-rp-head">
                <span className="gl-set-ico" aria-hidden="true"><Icon name={icon} /></span>
                <Card.Title className="gl-set-title">{title}</Card.Title>
                {note && <span className="gl-rp-note">{note}</span>}
                {aside}
            </Card.Header>
            <Card.Content className="gl-rp-body">{children}</Card.Content>
        </Card>
    );
}

/** A thin bar for a share of a total. */
function ShareBar({ value, tone = 'pay' }) {
    return <span className="gl-rp-share" data-tone={tone}><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></span>;
}

/**
 * The overview, as a period's financial statement: the receivables
 * equation, the receipts reconciled from recorded to confirmed, each
 * branch's receipts and collection rate, and the readings of the period.
 */
export function OverviewView({ flow, collections, comparison = null, branchSummary = [], readings }) {
    const receipts = collections.receipts;
    const charged = flow.charges.map((line) => line.label).join(' و');
    const credited = flow.credits.map((line) => `${reportMoney(line.total)} ${line.label}`).join('، ');
    const collectionRate = share(collections.total, flow.chargesTotal);
    const branches = branchSummary.filter((row) => cents(row.collections.total) > 0 || cents(row.flow.chargesTotal) > 0);
    const quiet = branchSummary.length - branches.length;
    const branchTotal = branchSummary.reduce((sum, row) => sum + cents(row.collections.total), 0) / 100;
    const branchCharges = branchSummary.reduce((sum, row) => sum + cents(row.flow.chargesTotal), 0) / 100;

    return (
        <>
            <section className="gl-eq" aria-label="معادلة الفترة">
                <Card className="gl-eq-term"><small>الرصيد الافتتاحي</small><b><Shekels value={flow.opening} /></b><p>على المشتركين في بداية الفترة</p></Card>
                <span className="gl-eq-op" aria-hidden="true">+</span>
                <Card className="gl-eq-term" data-tone="owe"><small><i aria-hidden="true" />التحميلات (مدين)</small><b><Shekels value={flow.chargesTotal} /></b><p>{charged || 'لا تحميلات في الفترة'}</p></Card>
                <span className="gl-eq-op" aria-hidden="true">−</span>
                <Card className="gl-eq-term" data-tone="pay"><small><i aria-hidden="true" />المقبوضات والخصومات (دائن)</small><b><Shekels value={flow.creditsTotal} /></b><p>{credited || 'لا مقبوضات في الفترة'}</p></Card>
                {cents(flow.corrections.total) !== 0 && <>
                    <span className="gl-eq-op" aria-hidden="true">±</span>
                    <Card className="gl-eq-term"><small>الإلغاءات والقيود العكسية</small><b><Shekels value={flow.corrections.total} /></b><p>{flow.corrections.count} قيد</p></Card>
                </>}
                <span className="gl-eq-op" aria-hidden="true">=</span>
                <Card className="gl-eq-term is-total"><small>الرصيد الختامي</small><b><Shekels value={flow.closing} /></b><p>نسبة التحصيل {collectionRate}%</p></Card>
            </section>

            {comparison && <section aria-label="المقارنة بالفترة السابقة" className="gl-rp-compare">
                <span className="gl-set-ico" data-tone={cents(comparison.difference) >= 0 ? 'pay' : 'owe'} aria-hidden="true"><Icon name="trend" /></span>
                <div className="min-w-0">
                    <b>المقبوضات مقارنة بالفترة السابقة</b>
                    <small>{shortDate(comparison.from, true)} إلى {shortDate(comparison.to, true)}، حُصّل فيها <bdi dir="ltr">{reportMoney(comparison.total)}</bdi> ₪</small>
                </div>
                <span className="gl-rp-delta" data-tone={cents(comparison.difference) >= 0 ? 'pay' : 'owe'}>
                    {cents(comparison.difference) >= 0 ? 'زيادة' : 'انخفاض'} <bdi dir="ltr">{reportMoney(Math.abs(Number(comparison.difference)))}</bdi> ₪{comparison.percentage !== null && <> (<bdi dir="ltr">{Math.abs(comparison.percentage)}%</bdi>)</>}
                </span>
            </section>}

            <div className="gl-rp-split">
                {receipts && <Panel icon="scale" tone="clr" title="كشف تسوية المقبوضات" note="من المسجّل إلى المؤكَّد">
                    <table className="gl-rp-table">
                        <thead><tr><th>البند</th><th className="num">المبلغ ₪</th></tr></thead>
                        <tbody>
                            <tr><td><b>المقبوضات المسجّلة بعد التصحيحات</b></td><td className="num"><b><bdi dir="ltr">{reportMoney(receipts.adjusted)}</bdi></b></td></tr>
                            <tr className="is-sub"><td>نقد مؤكَّد بالعدّ</td><td className="num"><bdi dir="ltr">{reportMoney(receipts.cashConfirmed)}</bdi></td></tr>
                            <tr className="is-sub"><td>حوالات مثبتة مع البنك</td><td className="num"><bdi dir="ltr">{reportMoney(receipts.bankVerified)}</bdi></td></tr>
                            <tr><td><b>المؤكَّد</b></td><td className="num" data-tone="pay"><b><bdi dir="ltr">{reportMoney(receipts.confirmed)}</bdi></b></td></tr>
                            <tr className="is-sub"><td>نقد في صناديق لم يُؤكَّد إغلاقها</td><td className="num" data-tone="warn"><bdi dir="ltr">{reportMoney(receipts.cashPending)}</bdi></td></tr>
                            <tr className="is-sub"><td>حوالات قيد التدقيق</td><td className="num" data-tone="warn"><bdi dir="ltr">{reportMoney(receipts.bankPending)}</bdi></td></tr>
                            <tr className={cents(receipts.shortage) || cents(receipts.excess) ? 'is-flag' : 'is-sub'}><td>فروق بنكية معتمدة (نقص / زيادة)</td><td className="num"><bdi dir="ltr">{reportMoney(receipts.shortage)} / {reportMoney(receipts.excess)}</bdi></td></tr>
                        </tbody>
                        <tfoot><tr><td>غير مسوّى حتى الآن</td><td className="num" data-tone={cents(receipts.adjusted) - cents(receipts.confirmed) > 0 ? 'warn' : 'pay'}><bdi dir="ltr">{reportMoney((cents(receipts.adjusted) - cents(receipts.confirmed)) / 100)}</bdi></td></tr></tfoot>
                    </table>
                    <p className="gl-rp-basis">{receipts.basis}</p>
                </Panel>}

                <div className="gl-rp-stack">
                    {branchSummary.length > 0 && <Panel icon="trend" title="المقبوضات حسب الفرع" note="والتحصيل من التحميلات">
                        <table className="gl-rp-table">
                            <thead><tr><th>الفرع</th><th className="num">المقبوضات</th><th>الحصة</th><th className="num">التحصيل</th></tr></thead>
                            <tbody>
                                {branches.map((row) => (
                                    <tr key={row.id}>
                                        <td><b>{row.name}</b></td>
                                        <td className="num"><b><bdi dir="ltr">{reportMoney(row.collections.total)}</bdi></b></td>
                                        <td><ShareBar value={share(row.collections.total, branchTotal)} /></td>
                                        <td className="num" data-tone="pay">{cents(row.flow.chargesTotal) > 0 ? `${share(row.collections.total, row.flow.chargesTotal)}%` : '—'}</td>
                                    </tr>
                                ))}
                                {quiet > 0 && <tr className="is-sub"><td>{quiet} {quiet === 1 ? 'فرع آخر' : 'فروع أخرى'} بلا حركة</td><td className="num">0</td><td /><td className="num">—</td></tr>}
                            </tbody>
                            <tfoot><tr><td>المجموع، {branchSummary.length} فروع</td><td className="num"><bdi dir="ltr">{reportMoney(branchTotal)}</bdi></td><td /><td className="num">{branchCharges > 0 ? `${share(branchTotal, branchCharges)}%` : '—'}</td></tr></tfoot>
                        </table>
                    </Panel>}
                    {readings && <Panel icon="gauge" tone="warn" title="القراءات في الفترة">
                        <div className="gl-rp-trio">
                            <Figure label="أُدخلت" hint={`${readings.consumption.toLocaleString('en-US')} كيلو`}>{readings.entered}</Figure>
                            <Figure label="اعتُمدت وحُمّلت" hint={`${reportMoney(readings.billed)} ₪`}>{readings.approved}</Figure>
                            <Figure label="بانتظار الاعتماد" tone={readings.pending > 0 ? 'warn' : null} hint={readings.pending > 0 ? <Link href="/meter-readings" className="gl-rp-link">فتح القراءات</Link> : 'لا شيء معلّق'}>{readings.pending}</Figure>
                        </div>
                    </Panel>}
                </div>
            </div>
        </>
    );
}

/**
 * The collections: their headline figures, where the money came from (by
 * method and account), by currency at its own rate, by collector, and day
 * by day, the empty days folded away unless asked for.
 */
export function CollectionsView({ collections, comparison, days = [], onOpenDay }) {
    const [showEmpty, setShowEmpty] = useState(false);
    const receipts = collections.receipts;
    const pending = receipts ? (cents(receipts.cashPending) + cents(receipts.bankPending)) / 100 : null;
    const average = collections.count > 0 ? cents(collections.total) / collections.count / 100 : 0;
    const shownDays = showEmpty ? days : days.filter((day) => day.lines > 0);
    const totals = ['charges', 'payments', 'discounts', 'corrections'].reduce((sum, key) => ({ ...sum, [key]: days.reduce((total, day) => total + cents(day[key]), 0) / 100 }), {});
    const largestAccount = Math.max(1, ...collections.accounts.map((account) => cents(account.total)));
    const transfers = (row) => (cents(row.total) - cents(row.cash)) / 100;

    return (
        <>
            <div className="gl-rp-figs is-five">
                <Figure dark label="المقبوضات المسجّلة" hint={`${collections.count} دفعة، متوسط ${reportMoney(average)} ₪`}><Shekels value={collections.total} /></Figure>
                {receipts && <Figure tone="pay" label="المؤكَّد" hint={`${share(receipts.confirmed, receipts.adjusted)}% من المسجّل`}><Shekels value={receipts.confirmed} /></Figure>}
                {receipts && <Figure tone="warn" label="بانتظار التأكيد" hint="نقد لم يُسلَّم وحوالات قيد التدقيق"><Shekels value={pending} /></Figure>}
                {receipts && <Figure tone="owe" label="فروق معتمدة" hint={`نقص ${reportMoney(receipts.shortage)}، زيادة ${reportMoney(receipts.excess)}`}><Shekels value={(cents(receipts.shortage) + cents(receipts.excess)) / 100} /></Figure>}
                {comparison && <Figure label="مقارنة بالفترة السابقة" hint={`${shortDate(comparison.from)} إلى ${shortDate(comparison.to)}: ${reportMoney(comparison.total)} ₪`}>
                    <span data-tone={cents(comparison.difference) >= 0 ? 'pay' : 'owe'}><bdi dir="ltr">{cents(comparison.difference) >= 0 ? '+' : '−'}{reportMoney(Math.abs(Number(comparison.difference)))}</bdi></span>{comparison.percentage !== null && <span className="gl-rp-unit"> ({comparison.percentage}%)</span>}
                </Figure>}
            </div>

            <div className="gl-rp-split">
                <Panel icon="bank" tone="clr" title="من أين جاءت المقبوضات" note="حسب الطريقة والحساب">
                    <div className="gl-rp-stackbar" role="img" aria-label={`نقدًا ${share(collections.cash, collections.total)}%، تحويلات ${share(collections.nonCash, collections.total)}%`}>
                        {cents(collections.cash) > 0 && <span data-tone="pay" style={{ width: `${share(collections.cash, collections.total)}%` }} />}
                        {cents(collections.nonCash) > 0 && <span data-tone="clr" style={{ width: `${share(collections.nonCash, collections.total)}%` }} />}
                    </div>
                    <div className="gl-rp-legend">
                        <span><i data-tone="pay" />نقدًا <b><Shekels value={collections.cash} /></b> ({share(collections.cash, collections.total)}%)</span>
                        <span><i data-tone="clr" />تحويلات <b><Shekels value={collections.nonCash} /></b> ({share(collections.nonCash, collections.total)}%)</span>
                    </div>
                    <ul className="gl-rp-accounts">
                        {collections.accounts.map((account) => (
                            <li key={account.key}>
                                <span className="gl-set-ico" data-tone={account.key === 'cash' ? 'pay' : 'clr'} aria-hidden="true"><Icon name={account.key === 'cash' ? 'banknotes' : 'bank'} /></span>
                                <div className="min-w-0"><b>{account.label}</b><small>{account.count} دفعة</small><ShareBar value={(cents(account.total) / largestAccount) * 100} tone={account.key === 'cash' ? 'pay' : 'clr'} /></div>
                                <b className="gl-rp-amount"><Shekels value={account.total} /></b>
                            </li>
                        ))}
                    </ul>
                </Panel>
                <Panel icon="currency" tone="disc" title="حسب العملة" note="المبلغ الأصلي وما يعادله">
                    <table className="gl-rp-table">
                        <thead><tr><th>العملة</th><th className="num">الدفعات</th><th className="is-start">بالعملة</th><th className="num">سعر الصرف الفعلي</th><th className="num">بالشيكل</th></tr></thead>
                        <tbody>{collections.currencies.map((row) => (
                            <tr key={row.currency}><td><b>{row.label}</b></td><td className="num">{row.count}</td><td className="is-start"><bdi dir="ltr">{reportMoney(row.amount)} {row.currency}</bdi></td><td className="num">{row.currency === 'ILS' || cents(row.amount) === 0 ? '1' : (Number(row.total) / Number(row.amount)).toFixed(2)}</td><td className="num"><b><bdi dir="ltr">{reportMoney(row.total)}</bdi></b></td></tr>
                        ))}</tbody>
                        <tfoot><tr><td>المجموع</td><td className="num">{collections.count}</td><td /><td /><td className="num"><bdi dir="ltr">{reportMoney(collections.total)}</bdi></td></tr></tfoot>
                    </table>
                </Panel>
            </div>

            <Panel icon="user" title="حسب المحصّل" note="من جمع كم، وكيف">
                <div className="gl-rp-scroll"><table className="gl-rp-table">
                    <thead><tr><th>المحصّل</th><th className="num">الدفعات</th><th className="num">نقدًا</th><th className="num">تحويلات</th><th className="num">المجموع</th><th>الحصة</th></tr></thead>
                    <tbody>{collections.collectors.map((row) => (
                        <tr key={row.name}><td><b>{row.name}</b></td><td className="num">{row.count}</td><td className="num"><bdi dir="ltr">{reportMoney(row.cash)}</bdi></td><td className="num"><bdi dir="ltr">{reportMoney(transfers(row))}</bdi></td><td className="num"><b><bdi dir="ltr">{reportMoney(row.total)}</bdi></b></td><td><ShareBar value={share(row.total, collections.total)} tone="brand" /> <small className="gl-rp-pct">{share(row.total, collections.total)}%</small></td></tr>
                    ))}</tbody>
                    <tfoot><tr><td>المجموع، {collections.collectors.length} {collections.collectors.length === 1 ? 'محصّل' : 'محصّلين'}</td><td className="num">{collections.count}</td><td className="num"><bdi dir="ltr">{reportMoney(collections.cash)}</bdi></td><td className="num"><bdi dir="ltr">{reportMoney(collections.nonCash)}</bdi></td><td className="num"><bdi dir="ltr">{reportMoney(collections.total)}</bdi></td><td /></tr></tfoot>
                </table></div>
            </Panel>

            {days.length > 1 && <Panel icon="calendar" tone="pay" title="يومًا بيوم" aside={(
                <Switch isSelected={!showEmpty} onChange={(on) => setShowEmpty(!on)} className="gl-set-switch gl-rp-toggle">
                    <Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control><Label>إخفاء الأيام بلا حركة</Label></Switch.Content>
                </Switch>
            )}>
                <div className="gl-rp-scroll"><table className="gl-rp-table">
                    <thead><tr><th>اليوم</th><th className="num">التحميلات</th><th className="num">الدفعات</th><th className="num">الخصومات</th><th className="num">الإلغاءات</th><th className="num">الرصيد الختامي</th></tr></thead>
                    <tbody>{shownDays.map((day) => (
                        <tr key={day.day} data-empty={day.lines === 0 || undefined}>
                            <td><button type="button" className="gl-rp-day" onClick={() => onOpenDay(day.day)}>{weekDayName(day.day)} {shortDate(day.day)}</button></td>
                            <td className="num" data-tone="owe"><bdi dir="ltr">{reportMoney(day.charges)}</bdi></td>
                            <td className="num" data-tone="pay"><bdi dir="ltr">{reportMoney(day.payments)}</bdi></td>
                            <td className="num"><bdi dir="ltr">{reportMoney(day.discounts)}</bdi></td>
                            <td className="num"><bdi dir="ltr">{reportMoney(day.corrections)}</bdi></td>
                            <td className="num"><b><bdi dir="ltr">{reportMoney(day.balance)}</bdi></b></td>
                        </tr>
                    ))}{shownDays.length === 0 && <tr><td colSpan={6} className="gl-rp-empty">لا حركة في أيام الفترة.</td></tr>}</tbody>
                    <tfoot><tr><td>المجموع، {days.filter((day) => day.lines > 0).length} يوم بحركة من {days.length}</td><td className="num"><bdi dir="ltr">{reportMoney(totals.charges)}</bdi></td><td className="num"><bdi dir="ltr">{reportMoney(totals.payments)}</bdi></td><td className="num"><bdi dir="ltr">{reportMoney(totals.discounts)}</bdi></td><td className="num"><bdi dir="ltr">{reportMoney(totals.corrections)}</bdi></td><td className="num"><bdi dir="ltr">{reportMoney(days.at(-1)?.balance ?? 0)}</bdi></td></tr></tfoot>
                </table></div>
            </Panel>}
        </>
    );
}

const STAGE_TONES = ['warn', 'clr', 'pay'];
const STAGE_FIGURES = ['في صناديق مفتوحة', 'مغلقة لم يؤكد الفرع استلامها', 'أكّد الفرع استلامها'];

/** The boxes' headline figures and the money by type of box and stage, above the boxes' table. */
export function BoxesFigures({ data }) {
    const shekels = (group) => group.currencies.find((total) => total.currency === 'ILS')?.amount ?? '0.00';
    const others = (group) => group.currencies.filter((total) => total.currency !== 'ILS').map((total) => `${reportMoney(total.amount)} ${total.currency}`);
    const all = data.byStatus.reduce((sum, group) => sum + cents(shekels(group)), 0) / 100;
    const boxes = data.byStatus.reduce((sum, group) => sum + group.boxes, 0);
    const typeTotal = (row) => row.stages.reduce((sum, stage) => sum + cents(stage.amount), 0) / 100;

    return (
        <>
            <div className="gl-rp-figs">
                <Figure dark label="كل ما في الصناديق" hint={`${boxes} صندوق في الفترة، بالشيكل`}><Shekels value={all} /></Figure>
                {data.byStatus.map((group, index) => (
                    <Figure key={group.status} tone={STAGE_TONES[index]} label={STAGE_FIGURES[index]} hint={[`${group.boxes} صندوق`, ...others(group)].join('، ')}><Shekels value={shekels(group)} /></Figure>
                ))}
            </div>
            {data.byType && <Panel icon="table" tone="clr" title="الأموال حسب نوع الصندوق ومرحلته" note="بالشيكل، الصفوف أنواع والأعمدة مراحل">
                <div className="gl-rp-scroll"><table className="gl-rp-table is-pivot">
                    <thead><tr><th>النوع</th>{data.byType[0].stages.map((stage, index) => <th key={stage.status}>{['مفتوح', 'مغلق، لم يُستلم', 'مستلم'][index]}</th>)}<th>المجموع</th></tr></thead>
                    <tbody>{data.byType.map((row) => (
                        <tr key={row.type}><td><b>{row.label}</b></td>{row.stages.map((stage, index) => (
                            <td key={stage.status} data-tone={cents(stage.amount) > 0 ? STAGE_TONES[index] : undefined}><b><bdi dir="ltr">{reportMoney(stage.amount)}</bdi></b><small>{stage.boxes} صندوق</small></td>
                        ))}<td><b><bdi dir="ltr">{reportMoney(typeTotal(row))}</bdi></b></td></tr>
                    ))}</tbody>
                    <tfoot><tr><td>المجموع</td>{data.byType[0].stages.map((stage, index) => <td key={stage.status}><bdi dir="ltr">{reportMoney(data.byType.reduce((sum, row) => sum + cents(row.stages[index].amount), 0) / 100)}</bdi></td>)}<td><bdi dir="ltr">{reportMoney(data.byType.reduce((sum, row) => sum + cents(typeTotal(row)), 0) / 100)}</bdi></td></tr></tfoot>
                </table></div>
            </Panel>}
        </>
    );
}

const BUCKET_TONES = { current: 'pay', days_60: 'warn', days_90: 'late', older: 'owe' };

/** The debts' headline figures and their split by age, above the debtors' table. */
export function DebtFigures({ data }) {
    const older = data.buckets.find((bucket) => bucket.key === 'older')?.total ?? '0.00';

    return (
        <>
            <div className="gl-rp-figs">
                <Figure dark label={`إجمالي الديون كما في ${shortDate(data.asOf)}`} hint={`${data.count} مشترك مدين`}><Shekels value={data.total} /></Figure>
                <Figure tone="owe" label="أكثر من 90 يومًا" hint={`${share(older, data.total)}% من الديون`}><Shekels value={older} /></Figure>
                <Figure tone="brand" label="تركّز الديون" hint="عند أكبر 10 مدينين">{data.topTenShare ?? 0}%</Figure>
                <Figure tone="pay" label="أرصدة لصالح المشتركين" hint={`${data.creditCount} حساب، تُطرح من الديون`}><Shekels value={Math.abs(Number(data.credit))} /></Figure>
            </div>
            <Panel icon="clock" tone="owe" title="الديون حسب العمر" note="الدفعات تسدّد أقدم الديون أولًا">
                <div className="gl-rp-stackbar" role="img" aria-label={data.buckets.map((bucket) => `${bucket.label}: ${share(bucket.total, data.total)}%`).join('، ')}>
                    {data.buckets.map((bucket) => cents(bucket.total) > 0 && <span key={bucket.key} data-tone={BUCKET_TONES[bucket.key]} style={{ width: `${share(bucket.total, data.total)}%` }} />)}
                </div>
                <div className="gl-rp-legend">
                    {data.buckets.map((bucket) => <span key={bucket.key}><i data-tone={BUCKET_TONES[bucket.key]} />{bucket.label} <b><Shekels value={bucket.total} /></b> ({share(bucket.total, data.total)}%)</span>)}
                </div>
            </Panel>
        </>
    );
}

/** A debtor's amount in one age column, tinted by how old it is. */
export function debtCell(row, column) {
    if (!BUCKET_TONES[column.key]) {
        return undefined;
    }
    const amount = Number(row[column.key] ?? row.buckets?.[column.key] ?? 0);

    return amount > 0 ? <Chip size="sm" variant="soft" className="gl-rp-heat" data-tone={BUCKET_TONES[column.key]}><bdi dir="ltr">{reportMoney(amount)}</bdi></Chip> : <span className="gl-rp-dash">—</span>;
}
