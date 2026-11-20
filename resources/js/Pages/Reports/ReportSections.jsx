import { Button } from '@heroui/react';
import { Link } from '@inertiajs/react';
import BarChart from '@/Components/Charts/BarChart';
import MeterBar from '@/Components/Charts/MeterBar';
import Pagination from '@/Components/DataTable/Pagination';
import Icon from '@/Components/Icon';
import SegmentedTabs from '@/Components/SegmentedTabs';
import { accountsPart, branchesPart, collectorsPart, currenciesPart, daysPart, flowPart, linesPart, readingsPart } from '@/lib/reportExcelParts';
import { loadReportLines } from '@/lib/reportLines';
import { cents, reportMoney, shortDate } from '@/lib/reportFormatting';
import { weekDayName } from '@/lib/weekDays';
import { TH, NUM_TH, TD, NUM, Panel } from './ReportParts';

/** What the subscribers owed at the start, plus what was charged, less what was paid and discounted, ± the cancellations: what they owe at the end. */
export function FlowStatement({ flow }) {
    const row = 'border-t border-gray-100';
    const sum = 'border-t border-gray-200 bg-gray-50 font-bold';

    return (
        <Panel icon="ledger" title="حركة الأرصدة" hint="من الرصيد الافتتاحي إلى الختامي" excelParts={async () => [flowPart(flow)]}>
            <p className="mb-3 rounded-control bg-gray-50 px-3 py-2 text-xs leading-6 text-gray-600">
                الرصيد الافتتاحي + التحميلات − الدفعات والخصومات ± الإلغاءات والقيود العكسية = الرصيد الختامي
            </p>
            <table className="w-full text-sm">
                <thead>
                    <tr>
                        <th className={TH}>البند</th>
                        <th className={NUM_TH}>العدد</th>
                        <th className={NUM_TH}>المبلغ ₪</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className={sum}>
                        <td className={TD}>الرصيد الافتتاحي</td>
                        <td />
                        <td className={NUM}>{reportMoney(flow.opening)}</td>
                    </tr>
                    {flow.charges.map((line) => (
                        <tr key={line.type} className={row}>
                            <td className={`${TD} text-gray-700`}><span className="me-1.5 text-emerald-600">+</span>{line.label}</td>
                            <td className={`${NUM} text-gray-500`}>{line.count}</td>
                            <td className={NUM}>{reportMoney(line.total)}</td>
                        </tr>
                    ))}
                    <tr className={`${row} font-semibold`}>
                        <td className={TD}>مجموع التحميلات (عليه)</td>
                        <td />
                        <td className={NUM}>{reportMoney(flow.chargesTotal)}</td>
                    </tr>
                    {flow.credits.map((line) => (
                        <tr key={line.type} className={row}>
                            <td className={`${TD} text-gray-700`}><span className="me-1.5 text-brand-600">−</span>{line.label}</td>
                            <td className={`${NUM} text-gray-500`}>{line.count}</td>
                            <td className={NUM}>{reportMoney(line.total)}</td>
                        </tr>
                    ))}
                    <tr className={`${row} font-semibold`}>
                        <td className={TD}>مجموع الدفعات والخصومات (له)</td>
                        <td />
                        <td className={NUM}>{reportMoney(flow.creditsTotal)}</td>
                    </tr>
                    <tr className={row}>
                        <td className={`${TD} text-gray-700`}><span className="me-1.5 text-amber-600">±</span>الإلغاءات والقيود العكسية</td>
                        <td className={`${NUM} text-gray-500`}>{flow.corrections.count}</td>
                        <td className={`${NUM} ${cents(flow.corrections.total) !== 0 ? 'text-amber-700' : ''}`}>{reportMoney(flow.corrections.total)}</td>
                    </tr>
                    <tr className={`${sum} border-t-2`}>
                        <td className={TD}>الرصيد الختامي</td>
                        <td />
                        <td className={NUM}>{reportMoney(flow.closing)}</td>
                    </tr>
                </tbody>
            </table>
            <p className="mt-3 text-xs leading-6 text-gray-500">الإلغاء يظهر في يومه؛ والسطر الملغى في نفس يوم تسجيله يُحسب مع الإلغاءات لا مع نوعه، فتبقى أرقام الأيام السابقة ثابتة.</p>
        </Panel>
    );
}

/** Where the payments came in: by account, then (in full) by currency and by collector. */
export function CollectionsBreakdown({ collections, compact = false }) {
    const largest = Math.max(1, ...collections.accounts.map((account) => Number(account.total)));
    const largestCollector = Math.max(1, ...collections.collectors.map((collector) => Number(collector.total)));
    const foreign = collections.currencies.length > 1 || (collections.currencies[0] && collections.currencies[0].currency !== 'ILS');

    if (collections.count === 0) {
        return (
            <Panel icon="wallet" title="التحصيل">
                <p className="text-sm text-gray-500">لا دفعات في هذه الفترة.</p>
            </Panel>
        );
    }

    return (
        <>
            <Panel icon="wallet" title={compact ? 'التحصيل حسب الحساب' : 'حسب الحساب'} hint={`${collections.count} دفعة، ${reportMoney(collections.total)} ₪`} excelParts={async () => [accountsPart(collections)]}>
                <ul className="space-y-3">
                    {collections.accounts.map((account) => (
                        <li key={account.key}>
                            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                                <span className="flex items-center gap-2 font-semibold text-gray-800">
                                    <Icon name={account.key === 'cash' ? 'wallet' : 'bank'} className="h-4 w-4 text-gray-400" />
                                    {account.label}
                                    <span className="text-xs font-normal text-gray-500">{account.count} دفعة</span>
                                </span>
                                <b className="font-display tabular-nums text-gray-900">{reportMoney(account.total)} ₪</b>
                            </div>
                            <MeterBar value={Number(account.total)} max={largest} />
                        </li>
                    ))}
                </ul>
            </Panel>

            {!compact && foreign && (
                <Panel icon="currency" title="حسب العملة" excelParts={async () => [currenciesPart(collections)]}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr>
                                <th className={TH}>العملة</th>
                                <th className={NUM_TH}>الدفعات</th>
                                <th className={NUM_TH}>المبلغ بالعملة</th>
                                <th className={NUM_TH}>بالشيكل</th>
                            </tr>
                        </thead>
                        <tbody>
                            {collections.currencies.map((currency) => (
                                <tr key={currency.currency} className="border-t border-gray-100">
                                    <td className={TD}>{currency.label}</td>
                                    <td className={`${NUM} text-gray-500`}>{currency.count}</td>
                                    <td className={NUM}>{reportMoney(currency.amount)} {currency.currency}</td>
                                    <td className={NUM}>{reportMoney(currency.total)} ₪</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>
            )}

            {!compact && (
                <Panel icon="users" title="حسب المحصِّل" excelParts={async () => [collectorsPart(collections)]}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr>
                                    <th className={TH}>الموظف</th>
                                    <th className={NUM_TH}>الدفعات</th>
                                    <th className={NUM_TH}>نقدي</th>
                                    <th className={NUM_TH}>تحويلات وشيكات</th>
                                    <th className={NUM_TH}>المجموع</th>
                                    <th className={`${TH} w-32`}><span className="sr-only">الحصة</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {collections.collectors.map((collector) => (
                                    <tr key={collector.name} className="border-t border-gray-100">
                                        <td className={`${TD} font-semibold text-gray-900`}>{collector.name}</td>
                                        <td className={`${NUM} text-gray-500`}>{collector.count}</td>
                                        <td className={NUM}>{reportMoney(collector.cash)}</td>
                                        <td className={NUM}>{reportMoney((cents(collector.total) - cents(collector.cash)) / 100)}</td>
                                        <td className={`${NUM} font-bold`}>{reportMoney(collector.total)}</td>
                                        <td className={TD}><MeterBar value={Number(collector.total)} max={largestCollector} /></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                                    <td className={TD}>المجموع</td>
                                    <td className={NUM}>{collections.count}</td>
                                    <td className={NUM}>{reportMoney(collections.cash)}</td>
                                    <td className={NUM}>{reportMoney(collections.nonCash)}</td>
                                    <td className={NUM}>{reportMoney(collections.total)}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </Panel>
            )}
        </>
    );
}

export function Readings({ readings }) {
    return (
        <Panel icon="gauge" title="القراءات" excelParts={async () => [readingsPart(readings)]}>
            <dl className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-control bg-gray-50 px-2 py-3">
                    <dt className="text-xs text-gray-500">أُدخلت</dt>
                    <dd className="mt-1 font-display text-xl font-bold text-gray-900">{readings.entered}</dd>
                    <dd className="text-xs text-gray-500">{readings.consumption.toLocaleString('en-US')} كيلو</dd>
                </div>
                <div className="rounded-control bg-gray-50 px-2 py-3">
                    <dt className="text-xs text-gray-500">اعتُمدت وحُمِّلت</dt>
                    <dd className="mt-1 font-display text-xl font-bold text-gray-900">{readings.approved}</dd>
                    <dd className="text-xs text-gray-500">{reportMoney(readings.billed)} ₪</dd>
                </div>
                <div className={`rounded-control px-2 py-3 ${readings.pending > 0 ? 'bg-amber-500/10' : 'bg-gray-50'}`}>
                    <dt className="text-xs text-gray-500">بانتظار الاعتماد الآن</dt>
                    <dd className={`mt-1 font-display text-xl font-bold ${readings.pending > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{readings.pending}</dd>
                    {readings.pending > 0 && (
                        <dd><Link href="/meter-readings" className="text-xs font-semibold text-amber-700 underline-offset-2 hover:underline">فتح القراءات</Link></dd>
                    )}
                </div>
            </dl>
        </Panel>
    );
}

/** What was collected each day of the period. */
export function DailyCollections({ days }) {
    return (
        <Panel icon="chart" title="التحصيل اليومي" hint="بالشيكل" excelParts={async () => [daysPart(days)]}>
            <BarChart data={days.map((day) => ({ date: day.day, value: Number(day.payments), count: day.lines }))} label="التحصيل اليومي في الفترة" formatValue={(value) => `${reportMoney(value)} ₪`} countLabel="حركة" height={220} />
        </Panel>
    );
}

/** One row per day: what moved and what was owed at its end; a row opens that day's report. */
export function DaysTable({ days, onOpenDay }) {
    const total = (key) => reportMoney(days.reduce((sum, day) => sum + cents(day[key]), 0) / 100);

    return (
        <Panel icon="calendar" title="يومًا بيوم" hint="اضغط يومًا لفتح تقريره" excelParts={async () => [daysPart(days)]}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th className={TH}>اليوم</th>
                            <th className={NUM_TH}>التحميلات</th>
                            <th className={NUM_TH}>الدفعات</th>
                            <th className={NUM_TH}>الخصومات</th>
                            <th className={NUM_TH}>الإلغاءات</th>
                            <th className={NUM_TH}>الرصيد الختامي لليوم</th>
                        </tr>
                    </thead>
                    <tbody>
                        {days.map((day) => (
                            <tr key={day.day} className="cursor-pointer border-t border-gray-100 transition hover:bg-gray-50" onClick={() => onOpenDay(day.day)}>
                                <td className={TD}>
                                    <span className="text-gray-700">{weekDayName(day.day)}</span> <span className="font-display text-gray-500">{shortDate(day.day)}</span>
                                </td>
                                <td className={NUM}>{reportMoney(day.charges)}</td>
                                <td className={NUM}>{reportMoney(day.payments)}</td>
                                <td className={NUM}>{reportMoney(day.discounts)}</td>
                                <td className={`${NUM} ${cents(day.corrections) !== 0 ? 'text-amber-700' : ''}`}>{reportMoney(day.corrections)}</td>
                                <td className={`${NUM} font-semibold`}>{reportMoney(day.balance)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                            <td className={TD}>المجموع</td>
                            <td className={NUM}>{total('charges')}</td>
                            <td className={NUM}>{total('payments')}</td>
                            <td className={NUM}>{total('discounts')}</td>
                            <td className={NUM}>{total('corrections')}</td>
                            <td className={NUM}>{reportMoney(days[days.length - 1].balance)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </Panel>
    );
}

export function BranchComparison({ rows, filters }) {
    const largest = Math.max(1, ...rows.map((row) => Number(row.collections.total)));
    const sorted = [...rows].sort((first, second) => Number(second.collections.total) - Number(first.collections.total));
    const sum = (pick) => reportMoney(rows.reduce((total, row) => total + cents(pick(row)), 0) / 100);

    return (
        <Panel icon="layers" title="مقارنة الفروع" hint="نفس الفترة، الأعلى تحصيلًا أولًا، اضغط اسم الفرع لتقريره" excelParts={async () => [branchesPart(sorted)]}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr>
                            <th className={TH}>الفرع</th>
                            <th className={NUM_TH}>إجمالي المقبوضات المسجّلة</th>
                            <th className={`${TH} w-32`}><span className="sr-only">الحصة</span></th>
                            <th className={NUM_TH}>نقدي</th>
                            <th className={NUM_TH}>الدفعات</th>
                            <th className={NUM_TH}>الرصيد الختامي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((row) => (
                            <tr key={row.id} className="border-t border-gray-100">
                                <td className={TD}>
                                    <Link href={`/reports?${new URLSearchParams({ ...filters, branch: row.id }).toString()}`} className="font-semibold text-gray-900 hover:text-brand-600">{row.name}</Link>
                                </td>
                                <td className={`${NUM} font-bold`}>{reportMoney(row.collections.total)}</td>
                                <td className={TD}><MeterBar value={Number(row.collections.total)} max={largest} /></td>
                                <td className={NUM}>{reportMoney(row.collections.cash)}</td>
                                <td className={`${NUM} text-gray-500`}>{row.collections.count}</td>
                                <td className={NUM}>{reportMoney(row.flow.closing)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                            <td className={TD}>المجموع</td>
                            <td className={NUM}>{sum((row) => row.collections.total)}</td>
                            <td />
                            <td className={NUM}>{sum((row) => row.collections.cash)}</td>
                            <td className={NUM}>{rows.reduce((total, row) => total + row.collections.count, 0)}</td>
                            <td className={NUM}>{sum((row) => row.flow.closing)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </Panel>
    );
}

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
