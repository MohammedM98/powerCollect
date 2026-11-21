import { Button, Input } from '@heroui/react';
import Pagination from '@/Components/DataTable/Pagination';
import Icon from '@/Components/Icon';
import Panel from '@/Components/Panel';
import { formatMoney, timeAgo } from '@/lib/format';
import { ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable } from '@/Components/UI';

/** The latest payments of the period: searched, filtered by how they were paid, a page at a time, with their receipts. */
export function LatestPayments({ payments, latestPayments, period, search, onSearchChange, onVisit, filters, scope, can, canOpenReceipts, onOpenStatement }) {
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
                        <Button data-raw="" variant="ghost" key={value} aria-pressed={(filters.method ?? '') === value} onClick={() => onVisit({ method: value || null }, ['latestPayments', 'filters'])}>{label}</Button>
                    ))}
                </div>
            </div>
            {/* Scrolls sideways on a narrow screen, so it takes keyboard focus and arrow keys reach every column. */}
            <div className="gl-tblw" tabIndex={0} role="region" aria-label="جدول أحدث الدفعات">
                <ListTable aria-label="أحدث الدفعات" className="gl-table">
                    <ListHeader>
                        <ListColumn id="subscriber" isRowHeader>المشترك</ListColumn>
                        <ListColumn id="account">الحساب</ListColumn>
                        {scope.company && <ListColumn id="branch">الفرع</ListColumn>}
                        <ListColumn id="recorded_by">سجّلها</ListColumn>
                        <ListColumn id="method">الطريقة</ListColumn>
                        <ListColumn id="amount">المبلغ</ListColumn>
                        <ListColumn id="recorded_at">الوقت</ListColumn>
                        <ListColumn id="status">الحالة</ListColumn>
                        {canOpenReceipts && <ListColumn id="receipt" className="text-center">الوصل</ListColumn>}
                    </ListHeader>
                    <ListBody empty={<div className="gl-empty-line">لا دفعات في هذه الفترة.</div>}>
                        {payments.data.map((payment) => (
                            <ListRow key={payment.id} id={payment.id} onOpen={can?.viewSubscriptions ? () => onOpenStatement(payment) : null}>
                                <ListCell>
                                    {can?.viewSubscriptions ? (
                                        <Button data-raw="" variant="ghost" onClick={(event) => { event.stopPropagation(); onOpenStatement(payment); }} aria-haspopup="dialog" title="كشف الحساب" className="font-semibold">{payment.subscriber}</Button>
                                    ) : <b className="font-semibold">{payment.subscriber}</b>}
                                </ListCell>
                                <ListCell className="gl-mono" dir="ltr">{payment.accountNumber}</ListCell>
                                {scope.company && <ListCell>{payment.branchName ?? '—'}</ListCell>}
                                <ListCell>{payment.recordedBy ?? '—'}</ListCell>
                                <ListCell>
                                    <span className="inline-flex items-center gap-2">
                                        <Icon name={payment.isCash ? 'banknotes' : 'bank'} className="h-4 w-4" />
                                        {payment.isCash ? 'نقدي' : `حوالة${payment.bankName ? `، ${payment.bankName}` : ''}`}
                                    </span>
                                </ListCell>
                                <ListCell className={`gl-num font-bold ${payment.cancelled ? 'line-through opacity-50' : ''}`}>₪ {formatMoney(payment.amount)}</ListCell>
                                <ListCell className="text-(--gl-muted)!"><span title={new Date(payment.recordedAt).toLocaleString('ar-EG-u-nu-latn')}>{timeAgo(payment.recordedAt)}</span></ListCell>
                                <ListCell><span className={`gl-pill ${payment.cancelled ? '' : 'gl-ok'}`}>{payment.cancelled ? 'ملغاة' : 'سارية'}</span></ListCell>
                                {canOpenReceipts && (
                                    <ListCell className="text-center" onClick={(event) => event.stopPropagation()}>
                                        <a href={`/subscriptions/${payment.subscriptionId}/payments/${payment.id}/receipt`} target="_blank" rel="noopener noreferrer" title="طباعة الوصل" aria-label={`طباعة وصل ${payment.subscriber}`} className="gl-ib mx-auto w-[32px]! h-[32px]!">
                                            <Icon name="printer" className="h-4 w-4" />
                                        </a>
                                    </ListCell>
                                )}
                            </ListRow>
                        ))}
                    </ListBody>
                </ListTable>
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
