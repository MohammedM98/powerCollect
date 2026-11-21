import { Button } from '@heroui/react';
import Pagination from '@/Components/DataTable/Pagination';
import SegmentedTabs from '@/Components/SegmentedTabs';
import { linesPart } from '@/lib/reportExcelParts';
import { loadReportLines } from '@/lib/reportLines';
import { reportMoney, shortDate } from '@/lib/reportFormatting';
import { TH, NUM_TH, TD, NUM, Panel } from './ReportParts';
import { ListBody, ListCell, ListColumn, ListHeader, ListRow, ListTable } from '@/Components/UI';

/** Every line of the period, newest first, narrowed to one kind. */
export function Transactions({ transactions, kinds, filters, showDay, showBranch, onKind, onStatement }) {
    return (
        <Panel icon="list" title="الحركات" hint={`${transactions.total} حركة`} excelParts={async (options) => [linesPart(await loadReportLines(new URLSearchParams(Object.entries(filters).filter(([, value]) => value != null)).toString(), options), { showBranch })]}>
            <p className="mb-3 text-xs leading-6 text-gray-500">تصفية النوع تخص الحركات التفصيلية وتصديرها فقط؛ الملخص والتحصيل يعرضان جميع أنواع الحركات للفترة والفرع المحددين.</p>
            <div className="mb-4 overflow-x-auto pb-1">
                <SegmentedTabs label="نوع الحركات" value={filters.kind} onChange={onKind} options={kinds} />
            </div>
            <div className="overflow-x-auto">
                <ListTable aria-label="الحركات" className="w-full text-sm">
                    <ListHeader>
                        <ListColumn id="time" className={TH}>الوقت</ListColumn>
                        <ListColumn id="voucher" className={TH}>السند</ListColumn>
                        <ListColumn id="subscription" className={TH} isRowHeader>المشترك</ListColumn>
                        {showBranch && <ListColumn id="branch" className={TH}>الفرع</ListColumn>}
                        <ListColumn id="description" className={TH}>البيان</ListColumn>
                        <ListColumn id="account" className={TH}>الحساب</ListColumn>
                        <ListColumn id="debit" className={NUM_TH}>عليه</ListColumn>
                        <ListColumn id="credit" className={NUM_TH}>له</ListColumn>
                        <ListColumn id="recorder" className={TH}>سجّله</ListColumn>
                    </ListHeader>
                    <ListBody empty={<div className="px-3 py-8 text-center text-gray-500">لا حركات في هذه الفترة.</div>}>
                        {transactions.data.map((line) => (
                            <ListRow key={line.id} id={line.id} className={`border-t border-gray-100 align-top ${line.isCancelled ? 'text-gray-400 line-through decoration-gray-300' : ''}`}>
                                <ListCell className={`${TD} whitespace-nowrap font-display text-gray-600`}>
                                    {line.time}
                                    {showDay && <small className="block text-xs text-gray-500">{shortDate(line.day)}</small>}
                                </ListCell>
                                <ListCell className={`${TD} font-display`}>{line.voucherNumber ?? '—'}</ListCell>
                                <ListCell className={TD}>
                                    <span className="font-semibold text-gray-900">{onStatement ? <Button data-raw="" variant="ghost" className="text-brand-600 hover:underline" onClick={() => onStatement(line.subscriptionId)}>{line.subscriptionName}</Button> : line.subscriptionName}</span>
                                    <small className="block font-display text-xs text-gray-500">
                                        {line.accountNumber}
                                        {line.meterBoxNumber && `، ${line.meterBoxNumber}`}
                                    </small>
                                </ListCell>
                                {showBranch && <ListCell className={TD}>{line.branchName}</ListCell>}
                                <ListCell className={`${TD} max-w-[260px]`}>
                                    <b className="font-semibold text-gray-800">{line.typeLabel}</b>
                                    <small className="block text-xs text-gray-500">{line.description}</small>
                                </ListCell>
                                <ListCell className={TD}>
                                    {line.account ?? '—'}
                                    {line.currency && line.currency !== 'ILS' && (
                                        <small className="block font-display text-xs text-gray-500">{line.currencyAmount} {line.currency}</small>
                                    )}
                                </ListCell>
                                <ListCell className={NUM}>{line.isCredit ? '—' : reportMoney(Math.abs(Number(line.amount)))}</ListCell>
                                <ListCell className={`${NUM} text-emerald-700`}>{line.isCredit ? reportMoney(Math.abs(Number(line.amount))) : '—'}</ListCell>
                                <ListCell className={`${TD} text-gray-600`}>{line.recordedBy ?? '—'}</ListCell>
                            </ListRow>
                        ))}
                    </ListBody>
                </ListTable>
            </div>
            <div className="mt-4">
                <Pagination meta={transactions} filters={filters} baseUrl="/reports" />
            </div>
        </Panel>
    );
}
