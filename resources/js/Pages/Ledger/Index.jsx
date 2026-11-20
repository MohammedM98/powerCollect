import { FilterField } from '@/Components/DataTable/DataTableFilterMenu';
import { Button, Card, Input, Label, Switch } from '@heroui/react';
import BankReceivedDate from '@/Components/BankReceivedDate';
import TableExportActions from '@/Components/DataTable/TableExportActions';
import { BranchFilterBanner, splitBranchFilter } from '@/Components/BranchBanner';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Pagination from '@/Components/DataTable/Pagination';
import Icon from '@/Components/Icon';
import LatePaymentDetails from '@/Components/LatePaymentDetails';
import { useDataTable } from '@/hooks/useDataTable';
import { useRowClick } from '@/hooks/useRowClick';
import { useStatementWindow } from '@/hooks/useStatementWindow';
import { BALANCE_HINTS, BALANCE_WORDS, balanceTone, signedBalance } from '@/lib/balance';
import { formatClock, formatDayLabel, formatMoney, formatNumber, formatShortDay } from '@/lib/format';
import SplitPaymentBadge from '@/Pages/Payments/SplitPaymentBadge';
import StatementModal from '@/Pages/Subscriptions/StatementModal';
import './Ledger.css';
import PageHeader from '@/Components/PageHeader';
import MoneyFlow from '@/Components/Finance/MoneyFlow';
import InfoTip from '@/Components/InfoTip';
import DateInput from '@/Components/DateInput';
import { SearchableSelect } from '@/Components/UI';

const PERIODS = [['today', 'اليوم'], ['yesterday', 'أمس'], ['7', '7 أيام'], ['30', '30 يوم'], ['month', 'هذا الشهر'], ['custom', 'مخصص']];
const BANK_LOGOS = {
    'بنك فلسطين': '/images/banks/bank-of-palestine.webp',
    'جوال باي': '/images/banks/jawwal-pay.webp',
    'محفظة بالباي': '/images/banks/palpay.webp',
    'البنك الإسلامي الفلسطيني': '/images/banks/palestine-islamic-bank.webp',
    'البنك الإسلامي العربي': '/images/banks/arab-islamic-bank.webp',
    'بنك القدس': '/images/banks/quds-bank.webp',
};

/**
 * An amount, always shown positive (its side is in the line's type), or with
 * `balance` a balance with its sign: negative is credit in the
 * subscription's favour. A balance is coloured unless `colored` is false, as
 * in the column of each line's running balance.
 */
function Money({ amount, balance = false, colored = balance, paperWord = false }) {
    if (!balance) {
        return <bdi className="num" dir="ltr">{formatMoney(Math.abs(Number(amount)))} <span>₪</span></bdi>;
    }

    const tone = balanceTone(amount);

    return (
        <>
            <bdi className={`num ${colored ? `balance-${tone}` : ''}`} dir="ltr" title={BALANCE_HINTS[tone]}>{signedBalance(amount)} <span>₪</span></bdi>
            {paperWord && <span className="balance-paper-word"> {BALANCE_WORDS[tone]}</span>}
        </>
    );
}

function shortDate(value) {
    return value ? value.split('-').reverse().join('/') : 'البداية';
}

function DateRange({ period, range, today, onChange, errors }) {
    const [open, setOpen] = useState(false);
    const [from, setFrom] = useState(range.from ?? today);
    const [to, setTo] = useState(range.to);
    const [error, setError] = useState('');
    const root = useRef(null);
    const trigger = useRef(null);
    const firstInput = useRef(null);

    useEffect(() => {
        if (!open) { return; }
        firstInput.current?.focus();
        function dismiss(event) {
            if (event.type === 'keydown' && event.key === 'Escape') {
                setOpen(false);
                trigger.current?.focus();
            } else if (event.type === 'pointerdown' && !root.current?.contains(event.target) && !event.target.closest?.('[data-date-picker]')) {
                setOpen(false);
            }
        }
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', dismiss);
        return () => {
            document.removeEventListener('pointerdown', dismiss);
            document.removeEventListener('keydown', dismiss);
        };
    }, [open]);

    function toggle() {
        if (!open) {
            setFrom(range.from ?? today);
            setTo(range.to);
            setError('');
        }
        setOpen(!open);
    }

    function quickRange(preset) {
        const end = new Date(`${today}T12:00:00Z`);
        const start = new Date(end);
        if (preset === '7') {
            start.setUTCDate(start.getUTCDate() - 6);
        } else if (preset === 'month') {
            start.setUTCDate(1);
        } else {
            start.setUTCDate(1);
            end.setUTCDate(0);
            start.setUTCMonth(start.getUTCMonth() - 1);
        }
        setFrom(start.toISOString().slice(0, 10));
        setTo(end.toISOString().slice(0, 10));
        setError('');
    }

    function apply(event) {
        event.preventDefault();
        if (!from || !to || from > to) {
            setError('اختر تاريخ بداية ونهاية، بحيث تكون البداية قبل النهاية أو مساوية لها.');
            return;
        }
        onChange('custom', { from, to });
        setOpen(false);
        trigger.current?.focus();
    }

    return (
        <div className="per">
            <div className="pt2" role="group" aria-label="الفترة">
                {PERIODS.map(([value, label]) => (
                    <Button data-raw="" variant="ghost" key={value} aria-pressed={period === value} onClick={() => value === 'custom' ? toggle() : onChange(value)}>{label}</Button>
                ))}
            </div>
            <div className="range" ref={root}>
                <Button data-raw="" variant="ghost" className="rbtn" ref={trigger} onClick={toggle} aria-expanded={open} aria-controls="ledger-date-range">
                    <Icon name="calendar" /><small>الفترة</small><bdi className="num" dir="ltr">{shortDate(range.from)} — {shortDate(range.to)}</bdi>
                </Button>
                {open && (
                    <form id="ledger-date-range" className="rpop" onSubmit={apply} aria-labelledby="ledger-range-title">
                        <div className="range-heading">
                            <span className="range-heading-icon"><Icon name="calendar" /></span>
                            <div><h3 id="ledger-range-title">فترة مخصصة</h3><p>حدّد الفترة لعرض حركات السجل المالي.</p></div>
                            <Button data-raw="" variant="ghost" className="range-close" aria-label="إغلاق اختيار الفترة" onClick={() => { setOpen(false); trigger.current?.focus(); }}><Icon name="close" /></Button>
                        </div>
                        <div className="two">
                            <label htmlFor="ledger-from">تاريخ البداية<DateInput id="ledger-from" className="range-date-input" buttonRef={firstInput} required max={to || undefined} value={from} onChange={setFrom} /></label>
                            <label htmlFor="ledger-to">تاريخ النهاية<DateInput id="ledger-to" className="range-date-input" required min={from || undefined} value={to} onChange={setTo} /></label>
                        </div>
                        <span className="range-presets-label">اختيار سريع</span>
                        <div className="qk">
                            <Button data-raw="" variant="ghost" onClick={() => quickRange('7')}>آخر 7 أيام</Button>
                            <Button data-raw="" variant="ghost" onClick={() => quickRange('month')}>هذا الشهر</Button>
                            <Button data-raw="" variant="ghost" onClick={() => quickRange('previous')}>الشهر الماضي</Button>
                        </div>
                        {(error || errors.from || errors.to) && <p className="err" role="alert"><Icon name="info" />{error || errors.from || errors.to}</p>}
                        <div className="ft">
                            <Button data-raw="" variant="ghost" type="submit" className="btn pr"><Icon name="check" />تطبيق الفترة</Button>
                            <Button data-raw="" variant="ghost" className="btn" onClick={() => { setOpen(false); trigger.current?.focus(); }}>إلغاء</Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

/** A shekel figure in whole cents, so sums carry no float error. */
const toCents = (value) => Math.round(Number(value ?? 0) * 100);

/**
 * The period as an accountant reads it, on HeroUI cards: what the listed
 * subscribers owed when it began, plus its charges (مدين), less its credits
 * (دائن), equals what they owe at its end. Cancelled lines stay out.
 */
function PeriodEquation({ totals, summary, side, opening }) {
    const closing = (toCents(opening) + toCents(totals.net)) / 100;

    return (
        <section className="gl-eq" aria-label="معادلة الفترة">
            <Card className="gl-eq-term">
                <small>الرصيد الافتتاحي</small>
                <b><Money amount={opening} balance colored={false} /></b>
                <p>ما على المشتركين عند بداية الفترة</p>
            </Card>
            <span className="gl-eq-op" aria-hidden="true">+</span>
            <Card className="gl-eq-term" data-tone="owe">
                <small><i aria-hidden="true" />مدين (عليه)
                    {side === 'debit' && summary.changePct !== null && (
                        <span className={`gl-eq-chg ${summary.changePct >= 0 ? 'up' : 'dn'}`} title="مقارنة بالفترة السابقة"><bdi dir="ltr">{summary.changePct >= 0 ? '+' : '−'}{Math.abs(summary.changePct)}%</bdi></span>
                    )}
                </small>
                <b><Money amount={totals.charged} /></b>
                <p>{formatNumber(totals.debitCount)} قيد: قراءات ورسوم وغرامات</p>
            </Card>
            <span className="gl-eq-op" aria-hidden="true">−</span>
            <Card className="gl-eq-term" data-tone="pay">
                <small><i aria-hidden="true" />دائن (له)</small>
                <b><Money amount={totals.credited} /></b>
                <p>{formatNumber(totals.creditCount)} قيد: دفعات وخصومات ومقاصات</p>
            </Card>
            <span className="gl-eq-op" aria-hidden="true">=</span>
            <Card className="gl-eq-term is-total">
                <small>الرصيد الختامي</small>
                <b><Money amount={closing} balance colored={false} /></b>
                <p>{totals.cancelledCount > 0 ? <>{formatNumber(totals.cancelledCount)} قيد ملغى بقيمة <Money amount={totals.cancelled} />، خارج المعادلة</> : 'لا قيود ملغاة في الفترة'}</p>
            </Card>
        </section>
    );
}

function DayHeader({ day, totals, today }) {
    return (
        <tr className="data-table-group day-row"><td colSpan={9}>
            <div className="day"><b>{formatDayLabel(day)}</b>{day === today && <span className="tod">اليوم</span>}
                {totals && <span className="sum"><span>{formatNumber(totals.count)} قيد</span><span>عليه <em><Money amount={totals.charged} /></em></span><span>له <em className="g"><Money amount={totals.credited} /></em></span></span>}
            </div>
        </td></tr>
    );
}

function TransactionRow({ entry, grouped, onOpen, rowClick, open, onToggle, running }) {
    const initials = entry.subscriptionName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('');
    const balance = Number(entry.balanceAfter ?? 0);
    const time = grouped ? formatClock(entry.time) : `${formatShortDay(entry.day)}، ${formatClock(entry.time)}`;
    const payment = entry.bankName || entry.paymentMethodLabel;
    return (
        <>
        <tr className={`row ${entry.isCancelled ? 'cx' : ''} ${open ? 'is-open' : ''}`} {...rowClick(onOpen)}>
            <td className="xp-c">
                <Button data-raw="" variant="ghost" className="dt-exp-btn" aria-expanded={open} aria-controls={`ledger-details-${entry.id}`} aria-label={`${open ? 'إخفاء' : 'عرض'} تفاصيل القيد`} onClick={(event) => { event.stopPropagation(); onToggle(); }}>
                    <Icon name="chevron-down" />
                </Button>
            </td>
            <td className="t"><bdi className="desktop-time">{time}</bdi>
                <LatePaymentDetails paidOn={entry.paidOn} recordedAt={`${entry.day} ${entry.time}`} reason={entry.lateReason} />
                <BankReceivedDate value={entry.bankReceivedOn} />
                <div className="meta">
                    <span><Icon name="clock" />{time}</span>
                    {entry.voucherNumber && <span>سند <bdi>{entry.voucherNumber}</bdi>{entry.isManualVoucher && '، يدوي'}</span>}
                    {payment && <span>{payment}</span>}
                    {entry.referenceNumber && <span>مرجع <bdi>{entry.referenceNumber}</bdi></span>}
                    {entry.splitPayment && <SplitPaymentBadge split={entry.splitPayment} compact />}
                    <span>سجّله: {entry.recordedByName ?? '—'}</span>
                </div>
            </td>
            <td className="who-c">
                <div className="who"><span className="av" aria-hidden="true">{initials}</span><div>
                    <b>{onOpen ? <Button data-raw="" variant="ghost" className="name-btn" onClick={onOpen} aria-label={`فتح كشف حساب ${entry.subscriptionName}`}>{entry.subscriptionName}</Button> : entry.subscriptionName}</b>
                    <small><bdi>{entry.subscriptionAccountNumber}</bdi>، {entry.branchName}</small>
                </div></div>
            </td>
            <td className="ty-c"><span className={`ty ${entry.isCancelled ? 'rv' : entry.isCredit ? 'cr' : 'dr'}`}>{entry.typeLabel}</span>{entry.isCancelled && entry.type !== 'reversal' && <div><span className="cxb">ملغاة</span></div>}</td>
            <td className="vch-c"><bdi className="vch">{entry.voucherNumber ?? '—'}</bdi>{entry.isManualVoucher && <span className="mb">يدوي</span>}</td>
            <td className="by" title={entry.recordedByName ?? undefined}>{entry.recordedByName ?? '—'}</td>
            {[false, true].map((creditSide) => (
                <td key={creditSide ? 'cr' : 'dr'} className={`am-c ${entry.isCredit === creditSide ? '' : 'is-empty'}`}>
                    {entry.isCredit === creditSide ? (
                        <span className={`am ${entry.isCredit ? 'cr' : 'dr'}`}><Money amount={entry.amount} />
                            {entry.currency && entry.currency !== 'ILS' && <small><bdi dir="ltr">{formatMoney(entry.currencyAmount)} {entry.currency}{entry.exchangeRate && ` × ${formatMoney(entry.exchangeRate)}`}</bdi></small>}
                        </span>
                    ) : <span className="am-none" aria-hidden="true">—</span>}
                </td>
            ))}
            <td className="bal-c"><span className="blc">{running !== undefined ? <Money amount={running} balance colored={false} /> : entry.balanceAfter === null ? '—' : <Money amount={balance} balance colored={false} paperWord />}</span></td>
        </tr>
        {open && (
            <tr id={`ledger-details-${entry.id}`} className="row-detail">
                <td>
                    <dl>
                        <div><dt>الطريقة والبنك</dt><dd>{payment ? <span className="mth">{BANK_LOGOS[entry.bankName] ? <img src={BANK_LOGOS[entry.bankName]} alt="" /> : <span className="ci"><Icon name={entry.paymentMethod === 'cash' ? 'wallet' : 'bank'} /></span>}<span>{payment}</span></span> : '—'}</dd></div>
                        <div><dt>المرجع</dt><dd><bdi dir="ltr">{entry.referenceNumber ?? '—'}</bdi>{entry.splitPayment && <div className="mt-1"><SplitPaymentBadge split={entry.splitPayment} compact /></div>}</dd></div>
                        <div><dt>التاريخ</dt><dd>{formatShortDay(entry.day)}، {formatClock(entry.time)}</dd></div>
                        <div><dt>الفرع</dt><dd>{entry.branchName}</dd></div>
                        {running !== undefined && <div><dt>رصيد المشترك بعده</dt><dd>{entry.balanceAfter === null ? '—' : <Money amount={balance} balance colored={false} paperWord />}</dd></div>}
                    </dl>
                </td>
            </tr>
        )}
        </>
    );
}

export default function Index({ entries, period, dateBasis = 'recorded', side, summary, ledgerTotals, openingBalance = '0.00', newerNet = null, dateRange, dayTotals, today, scopeLabel, branchScope, filters, filterOptions, statement }) {
    const { can, errors = {} } = usePage().props;
    const extraParams = { period, date_basis: dateBasis, ...(period === 'custom' ? dateRange : {}) };
    const { search, setSearch, sort, setPerPage, filterValues, setFilter, setFilters, clearFilters } = useDataTable('/ledger', filters, extraParams);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [openIds, setOpenIds] = useState(() => new Set());
    const toggleRow = (id) => setOpenIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
    const rowClick = useRowClick();
    const statementWindow = useStatementWindow(statement);
    const grouped = filters.sort !== 'amount';
    // The log's running balance, newest first: the closing balance less the lines on the pages before, then each line's side.
    const runningBalances = (() => {
        if (newerNet === null) {
            return null;
        }
        let cents = toCents(openingBalance) + toCents(ledgerTotals.net) - toCents(newerNet);

        return entries.data.map((entry) => {
            const after = cents / 100;
            if (!entry.isCancelled) {
                cents -= (entry.isCredit ? -1 : 1) * toCents(entry.amount);
            }

            return after;
        });
    })();
    // An auditor of several branches picks the branch in the banner above the log, not among the filters; clearing those keeps it.
    const branchFilter = splitBranchFilter(branchScope, filterOptions, filterValues);
    const activeFilters = Object.values(branchFilter.values).filter((value) => value !== '' && value !== null && value !== undefined).length;
    const clearPanelFilters = () => branchFilter.clear(setFilters, clearFilters);

    function changePeriod(next, dates = {}) {
        router.get('/ledger', { search, sort: filters.sort, direction: filters.direction, per_page: filters.per_page, filter: filterValues, date_basis: dateBasis, period: next, ...dates }, { preserveState: true, preserveScroll: true, replace: true });
    }

    /** The subscriber's statement over the page, opened at this transaction. */
    function openStatement(entry) {
        statementWindow.open({ id: entry.subscriptionId, fullName: entry.subscriptionName, accountNumber: entry.subscriptionAccountNumber, status: entry.subscriptionStatus, statusLabel: entry.subscriptionStatusLabel, branchName: entry.branchName }, null, entry.id);
    }

    function sortHeading(column, label) {
        return <th scope="col" aria-sort={filters.sort === column ? filters.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><Button data-raw="" variant="ghost" onClick={() => sort(column)}>{label}{filters.sort === column && <Icon name="chevron-down" className={filters.direction === 'asc' ? 'rotate-180' : ''} />}</Button></th>;
    }

    return (
        <AuthenticatedLayout
            scope={branchScope?.name ?? null}
            header={
                <PageHeader
                    title="السجل المالي"
                    info={`القيود حسب التاريخ والفرع${!branchScope && scopeLabel && scopeLabel !== '—' ? `، في ${scopeLabel}` : ''}.`}
                />
            }
        >
            <Head title="السجل المالي" />
            {branchScope && <BranchFilterBanner scope={branchScope} eyebrow="يعرض السجل المالي لـ" group={branchFilter.branch} value={filterValues.branch_id} onChange={(value) => setFilter('branch_id', value)} />}
            <MoneyFlow />
            <div className="ledger-page">
                {!errors.from && !errors.to ? null : <p role="alert" className="err">{errors.from || errors.to}</p>}
                <PeriodEquation totals={ledgerTotals} summary={summary} side={side} opening={openingBalance} />
                <section className="pn" aria-label="القيود المالية">
                    <div className="tb">
                        <div className="srch">
                            <Icon name="search" className="search-icon" />
                            <label htmlFor="ledger-search" className="sr-only">البحث في السجل المالي</label>
                            <Input id="ledger-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بالاسم، الهاتف، رقم الحساب، رقم السند أو الرقم المرجعي…" autoComplete="off" aria-describedby="ledger-search-hint" />
                            <div className="hint sr-only" id="ledger-search-hint">البحث يشمل: <span>الاسم</span><span>الهاتف</span><span>الحساب</span><span>السند</span><span>المرجع</span></div>
                        </div>
                        <div className="per-bar">
                            <div className="flex items-center gap-1">
                                <SearchableSelect id="ledger-date-basis" variant="pill" prefix={<span className="gl-filter-name"><Icon name="calendar" className="h-[15px] w-[15px]" />تصفية الفترة حسب:</span>} className="gl-filter-item" clearable={false} searchable={false} value={dateBasis} options={[{ value: 'recorded', label: 'تاريخ التسجيل بالنظام' }, { value: 'paid', label: 'تاريخ الدفع الفعلي' }]} onChange={(value) => changePeriod(period, { ...(period === 'custom' ? dateRange : {}), date_basis: value })} />
                                <InfoTip label="عن تصفية الفترة">{dateBasis === 'paid' ? 'عرض حسب تاريخ الدفع الفعلي للدفعات المتأخرة، وتاريخ التسجيل لبقية الحركات. الأرصدة وترتيب الحركات يبقيان حسب التسجيل.' : 'الأرصدة والفترات تُحتسب حسب تاريخ التسجيل. تاريخ الدفع السابق محفوظ للتدقيق.'}</InfoTip>
                            </div>
                            <DateRange period={period} range={dateRange} today={today} onChange={changePeriod} errors={errors} />
                        </div>
                        <Button data-raw="" variant="ghost" className="btn fbtn" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="ledger-filters"><Icon name="filter" />الفلاتر{activeFilters > 0 && <span className="num">{activeFilters}</span>}</Button>
                        {can?.printAuditReports !== false && <TableExportActions title="السجل المالي" />}
                    </div>
                    <div className={`fb ${filtersOpen ? 'open' : ''}`} id="ledger-filters">
                        {branchFilter.groups.map((group) => (
                            <FilterField key={group.key} group={group} value={filterValues[group.key] ?? ''} onChange={(value) => setFilter(group.key, value ?? '')} />
                        ))}
                        <Switch isSelected={filterValues.show_cancelled !== '0'} onChange={(on) => setFilter('show_cancelled', on ? '' : '0')} className="gl-filter-switch">
                            <Switch.Content>
                                <Switch.Control><Switch.Thumb /></Switch.Control>
                                <Label>إظهار الملغاة</Label>
                            </Switch.Content>
                        </Switch>
                        {activeFilters > 0 && <Button data-raw="" variant="ghost" className="clr" onClick={clearPanelFilters}>مسح الفلاتر</Button>}
                    </div>
                    <table data-excel-source="custom" className="ledger-table" aria-label="السجل المالي">
                        <thead><tr><th scope="col"><span className="sr-only">تفاصيل</span></th>{sortHeading('created_at', 'الوقت')}<th scope="col">المشترك</th><th scope="col">النوع</th><th scope="col">السند</th><th scope="col">سجّله</th>{sortHeading('amount', 'مدين (عليه)')}<th scope="col">دائن (له)</th><th scope="col">{runningBalances ? 'رصيد السجل بعده' : 'رصيد المشترك بعده'}</th></tr></thead>
                        <tbody>{entries.data.length === 0 ? <tr className="empty"><td colSpan={9}><b>لا توجد قيود مطابقة</b>جرّب فترة أخرى أو غيّر البحث والفلاتر.</td></tr> : entries.data.map((entry, index) => <Fragment key={entry.id}>{grouped && entry.day !== entries.data[index - 1]?.day && <DayHeader day={entry.day} totals={dayTotals[entry.day]} today={today} />}<TransactionRow entry={entry} grouped={grouped} rowClick={rowClick} onOpen={can?.viewSubscriptions ? () => openStatement(entry) : null} open={openIds.has(entry.id)} onToggle={() => toggleRow(entry.id)} running={runningBalances ? runningBalances[index] : undefined} /></Fragment>)}</tbody>
                    </table>
                    <div className="foot data-table-totals">
                        <div>الافتتاحي<b><Money amount={openingBalance} balance colored={false} /></b></div>
                        <div>مدين (عليه)<b className="dr"><Money amount={ledgerTotals.charged} /></b></div>
                        <div>دائن (له)<b className="g"><Money amount={ledgerTotals.credited} /></b></div>
                        <div>الختامي<b><Money amount={(toCents(openingBalance) + toCents(ledgerTotals.net)) / 100} balance colored={false} /></b></div>
                        <span className="r">{formatNumber(entries.total)} قيد مطابق، الملغاة خارج المجاميع</span>
                    </div>
                    <div className="ledger-pagination">
                        <div className="w-44">
                            <label htmlFor="ledger-per-page" className="sr-only">عدد القيود في الصفحة</label>
                            <SearchableSelect
                                id="ledger-per-page"
                                value={filters.per_page}
                                onChange={setPerPage}
                                options={[15, 25, 50, 100].map((count) => ({ value: count, label: `${count} قيد / صفحة` }))}
                                clearable={false}
                                searchable={false}
                            />
                        </div>
                        <Pagination meta={entries} filters={filters} baseUrl="/ledger" extraParams={extraParams} />
                    </div>
                </section>
            </div>
            {statementWindow.subscription && <StatementModal key={statementWindow.subscription.id} subscription={statementWindow.subscription} statement={statementWindow.statement} initialForm={statementWindow.form} focusLineId={statementWindow.focusLineId} onSwitch={(header) => statementWindow.open(header)} onClose={statementWindow.close} />}
        </AuthenticatedLayout>
    );
}
