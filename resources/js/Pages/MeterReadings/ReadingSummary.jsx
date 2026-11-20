import { Button, Card } from '@heroui/react';
import Icon from '@/Components/Icon';
import { formatMoney } from '@/lib/format';
import { countReadings } from '@/lib/readingSheet';

const share = (part, total) => (total ? `${(part / total) * 100}%` : '0%');

/**
 * The week at a glance, in one strip above the sheet: how many readings are
 * entered out of the week's subscriptions on a bar split into approved,
 * waiting and not entered; what the week comes to; and, for those who
 * approve, the one key that approves every waiting reading (an unusual one
 * waits for its own review, as the note says).
 */
export default function ReadingSummary({ statusSummary, amountDue, pendingApproval, canApprove, approvableAllCount, isFiltered, approving, onApproveAll }) {
    const entered = statusSummary.pending + statusSummary.approved;
    const percentage = statusSummary.total ? Math.round((entered / statusSummary.total) * 100) : 0;
    const unusualCount = pendingApproval?.unusualCount ?? 0;

    return (
        <Card className="re-summary" data-excel-source="custom">
            <div className="re-summary-progress">
                <p className="re-summary-count">
                    <b><bdi dir="ltr">{entered.toLocaleString('en')}</bdi></b>
                    <span>من <bdi dir="ltr">{statusSummary.total.toLocaleString('en')}</bdi> قراءة مُدخلة</span>
                    <em>{percentage}%</em>
                </p>
                <div className="re-summary-bar" role="progressbar" aria-label="القراءات المدخلة" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
                    <i className="approved" style={{ width: share(statusSummary.approved, statusSummary.total) }} />
                    <i className="pending" style={{ width: share(statusSummary.pending, statusSummary.total) }} />
                </div>
                <p className="re-summary-legend">
                    <span><i className="approved" />معتمدة <b>{statusSummary.approved.toLocaleString('en')}</b></span>
                    <span><i className="pending" />بانتظار الاعتماد <b>{statusSummary.pending.toLocaleString('en')}</b></span>
                    <span><i />لم تُدخل <b>{statusSummary.missing.toLocaleString('en')}</b></span>
                </p>
            </div>
            <div className="re-summary-figure">
                <small>مستحق الأسبوع</small>
                <b><bdi dir="ltr">{formatMoney(amountDue)}</bdi> <span>₪</span></b>
                <small>{pendingApproval?.count > 0 ? <>منها <bdi dir="ltr">{formatMoney(pendingApproval.amountDue)}</bdi> ₪ بانتظار الاعتماد</> : 'عن القراءات المدخلة'}</small>
            </div>
            {canApprove && (
                <div className="re-summary-approve">
                    {pendingApproval.count > 0 ? (
                        <>
                            <Button className="re-approve-all" onPress={onApproveAll} isDisabled={approving || approvableAllCount === 0}>
                                <Icon name="check" className="h-4 w-4" strokeWidth={2} />
                                {isFiltered ? 'اعتماد كل النتائج' : 'اعتماد الكل'}
                                <span className="re-count">{approvableAllCount.toLocaleString('en')}</span>
                            </Button>
                            <small>{unusualCount > 0 ? `${countReadings(unusualCount)} غير معتادة تُراجع وتُعتمد وحدها` : 'تُضاف إلى حسابات المشتركين عند اعتمادها'}</small>
                        </>
                    ) : (
                        <p className="re-summary-done"><Icon name="check" className="h-4 w-4" strokeWidth={2} />{isFiltered ? 'لا قراءات بانتظار الاعتماد ضمن التصفية' : 'لا قراءات بانتظار الاعتماد'}</p>
                    )}
                </div>
            )}
        </Card>
    );
}
