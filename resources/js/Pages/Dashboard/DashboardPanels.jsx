import { Button, Input } from '@heroui/react';
import Pagination from '@/Components/DataTable/Pagination';
import Icon from '@/Components/Icon';
import Panel from '@/Components/Panel';
import { formatMoney, timeAgo } from '@/lib/format';

/** The latest payments of the period: searched, filtered by how they were paid, a page at a time, with their receipts. */
export function LatestPayments({ payments, latestPayments, period, search, onSearchChange, onVisit, filters, scope, can, canOpenReceipts, onOpenStatement }) {
    const columns = 6 + (scope.company ? 1 : 0) + (canOpenReceipts ? 1 : 0);

    return (
        <Panel index={6} title="أحدث الدفعات" sub={`الدفعات المسجلة في آخر ${period}، الأحدث أولًا. المجموع لا يشمل الملغاة.`} aria-label="أحدث الدفعات">
            <div className="gl-tools">
                <form
                    role="search"
                    className="gl-field flex-[1_1_240px]!"
                   
                    onSubmit={(event) => {
                        event.preventDefault();
                        onVisit({ search: search.trim() || null }, ['latestPayments', 'filters']);
                    }}
                >
                    <Icon name="search" className="h-4 w-4 shrink-0" />
                    <Input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="اسم المشترك أو رقم الحساب" aria-label="ابحث في الدفعات" />
                </form>
                <div className="gl-seg" role="group" aria-label="طريقة الدفع">
                    {[['', 'الكل'], ['cash', 'نقدي'], ['transfer', 'حوالات']].map(([value, label]) => (
                        <Button key={value} aria-pressed={(filters.method ?? '') === value} onClick={() => onVisit({ method: value || null }, ['latestPayments', 'filters'])}>{label}</Button>
                    ))}
                </div>
            </div>
            {/* Scrolls sideways on a narrow screen, so it takes keyboard focus and arrow keys reach every column. */}
            <div className="gl-tblw" tabIndex={0} role="region" aria-label="جدول أحدث الدفعات">
                <table className="gl-table">
                    <thead>
                        <tr>
                            <th>المشترك</th>
                            <th>الحساب</th>
                            {scope.company && <th>الفرع</th>}
                            <th>سجّلها</th>
                            <th>الطريقة</th>
                            <th>المبلغ</th>
                            <th>الوقت</th>
                            <th>الحالة</th>
                            {canOpenReceipts && <th className="text-center">الوصل</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {payments.data.length === 0 ? (
                            <tr><td colSpan={columns + 1} className="gl-empty-line">لا دفعات في هذه الفترة.</td></tr>
                        ) : payments.data.map((payment) => (
                            <tr key={payment.id} data-clickable={can?.viewSubscriptions || undefined} onClick={can?.viewSubscriptions ? () => onOpenStatement(payment) : undefined}>
                                <td>
                                    {can?.viewSubscriptions ? (
                                        <Button onClick={(event) => { event.stopPropagation(); onOpenStatement(payment); }} aria-haspopup="dialog" title="كشف الحساب" className="font-semibold">{payment.subscriber}</Button>
                                    ) : <b className="font-semibold">{payment.subscriber}</b>}
                                </td>
                                <td className="gl-mono" dir="ltr">{payment.accountNumber}</td>
                                {scope.company && <td>{payment.branchName ?? '—'}</td>}
                                <td>{payment.recordedBy ?? '—'}</td>
                                <td>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Icon name={payment.isCash ? 'banknotes' : 'bank'} className="h-4 w-4" />
                                        {payment.isCash ? 'نقدي' : `حوالة${payment.bankName ? `، ${payment.bankName}` : ''}`}
                                    </span>
                                </td>
                                <td className={`gl-num font-bold ${payment.cancelled ? 'line-through opacity-50' : ''}`}>₪ {formatMoney(payment.amount)}</td>
                                <td title={new Date(payment.recordedAt).toLocaleString('ar-EG-u-nu-latn')} className="text-(--gl-muted)!">{timeAgo(payment.recordedAt)}</td>
                                <td><span className={`gl-pill ${payment.cancelled ? '' : 'gl-ok'}`}>{payment.cancelled ? 'ملغاة' : 'سارية'}</span></td>
                                {canOpenReceipts && (
                                    <td className="text-center" onClick={(event) => event.stopPropagation()}>
                                        <a href={`/subscriptions/${payment.subscriptionId}/payments/${payment.id}/receipt`} target="_blank" rel="noopener noreferrer" title="طباعة الوصل" aria-label={`طباعة وصل ${payment.subscriber}`} className="gl-ib mx-auto w-[32px]! h-[32px]!">
                                            <Icon name="printer" className="h-4 w-4" />
                                        </a>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {payments.total > 0 && (
                <div className="gl-foot-line">
                    مجموع الدفعات السارية
                    <b className="gl-num text-(--gl-ink)!">₪ {formatMoney(latestPayments.sum)}</b>
                </div>
            )}
            <Pagination meta={payments} onPageChange={(page) => onVisit({ page }, ['latestPayments'])} />
        </Panel>
    );
}
