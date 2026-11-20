import { usePage } from '@inertiajs/react';
import { Card, ProgressBar } from '@heroui/react';
import Icon from '@/Components/Icon';
import AsyncState from '@/Components/AsyncState';
import { useJsonResource } from '@/hooks/useJsonResource';
import { formatMoney } from '@/lib/format';

const STAGES = [
    { key: 'collected', tone: 'clr', label: 'حُصِّل هذا الأسبوع', describe: (stage) => `${stage.entries} حركة في ${stage.boxes} صندوق` },
    { key: 'open', tone: 'warn', label: 'في صناديق مفتوحة لم تُسلَّم', describe: (stage) => `${stage.boxes} صندوق مفتوح` },
    { key: 'awaiting', tone: 'split', label: 'مُسلَّمة بانتظار التدقيق', describe: (stage) => `${stage.boxes} صندوق مغلق` },
    { key: 'approved', tone: 'pay', label: 'دُقِّقت هذا الأسبوع', describe: (stage) => `${stage.boxes} صندوق معتمد` },
];

const shortDate = (date) => date.slice(5).split('-').reverse().join('/');

/** How long ago a box was opened, in whole days. */
function daysSince(moment) {
    return Math.max(0, Math.floor((Date.now() - new Date(moment).getTime()) / 86_400_000));
}

/**
 * The finance pages' money flow: where the money collected is now, from
 * the subscribers to the audit, as four stages on one HeroUI card. Each
 * stage's bar is its share of the largest stage. Shown to those who see the
 * branch's boxes; `branchId` narrows it to one branch.
 */
export default function MoneyFlow({ branchId = null }) {
    const { can } = usePage().props;
    const visible = Boolean(can?.viewBranchBoxes);
    const url = visible ? `/payments/money-flow${branchId ? `?branch_id=${branchId}` : ''}` : null;
    const { data, error, loading, retry } = useJsonResource(url, 'تعذّر تحميل مسار الأموال.');

    if (!visible) {
        return null;
    }

    const largest = data ? Math.max(1, ...STAGES.map(({ key }) => Number(data.stages[key].amount))) : 1;
    const openDays = data?.oldestOpenAt ? daysSince(data.oldestOpenAt) : null;

    return (
        <Card className="gl-flow" aria-labelledby="money-flow-title">
            <Card.Header className="gl-flow-head">
                <span className="gl-set-ico" aria-hidden="true"><Icon name="banknotes" /></span>
                <Card.Title id="money-flow-title" className="gl-set-title">مسار الأموال</Card.Title>
                {data && (
                    <span className="gl-flow-week">
                        الأسبوع <bdi dir="ltr">{shortDate(data.week.start)}</bdi> إلى <bdi dir="ltr">{shortDate(data.week.end)}</bdi>
                        {data.branchCount > 1 ? `، ${data.branchCount} فروع` : ''}
                    </span>
                )}
            </Card.Header>
            <Card.Content>
                <AsyncState loading={loading} error={error} onRetry={retry} rows={1} loadingLabel="جارٍ تحميل مسار الأموال…">
                    {data && (
                        <ol className="gl-flow-stages">
                            {STAGES.map(({ key, tone, label, describe }) => {
                                const stage = data.stages[key];
                                const alert = key === 'open' && Number(stage.amount) > 0 && openDays !== null && openDays >= 2;

                                return (
                                    <li key={key} className="gl-flow-stage" data-tone={tone} data-alert={alert || undefined}>
                                        <span className="gl-flow-label"><i aria-hidden="true" />{label}</span>
                                        <b className="gl-flow-amount"><bdi dir="ltr">{formatMoney(stage.amount)}</bdi> <small>₪</small></b>
                                        <span className="gl-flow-sub">
                                            {describe(stage)}
                                            {alert && `، أقدمها منذ ${openDays} يوم`}
                                        </span>
                                        <ProgressBar aria-label={label} value={(Number(stage.amount) / largest) * 100} className="gl-flow-bar">
                                            <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
                                        </ProgressBar>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </AsyncState>
            </Card.Content>
        </Card>
    );
}
