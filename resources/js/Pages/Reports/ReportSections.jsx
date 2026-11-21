import { Button } from '@heroui/react';
import Pagination from '@/Components/DataTable/Pagination';
import SegmentedTabs from '@/Components/SegmentedTabs';
import { linesPart } from '@/lib/reportExcelParts';
import { loadReportLines } from '@/lib/reportLines';
import { reportMoney, shortDate } from '@/lib/reportFormatting';
import { TH, NUM_TH, TD, NUM, Panel } from './ReportParts';

/** Every line of the period, newest first, narrowed to one kind. */
export function Transactions({ transactions, kinds, filters, showDay, showBranch, onKind, onStatement }) {
    return (
        <Panel icon="list" title="الحركات" hint={`${transactions.total} حركة`} excelParts={async (options) => [linesPart(await loadReportLines(new URLSearchParams(Object.entries(filters).filter(([, value]) => value != null)).toString(), options), { showBranch })]}>
            <p className="mb-3 text-xs leading-6 text-gray-500">تصفية النوع تخص الحركات التفصيلية وتصديرها فقط؛ الملخص والتحصيل يعرضان جميع أنواع الحركات للفترة والفرع المحددين.</p>
            <div className="mb-4 overflow-x-auto pb-1">
                <SegmentedTabs label="نوع الحركات" value={filters.kind} onChange={onKind} options={kinds} />
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th className={TH}>الوقت</th>
                            <th className={TH}>السند</th>
                            <th className={TH}>المشترك</th>
                            {showBranch && <th className={TH}>الفرع</th>}
                            <th className={TH}>البيان</th>
                            <th className={TH}>الحساب</th>
                            <th className={NUM_TH}>عليه</th>
                            <th className={NUM_TH}>له</th>
                            <th className={TH}>سجّله</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.data.length === 0 && (
                            <tr>
                                <td colSpan={showBranch ? 9 : 8} className="px-3 py-10 text-center text-gray-500">لا حركات في هذه الفترة.</td>
                            </tr>
                        )}
                        {transactions.data.map((line) => (
                            <tr key={line.id} className={`border-t border-gray-100 align-top ${line.isCancelled ? 'text-gray-400 line-through decoration-gray-300' : ''}`}>
                                <td className={`${TD} whitespace-nowrap font-display text-gray-600`}>
                                    {line.time}
                                    {showDay && <small className="block text-xs text-gray-500">{shortDate(line.day)}</small>}
                                </td>
                                <td className={`${TD} font-display`}>{line.voucherNumber ?? '—'}</td>
                                <td className={TD}>
                                    <span className="font-semibold text-gray-900">{onStatement ? <Button data-raw="" variant="ghost" className="text-brand-600 hover:underline" onClick={() => onStatement(line.subscriptionId)}>{line.subscriptionName}</Button> : line.subscriptionName}</span>
                                    <small className="block font-display text-xs text-gray-500">
                                        {line.accountNumber}
                                        {line.meterBoxNumber && `، ${line.meterBoxNumber}`}
                                    </small>
                                </td>
                                {showBranch && <td className={TD}>{line.branchName}</td>}
                                <td className={`${TD} max-w-[260px]`}>
                                    <b className="font-semibold text-gray-800">{line.typeLabel}</b>
                                    <small className="block text-xs text-gray-500">{line.description}</small>
                                </td>
                                <td className={TD}>
                                    {line.account ?? '—'}
                                    {line.currency && line.currency !== 'ILS' && (
                                        <small className="block font-display text-xs text-gray-500">{line.currencyAmount} {line.currency}</small>
                                    )}
                                </td>
                                <td className={NUM}>{line.isCredit ? '—' : reportMoney(Math.abs(Number(line.amount)))}</td>
                                <td className={`${NUM} text-emerald-700`}>{line.isCredit ? reportMoney(Math.abs(Number(line.amount))) : '—'}</td>
                                <td className={`${TD} text-gray-600`}>{line.recordedBy ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4">
                <Pagination meta={transactions} filters={filters} baseUrl="/reports" />
            </div>
        </Panel>
    );
}
