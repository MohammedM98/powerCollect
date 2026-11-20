import { useState } from 'react';
import TableExportActions from '@/Components/DataTable/TableExportActions';
import { Link } from '@inertiajs/react';
import AuditApprovalDialog from './AuditApprovalDialog';
import BankTransferAuditForm from './BankTransferAuditForm';
import ActionsTh from '@/Components/DataTable/ActionsTh';
import ColumnWidths, { fixedTableStyle } from '@/Components/DataTable/ColumnWidths';
import Icon from '@/Components/Icon';
import Modal from '@/Components/Modal';
import { Button, Chip, SearchField } from '@heroui/react';
import { BankMark } from '@/Components/Banks';
import { formatMoney } from '@/lib/format';
import { boxTypes, currencies, dateTime } from './CollectorCashBox';
import { FinancialBoxMark, FinancialBoxStatus } from './FinancialBoxComponents';
import { ledgerColumns, ledgerOf, ledgerTableClass, BoxNumberCell, LedgerLeadCells, LedgerTrailCells } from './LedgerColumns';
import BoxBreakdown, { breakdownEntry } from './BoxBreakdown';
import { auditApprovalSummary, boxBankOptions, filterBoxEntries, entryStatus, isFlaggedEntry } from '@/lib/financialBoxes';
import './financial-boxes.css';
import { ConfirmDialog, SearchableSelect, SegmentedChoice, StatusPill } from '@/Components/UI';


/** A small action in an entry's row. */
const rowButton = 'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-gray-100';
const auditEditButton = `${rowButton} border border-brand-500/25 bg-brand-500/5 text-brand-700 hover:border-brand-500/40 hover:bg-brand-500/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-300`;

const isActive = (entry) => !entry.transaction || entry.transaction.status === 'active';
const subscriberName = (entry) => entry.transaction?.subscription?.subscription_name || entry.transaction?.subscription?.full_name || '—';

/** Amounts added up by currency. */
function sumByCurrency(entries) {
    return Object.fromEntries(Object.keys(currencies).map((currency) => [currency, entries.filter((entry) => entry.currency === currency).reduce((sum, entry) => sum + Number(entry.amount), 0)]));
}

/** Amounts as one line, shekels always and another currency only when it has some. */
function amountsLine(amounts) {
    return Object.keys(currencies).filter((currency) => currency === 'ILS' || Number(amounts?.[currency] ?? 0) !== 0).map((currency) => `${formatMoney(amounts?.[currency] ?? 0)} ${currencies[currency]}`).join('، ');
}

/** The foreign currencies among amounts, as one quiet line, or nothing when there are none. */
function otherCurrencies(amounts) {
    const lines = Object.keys(currencies).filter((currency) => currency !== 'ILS' && Number(amounts?.[currency] ?? 0) !== 0).map((currency) => `${formatMoney(amounts[currency])} ${currencies[currency]}`);

    return lines.length ? lines.join('، ') : undefined;
}

/** One figure in the box's summary, on its own card. */
function Stat({ icon, label, value, hint }) {
    return <div className="gl-kpi gl-bd-stat">
        <small><Icon name={icon} className="h-4 w-4" />{label}</small>
        <b>{value}</b>
        {hint && <span>{hint}</span>}
    </div>;
}

/** One step of a box's life on its timeline: when it happened and who did it, or that it has not yet. */
function JourneyStep({ icon, label, at, by, pending }) {
    return <li className="gl-bd-step" data-done={at ? '' : undefined}>
        <span className="gl-bd-step-icon" aria-hidden="true"><Icon name={icon} className="h-4 w-4" /></span>
        <span className="min-w-0">
            <b>{label}</b>
            {at ? <><span className="gl-num">{dateTime(at)}</span>{by && <small>{by}</small>}</> : <small>{pending}</small>}
        </span>
    </li>;
}

/** The box's life as a timeline: opened, closed, and approved by the audit. */
function Journey({ box }) {
    const closed = box.status === 'received';

    return <ol aria-label="مسار الصندوق" className="gl-bd-journey">
        <JourneyStep icon="clock" label="فُتح" at={box.opened_at} by={box.user?.name} />
        <JourneyStep icon="lock" label="أُغلق" at={closed ? box.closedAt ?? box.closed_at : null} by={box.closedBy} pending="لم يُغلق بعد" />
        <JourneyStep icon="check" label="اعتماد التدقيق" at={box.audit?.audited_at ?? null} by={box.audit?.auditor?.name} pending={closed ? 'بانتظار قسم التدقيق' : 'بعد إغلاق الصندوق'} />
    </ol>;
}

/**
 * One box, large: who it belongs to, its totals, when it was opened, closed
 * and by whom, and every entry in it as the subscriber's statement
 * shows it. The branch confirms an open box closed from the footer once the
 * collector has corrected anything it raised with them. The branch does not check transfers or clearings one by
 * one: the audit does.
 */
export default function BoxDetails({ box, onClose, perform, initialSearch = '' }) {
    const [search, setSearch] = useState(initialSearch);
    const [filter, setFilter] = useState('all');
    const [bank, setBank] = useState('');
    const [confirmingClose, setConfirmingClose] = useState(false);
    const [confirmingAudit, setConfirmingAudit] = useState(false);
    const [auditingEntry, setAuditingEntry] = useState(null);
    const type = box.type ?? 'cash';
    const cash = type === 'cash';
    const clearing = type === 'clearing';
    const entries = box.payments ?? [];
    const active = entries.filter(isActive);
    const totals = sumByCurrency(active);
    const editable = ['open', 'pending'].includes(box.status);
    const confirmable = box.canCount && ['open', 'pending'].includes(box.status);
    const bankAudit = !editable && type === 'bank_transfer';
    const counted = cash && box.head_counts && box.expected_counts && Object.keys(currencies).some((currency) => Number(box.head_counts[currency] ?? 0) !== Number(box.expected_counts[currency] ?? 0));
    const groups = {
        all: ['الكل', () => true],
        active: ['سارية', (entry) => isActive(entry) && !isFlaggedEntry(entry)],
        ...(cash ? {} : { rejected: [clearing ? 'مرفوضة' : 'غير موجودة', (entry) => isActive(entry) && isFlaggedEntry(entry)] }),
        cancelled: ['ملغاة', (entry) => !isActive(entry)],
    };
    const filterOptions = Object.entries(groups).map(([value, [label, matches]]) => ({ value, label: `${label}، ${entries.filter(matches).length}`, count: entries.filter(matches).length })).filter((option) => option.value === 'all' || option.count > 0);
    const banks = type === 'bank_transfer' ? boxBankOptions(entries) : [];
    const shown = filterBoxEntries(entries, { bank, state: filter, search });
    const columns = [['الصندوق', 72], ...ledgerColumns.before, ['المشترك', 150], ...ledgerColumns.after, ['الحالة', 140], ...(bankAudit ? [['تدقيق البنك', 220]] : []), ['', 110]];
    const widths = columns.map(([, width]) => width);

    return <Modal show onClose={onClose} maxWidth="full" panelClassName="financial-box-detail gl-bd flex flex-col">
        <header className="gl-bd-head">
            <FinancialBoxMark box={box} large />
            <div className="min-w-0 flex-1">
                <h2>{boxTypes[type]}، صندوق <bdi dir="ltr" className="gl-num">{box.number}</bdi></h2>
                <p>{box.user?.name ?? '—'}{box.opened_at ? `، فُتح ${dateTime(box.opened_at)}` : ''}</p>
            </div>
            <FinancialBoxStatus box={editable ? box : { ...box, audit: box.audit ?? null }} />
            {box.canPrint !== false && <TableExportActions title="تقرير تفاصيل الصندوق" base={`/payments/cash-boxes/report?box=${box.id}`} />}
            <Button data-raw="" variant="ghost" onClick={onClose} aria-label="إغلاق النافذة" className="gl-ib"><Icon name="close" className="h-[18px] w-[18px]" /></Button>
        </header>

        <div className="gl-bd-body">
            <div className="gl-bd-stats">
                <Stat icon="wallet" label="إجمالي الحركات السارية" value={<><bdi dir="ltr">{formatMoney(totals.ILS)}</bdi> <span className="gl-kpi-unit">₪</span></>} hint={otherCurrencies(totals)} />
                <Stat icon="list" label="الحركات" value={active.length.toLocaleString('en')} hint={entries.length > active.length ? `و${entries.length - active.length} ملغاة` : 'لا حركات ملغاة'} />
                <Stat icon={editable ? 'unlock' : 'lock'} label="تصحيح الحركات" value={<span className="gl-bd-word">{editable ? 'متاح للمحصّل' : 'مقفل'}</span>} hint={editable ? 'حتى تأكيد إغلاق الصندوق' : 'أُكّد إغلاق الصندوق'} />
                <Stat icon="calendar" label="فُتح ← أُغلق" value={<span className="gl-bd-date">{dateTime(box.opened_at)}</span>} hint={box.closed_at ? dateTime(box.closed_at) : 'لا يزال مفتوحًا'} />
            </div>

            <Journey box={box} />

            {!editable && <section aria-label="تدقيق الصندوق" className="gl-bd-card">
                <div className="flex flex-wrap items-center justify-between gap-3"><h3>مراجعة قسم التدقيق</h3>{box.audit ? <p className="text-sm text-gray-600">اعتمدها {box.audit.auditor?.name}، {dateTime(box.audit.audited_at)}</p> : box.canAudit && <Button isDisabled={!box.canCompleteAudit} onPress={() => setConfirmingAudit(true)} className="gl-sheet-btn is-primary"><Icon name="check" className="h-4 w-4" />اعتماد الصندوق كاملًا</Button>}</div>
                {bankAudit && <p className="text-sm leading-7 text-gray-600">حُفظت مراجعة <b>{box.auditSummary?.reviewed ?? 0}</b> من <b>{box.auditSummary?.total ?? active.length}</b> حوالة. المثبت بحسب المراجعات: <b>{formatMoney(box.auditSummary?.verified ?? 0)} شيكل</b>، صافي الفروق على المشتركين: <b dir="ltr">{formatMoney(box.auditSummary?.difference ?? 0)} شيكل</b>. إجمالي الصندوق التاريخي محفوظ كما أُغلق.</p>}
                {bankAudit && (box.canReviewTransfers ?? box.canAudit) && <p className="text-sm leading-7 text-gray-600">سجّل الحوالات التي فيها مشاكل فقط. عند اعتماد الصندوق تُرحّل فروق المراجعات المحفوظة ماليًا وتُعتمد بقية الحوالات كمطابقة تلقائيًا.</p>}
            </section>}

            <BoxBreakdown type={type} entries={active.map(breakdownEntry)} />

            {confirmable && <p className="gl-bd-note"><Icon name="info" className="mt-1 h-4 w-4 shrink-0" />اطّلع على حركات الصندوق ثم أكّد إغلاقه. إن رأيت خطأ في حركة فتواصل مع المحصّل ليعدّلها بنفسه قبل التأكيد؛ بعد التأكيد تُقفل الحركات وينتقل الصندوق إلى «المغلقة» ويظهر تلقائيًا لقسم التدقيق ضمن فترة إغلاقه الأسبوعية.</p>}


            <section aria-label="حركات الصندوق" className="gl-bd-entries">
                <div className="gl-st-bar">
                    <h3 className="me-auto">حركات الصندوق</h3>
                    <SegmentedChoice label="حالة الحركة" value={filter} onChange={setFilter} options={filterOptions} />
                </div>
                <div className="gl-st-bar gl-st-filters" data-table-toolbar="">
                    <SearchField aria-label="ابحث في حركات الصندوق" value={search} onChange={setSearch} className="gl-st-search">
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="ابحث بالمشترك أو رقم الحساب أو السند أو الحوالة" />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                    {type === 'bank_transfer' && (
                        <SearchableSelect
                            id="box-entry-bank"
                            variant="pill"
                            prefix={<span className="gl-filter-name"><Icon name="bank" className="h-[15px] w-[15px]" />البنك{bank ? ':' : ''}</span>}
                            placeholder="كل البنوك والمحافظ"
                            active={Boolean(bank)}
                            value={bank}
                            onChange={(value) => setBank(value ?? '')}
                            clearable={Boolean(bank)}
                            portal
                            searchPlaceholder="ابحث عن بنك أو محفظة"
                            className="gl-filter-item"
                            options={banks.map((option) => ({ value: option.value, label: option.value, hint: String(option.count), icon: <BankMark bank={option.value} className="h-6 w-6 rounded-md" /> }))}
                        />
                    )}
                    <span className="flex-1" />
                    <div data-table-export-slot className="flex items-center empty:hidden" />
                </div>
                <div className="data-table-container financial-ledger-container gl-bd-table">
                    <table className={ledgerTableClass} style={fixedTableStyle(widths)}>
                        <ColumnWidths widths={widths} />
                        <thead><tr>{columns.map(([label], index) => index === columns.length - 1 ? <ActionsTh key={index} /> : <th key={index}>{label}</th>)}</tr></thead>
                        <tbody>
                            {shown.length === 0 ? (
                                <tr><td colSpan={columns.length} className="text-center text-gray-500">{entries.length ? 'لا توجد حركات تطابق البحث والفلاتر المحددة.' : 'لا توجد حركات في هذا الصندوق.'}</td></tr>
                            ) : shown.map((entry) => {
                                const [label, tone] = entryStatus(entry);
                                const live = isActive(entry);
                                const ledger = ledgerOf(entry);

                                return <tr key={entry.id} className={live ? undefined : 'opacity-60'}>
                                    <BoxNumberCell number={box.number} position={entries.indexOf(entry) + 1} />
                                    <LedgerLeadCells ledger={ledger} />
                                    <td title={subscriberName(entry)} className="whitespace-normal!">
                                        {entry.statement_url ? <Link href={entry.statement_url} prefetch className="font-semibold text-gray-900 hover:text-brand-600">{subscriberName(entry)}</Link> : <span className="font-semibold text-gray-900">{subscriberName(entry)}</span>}
                                        <span className="block font-display text-xs text-gray-400"><bdi dir="ltr">{entry.transaction?.subscription?.account_number ?? '—'}</bdi></span>
                                    </td>
                                    <LedgerTrailCells ledger={ledger} amount={entry.amount} currency={entry.currency} cancelled={!live} />
                                    <td className="whitespace-normal!"><Chip size="sm" className="gl-cb-chip" data-state={{ green: 'closed', red: 'bad', amber: 'waiting', blue: 'open' }[tone] ?? 'cancelled'}><i aria-hidden="true" />{label}</Chip></td>
                                    {bankAudit && <td className="whitespace-normal!">{entry.audit ? <div className="space-y-1"><StatusPill tone={entry.audit.outcome === 'missing' ? 'red' : entry.audit.outcome === 'matched' ? 'green' : 'amber'} label={{ matched: 'مطابقة', missing: 'غير موجودة', short: 'نقص في المبلغ', over: 'زيادة لصالح المشترك' }[entry.audit.outcome]} /><p className="text-xs font-semibold text-gray-600">{entry.audit.posted_at || entry.audit.adjustment_transaction_id ? 'معتمدة نهائيًا' : 'مسودة، لم تُرحّل ماليًا'}</p><p className="text-xs text-gray-600">المثبت: {formatMoney(entry.audit.bank_amount)} {ledger.currencyLabel}</p><p className="text-xs text-gray-500">{entry.audit.auditor?.name}، {dateTime(entry.audit.audited_at)}</p>{entry.audit.reason && <p className="text-xs text-gray-600">{entry.audit.reason}</p>}</div> : <StatusPill tone="gray" label={live ? 'تُطابق عند اعتماد الصندوق' : 'حركة غير سارية'} />}</td>}
                                    <td className="whitespace-normal!"><div className="flex flex-wrap items-center gap-1">
                                        {bankAudit && (box.canReviewTransfers ?? box.canAudit) && live && !entry.audit?.posted_at && !entry.audit?.adjustment_transaction_id && <Button data-raw="" variant="ghost" onClick={() => setAuditingEntry(entry)} className={auditEditButton}><Icon name="pencil" className="h-3.5 w-3.5" />تعديل الحوالة</Button>}
                                        {box.canPrint !== false && entry.receipt_url && <a href={entry.receipt_url} target="_blank" rel="noopener noreferrer" className={`${rowButton} tone-print border`}><Icon name="printer" className="h-3.5 w-3.5" />السند</a>}
                                    </div></td>
                                </tr>;
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="gl-st-foot" aria-live="polite" aria-atomic="true">
                    <p>المعروض <b>{shown.length}</b> من <b>{entries.length}</b> حركة</p>
                    <p>مجموع الحركات السارية المعروضة: <b>{amountsLine(sumByCurrency(shown.filter(isActive)))}</b></p>
                </div>
            </section>

            {counted && <BoxCountSummary box={box} />}
            {auditingEntry && <BankTransferAuditForm key={auditingEntry.id} entry={auditingEntry} onClose={() => setAuditingEntry(null)} />}
        </div>

        <footer className="gl-dialog-foot gl-sheet-foot">
            <span className="gl-sheet-keys">الإجمالي: <b className="gl-num">{amountsLine(totals)}</b>، {active.length} حركة سارية</span>
            <Button onPress={onClose} className="gl-sheet-btn">إغلاق النافذة</Button>
            {confirmable && <Button isDisabled={entries.length === 0} onPress={() => setConfirmingClose(true)} className="gl-sheet-btn is-primary"><Icon name="check" className="h-4 w-4" />تأكيد إغلاق الصندوق</Button>}
        </footer>
        <ConfirmDialog
            show={confirmingClose}
            onCancel={() => setConfirmingClose(false)}
            onConfirm={() => { setConfirmingClose(false); perform('receive', box); }}
            title="إغلاق الصندوق؟"
            message="تُقفل الحركات بعد الإغلاق، ويصبح الصندوق متاحًا للتدقيق."
            confirmLabel="نعم، أغلق الصندوق"
            icon="lock"
        >
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-control bg-gray-50 p-5">
                <div><dt className="text-base text-gray-600">الصندوق</dt><dd className="mt-1 font-semibold text-gray-900">{boxTypes[type]}، <bdi dir="ltr">{box.number}</bdi></dd></div>
                <div><dt className="text-base text-gray-600">المحصّل</dt><dd className="mt-1 font-semibold text-gray-900">{box.user?.name ?? '—'}</dd></div>
                <div><dt className="text-base text-gray-600">الإجمالي</dt><dd className="mt-1 font-display text-xl font-bold text-gray-900">{amountsLine(totals)}</dd></div>
                <div><dt className="text-base text-gray-600">الحركات السارية</dt><dd className="mt-1 font-display text-xl font-bold text-gray-900">{active.length}</dd></div>
            </dl>
        </ConfirmDialog>
        {confirmingAudit && <AuditApprovalDialog title="اعتماد تدقيق الصندوق؟" scope={`${boxTypes[type]}، صندوق ${box.number}، ${box.user?.name ?? '—'}`} summary={auditApprovalSummary([box])} url={box.completeAuditUrl} onClose={() => setConfirmingAudit(false)} />}
    </Modal>;
}

/** A cash box the branch counted under the old two-step receipt: each currency's expected, counted and received amounts. */
function BoxCountSummary({ box }) {
    if (!box.expected_counts) return null;
    const money = (amount) => formatMoney(amount ?? 0);

    return <div className="overflow-x-auto rounded-panel border border-gray-100 bg-surface">
        <table className="w-full text-start text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['العملة', 'المتوقع', 'عدّ المحصّل', 'عدّ المستلم', 'الفرق', 'القرار'].map((title) => <th key={title} className="whitespace-nowrap p-3 text-start">{title}</th>)}</tr></thead>
            <tbody>{Object.entries(currencies).map(([currency, label]) => <tr key={currency} className="border-t border-gray-100 text-gray-700">
                <td className="p-3">{label}</td>
                <td className="p-3 font-display" dir="ltr">{money(box.expected_counts[currency])}</td>
                <td className="p-3 font-display" dir="ltr">{box.collector_counts ? money(box.collector_counts[currency]) : '—'}</td>
                <td className="p-3 font-display" dir="ltr">{box.head_counts ? money(box.head_counts[currency]) : '—'}</td>
                <td className="p-3 font-display" dir="ltr">{box.head_counts ? money(Number(box.head_counts[currency]) - Number(box.expected_counts[currency])) : '—'}</td>
                <td className="p-3">{box.decisions?.[currency] === 'debt' ? 'دين على المحصّل' : box.decisions?.[currency] === 'accepted' ? 'مقبول' : '—'}</td>
            </tr>)}</tbody>
        </table>
        {box.reason && <p className="border-t border-gray-100 p-3 text-xs text-gray-500">السبب: {box.reason}</p>}
    </div>;
}
