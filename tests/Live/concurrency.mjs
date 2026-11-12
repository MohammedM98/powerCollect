import { cents, clock, MobileClient, money, one, Report, scalar, Session, sql, uuid } from './lib.mjs';
import { BANK, loadCompany, signInStaff, subscriberForm } from './company.mjs';
import { auditBooks } from './books.mjs';

/**
 * What only a real server shows: many people pressing at the same moment.
 * Each race is sent as truly parallel requests to a multi-worker server on
 * the production database engine; afterwards exactly one outcome may stand,
 * no request may end in a server error, and the books must still add up.
 */
const report = new Report('concurrency');
clock.set(process.env.LIVE_TEST_CLOCK_AT ?? '2026-11-26T08:00:00Z'); // A Thursday after the lifecycle's weeks.
const company = loadCompany();
const staff = await signInStaff(company);
const { manager, collector, collector2, reader, accountant, auditor, owner } = staff;
staff.auditor.home = '/payments/cash-boxes?place=closed';
const branch = company.branches.a;
const week = scalar(`select date_format(date_sub('${clock.date()}', interval 6 day), '%Y-%m-%d')`);

const statuses = (responses) => Object.entries(responses.reduce((count, response) => ({ ...count, [response.status]: (count[response.status] ?? 0) + 1 }), {})).map(([status, count]) => `${status}×${count}`).join(' ');
const noServerError = (name, responses) => report.check(`${name}: no request ended in a server error`, responses.every((response) => response.status < 500), statuses(responses) + ' ' + (responses.find((response) => response.status >= 500)?.text.slice(0, 300).replace(/\s+/g, ' ') ?? ''));
const succeeded = (responses) => responses.filter((response) => response.ok).length;
/** More browsers of the same people, so the races are not serialised by one session. */
const browsers = async (name, count) => Promise.all(Array.from({ length: count }, async () => {
    const session = new Session(name);
    await session.signIn(company.users[name].username);

    return session;
}));
const balance = (id) => money(cents(scalar(`select coalesce(sum(amount), 0) from subscription_transactions where subscription_id=${id}`)));
let counter = 0;
const register = async (overrides = {}) => {
    counter++;
    const nationalId = `47${String(counter).padStart(7, '0')}`;
    const response = await manager.post('/subscriptions', subscriberForm(company, { full_name: `مشترك السباق ${counter}`, national_id: nationalId, phone: `0598${String(counter).padStart(6, '0')}`, subscription_fee: '500', ...overrides }));
    if (!response.ok) throw new Error(`could not register: ${JSON.stringify(response.errors)}`);

    return Number(scalar(`select s.id from subscriptions s join subscriber_profiles p on p.id=s.subscriber_profile_id where p.national_id='${nationalId}'`));
};

// ─────────────────────────────────────────────────────────────────────────
report.begin('C1. Forty different payments on one account at the same moment');
const collectors = [...await browsers('collector', 4), ...await browsers('collector2', 4)];
let subscriber = await register({ subscription_fee: '1000' });
const voucherBefore = Number(scalar('select last_number from payment_voucher_sequences where id=1'));
let responses = await Promise.all(Array.from({ length: 40 }, (_, index) => collectors[index % collectors.length].post(`/subscriptions/${subscriber}/payments`, { payment_token: uuid(), amount: String(index + 1), currency: 'ILS', payment_method: 'cash' })));
noServerError('40 payments', responses);
report.equal('all forty were recorded', scalar(`select count(*) from subscription_transactions where subscription_id=${subscriber} and type='payment'`), 40);
report.equal('the balance is 1000 − (1+2+…+40)', balance(subscriber), '180.00');
const vouchers = sql(`select voucher_number from subscription_transactions where subscription_id=${subscriber} and type='payment' order by voucher_number`).map((row) => Number(row.voucher_number));
report.check('their vouchers are forty consecutive numbers, none twice', new Set(vouchers).size === 40 && vouchers[39] - vouchers[0] === 39 && vouchers[0] === voucherBefore + 1, `${vouchers[0]}…${vouchers[39]}, ${new Set(vouchers).size} distinct`);
const chain = sql(`select id, amount, balance_after from subscription_transactions where subscription_id=${subscriber} order by created_at, id`);
let running = 0;
const broken = chain.filter((line) => (running += cents(line.amount)) !== cents(line.balance_after));
report.check('every line\'s stored balance is the running total', broken.length === 0, `${broken.length} of ${chain.length} lines store another balance, e.g. line ${broken[0]?.id} stores ${broken[0]?.balance_after}`);
report.equal('each payment is in exactly one box', scalar(`select count(*) from cash_box_payments p join subscription_transactions t on t.id=p.subscription_transaction_id where t.subscription_id=${subscriber}`), 40);

report.begin('C2. One payment form pressed twelve times');
subscriber = await register();
let token = uuid();
responses = await Promise.all(Array.from({ length: 12 }, (_, index) => collectors[index % 4].post(`/subscriptions/${subscriber}/payments`, { payment_token: token, amount: '75', currency: 'ILS', payment_method: 'cash' })));
noServerError('12 sends of one form', responses);
report.equal('one payment only', scalar(`select count(*) from subscription_transactions where subscription_id=${subscriber} and type='payment'`), 1);
report.equal('the balance fell once', balance(subscriber), '425.00');
report.equal('every send was answered as recorded', succeeded(responses), 12);

report.begin('C3. One bank reference claimed for ten subscribers at once');
const ten = [];
for (let index = 0; index < 10; index++) ten.push(await register());
responses = await Promise.all(ten.map((id, index) => collectors[index % collectors.length].post(`/subscriptions/${id}/payments`, { payment_token: uuid(), amount: '50', currency: 'ILS', payment_method: 'bank_transfer', bank_name: BANK, sender_name: 'مرسل واحد', reference_number: 'RACE-REF-1' })));
noServerError('10 transfers with one reference', responses);
report.equal('the reference stands on one payment only', scalar("select count(*) from subscription_transactions where active_reference='RACEREF1' and cancelled_at is null"), 1);
report.equal('the other nine were refused', succeeded(responses), 1);

report.begin('C4. One reading entered eight times, then approved eight times');
const readers = await browsers('reader', 4);
const managers = await browsers('manager', 4);
subscriber = await register({ initial_reading: 100, subscription_fee: null, charge_subscription_fee: false });
responses = await Promise.all(Array.from({ length: 8 }, (_, index) => readers[index % 4].post('/meter-readings', { subscription_id: subscriber, week_start: week, current_reading: 220 })));
if (!noServerError('8 entries of one reading', responses)) {
    report.finding('low', 'duplicate-reading-500', `${responses.filter((response) => response.status >= 500).length} of 8 identical readings sent at once were answered with HTTP 500 (the unique index refused them, but nothing catches it)`);
}
report.equal('one reading only', scalar(`select count(*) from meter_readings where subscription_id=${subscriber}`), 1);
let reading = Number(one(`select id from meter_readings where subscription_id=${subscriber}`).id);
responses = await Promise.all(Array.from({ length: 8 }, (_, index) => managers[index % 4].post('/meter-readings/approve', { reading_ids: [reading], confirm_unusual: true })));
noServerError('8 approvals of one reading', responses);
report.equal('it was billed once: 120 kWh × 0.50', `${scalar(`select count(*) from subscription_transactions where meter_reading_id=${reading}`)}|${balance(subscriber)}`, '1|60.00');

report.begin('C5. A reading corrected and approved by different people at the same moment');
for (let round = 1; round <= 6; round++) {
    responses = await Promise.all([
        managers[0].put(`/meter-readings/${reading}`, { current_reading: 220 + round * 10, approve: true, confirm_unusual: true }),
        managers[1].put(`/meter-readings/${reading}`, { current_reading: 225 + round * 10, approve: true, confirm_unusual: true }),
        readers[0].put(`/meter-readings/${reading}`, { current_reading: 221 + round * 10 }),
        managers[2].post('/meter-readings/approve', { reading_ids: [reading], confirm_unusual: true }),
        managers[3].post('/meter-readings/approve', { reading_ids: [reading], confirm_unusual: true }),
    ]);
    if (!responses.every((response) => response.status < 500)) break;
}
noServerError('6 rounds of corrections racing approvals', responses);
await manager.post('/meter-readings/approve', { reading_ids: [reading], confirm_unusual: true });
const settled = one(`select * from meter_readings where id=${reading}`);
const bills = sql(`select amount from subscription_transactions where meter_reading_id=${reading} and type='meter_reading' and cancelled_at is null`);
report.equal('the reading ends approved with exactly one standing bill', `${settled.status}|${bills.length}`, 'approved|1');
report.equal('and that bill is what the reading costs', bills[0]?.amount, settled.amount_due);
report.equal('the balance is that bill', balance(subscriber), settled.amount_due);

report.begin('C6. A refund, a cancellation and a correction of one line at once');
subscriber = await register();
await collector.post(`/subscriptions/${subscriber}/payments`, { payment_token: uuid(), amount: '100', currency: 'ILS', payment_method: 'cash' });
const paid = Number(one(`select id from subscription_transactions where subscription_id=${subscriber} and type='payment'`).id);
await manager.post(`/subscriptions/${subscriber}/charges`, { type: 'penalty', amount: '10', notes: 'بعد الدفعة' });
responses = await Promise.all([
    ...managers.map((session) => session.post(`/subscriptions/${subscriber}/transactions/${paid}/actions`, { action: 'refund', correction_notes: 'إرجاع متزامن' })),
    managers[0].put(`/subscriptions/${subscriber}/transactions/${paid}`, { amount: '90', currency: 'ILS', payment_method: 'cash', correction_reason: 'wrong_amount', correction_notes: 'تصحيح متزامن', confirm_overpayment: true }),
    managers[1].delete(`/subscriptions/${subscriber}/transactions/${paid}`, { correction_reason: 'duplicate', correction_notes: 'حذف متزامن' }),
]);
noServerError('refund ×4, correct and delete of one payment', responses);
const reversals = Number(scalar(`select count(*) from subscription_transactions where subscription_id=${subscriber} and (reverses_id=${paid} or reference_transaction_id=${paid}) and type in ('reversal','refund','cancellation')`));
report.equal('the payment was taken back exactly once', reversals, 1);
const replaced = Number(scalar(`select count(*) from subscription_transactions where corrects_id=${paid}`));
report.equal('the balance is the fee and penalty, less the correction if that won', balance(subscriber), replaced ? '420.00' : '510.00');

report.begin('C7. Payments arriving while the box is being closed');
subscriber = await register({ subscription_fee: '1000' });
await collector.post(`/subscriptions/${subscriber}/payments`, { payment_token: uuid(), amount: '1', currency: 'ILS', payment_method: 'cash' });
const openBox = () => one(`select id from cash_boxes where user_id=${company.users.collector.id} and type='cash' and status in ('open','pending') order by id desc limit 1`);
const racedBox = Number(openBox().id);
const accountants = await browsers('accountant', 2);
responses = await Promise.all([
    ...Array.from({ length: 20 }, (_, index) => collectors[index % 4].post(`/subscriptions/${subscriber}/payments`, { payment_token: uuid(), amount: '2', currency: 'ILS', payment_method: 'cash' })),
    accountants[0].post(`/payments/cash-boxes/actions/receive/${racedBox}`, { branch_id: branch }, '/payments/cash-boxes'),
    accountants[1].post(`/payments/cash-boxes/actions/receive/${racedBox}`, { branch_id: branch }, '/payments/cash-boxes'),
    managers[0].post(`/payments/cash-boxes/actions/receive/${racedBox}`, { branch_id: branch }, '/payments/cash-boxes'),
]);
noServerError('20 payments racing 3 closings', responses);
report.equal('all twenty payments were recorded', scalar(`select count(*) from subscription_transactions where subscription_id=${subscriber} and type='payment'`), 21);
report.equal('the box closed once', one(`select status from cash_boxes where id=${racedBox}`).status, 'received');
const sealedBox = one(`select expected_counts, (select coalesce(sum(p.amount),0) from cash_box_payments p join subscription_transactions t on t.id=p.subscription_transaction_id where p.cash_box_id=${racedBox} and t.status='active') held from cash_boxes where id=${racedBox}`);
report.equal('the closed box expects exactly the entries it holds', JSON.parse(sealedBox.expected_counts).ILS, money(cents(sealedBox.held)));
report.equal('no payment fell between the boxes', scalar(`select count(*) from subscription_transactions t where t.subscription_id=${subscriber} and t.type='payment' and (select count(*) from cash_box_payments p where p.subscription_transaction_id=t.id) <> 1`), 0);
const late = sql(`select t.id from subscription_transactions t join cash_box_payments p on p.subscription_transaction_id=t.id join cash_boxes b on b.id=p.cash_box_id where t.subscription_id=${subscriber} and b.id=${racedBox} and t.created_at > b.closed_at`);
report.equal('nothing entered the box after it closed', late.length, 0);

report.begin('C8. Registering the same person, and many people, at once');
const sameForm = subscriberForm(company, { full_name: 'مكرر في نفس اللحظة', national_id: '488888888', phone: '0598888888' });
responses = await Promise.all(managers.concat(managers).map((session) => session.post('/subscriptions', sameForm)));
noServerError('8 registrations of one national id', responses);
report.equal('one subscriber only', scalar("select count(*) from subscriber_profiles where national_id='488888888'"), 1);
report.equal('charged the fee once', scalar("select count(*) from subscription_transactions t join subscriptions s on s.id=t.subscription_id join subscriber_profiles p on p.id=s.subscriber_profile_id where p.national_id='488888888'"), 1);
const beforeMany = Number(scalar('select count(*) from subscriptions'));
responses = await Promise.all(Array.from({ length: 24 }, (_, index) => managers[index % 4].post('/subscriptions', subscriberForm(company, { full_name: `دفعة تسجيل ${index}`, national_id: `49${String(index).padStart(7, '0')}`, phone: `0597${String(index).padStart(6, '0')}` }))));
noServerError('24 registrations at once', responses);
report.equal('all twenty-four were registered', Number(scalar('select count(*) from subscriptions')) - beforeMany, 24);
report.equal('no account number was issued twice', scalar('select count(*) from (select account_number from subscriptions group by account_number having count(*) > 1) x'), 0);
report.equal('no subscriber number was issued twice', scalar('select count(*) from (select subscriber_number from subscriber_profiles where subscriber_number is not null group by subscriber_number having count(*) > 1) x'), 0);

report.begin('C9. The field app sending one collection ten times');
const phone = new MobileClient('collector2');
const signedIn = await phone.signIn(company.users.collector2.username);
report.check('the collector signs in on the field app', signedIn.status === 200 && phone.token, `HTTP ${signedIn.status} ${signedIn.text.slice(0, 200)}`);
subscriber = await register();
const operation = uuid();
responses = await Promise.all(Array.from({ length: 10 }, () => phone.call('POST', '/collections', { mobile_operation_id: operation, collector_confirmed: true, subscription_id: subscriber, amount: '40', currency: 'ILS', payment_method: 'cash' })));
noServerError('10 sends of one field collection', responses);
report.equal('one payment only', scalar(`select count(*) from subscription_transactions where subscription_id=${subscriber} and type='payment'`), 1);
report.check('every send got the same recorded payment back', responses.every((response) => [200, 201].includes(response.status)), statuses(responses));

report.begin('C10. Charges, discounts, clearings and payments on one account at once');
subscriber = await register({ subscription_fee: '1000' });
responses = await Promise.all(Array.from({ length: 32 }, (_, index) => {
    const session = managers[index % 4];
    if (index % 4 === 0) return session.post(`/subscriptions/${subscriber}/charges`, { type: 'penalty', amount: '7', notes: 'تحميل متزامن' });
    if (index % 4 === 1) return session.post(`/subscriptions/${subscriber}/discounts`, { method: 'shekel', value: '3', notes: 'خصم متزامن' });
    if (index % 4 === 2) return session.post(`/subscriptions/${subscriber}/clearings`, { amount: '5', notes: 'مقاصة متزامنة' });

    return session.post(`/subscriptions/${subscriber}/payments`, { payment_token: uuid(), amount: '11', currency: 'ILS', payment_method: 'cash' });
}));
noServerError('32 mixed lines', responses);
report.equal('all thirty-two were recorded', Number(scalar(`select count(*) from subscription_transactions where subscription_id=${subscriber}`)) - 1, 32);
report.equal('the balance is 1000 + 8×7 − 8×3 − 8×5 − 8×11', balance(subscriber), '904.00');
running = 0;
const mixed = sql(`select id, type, amount, balance_after from subscription_transactions where subscription_id=${subscriber} order by created_at, id`);
const wrong = mixed.filter((line) => (running += cents(line.amount)) !== cents(line.balance_after));
report.check('every line\'s stored balance is the running total', wrong.length === 0, `${wrong.length} of ${mixed.length} lines store another balance, e.g. ${wrong.slice(0, 3).map((line) => `line ${line.id} (${line.type}) stores ${line.balance_after}`).join('; ')}`);
if (wrong.length) report.finding('medium', 'stale-running-balance', `${wrong.length} of ${mixed.length} lines recorded at the same moment store a balance_after that is not the running total of the statement`);

report.begin('C11. The audit approved by several auditors at once');
for (const box of sql(`select id from cash_boxes b where branch_id=${branch} and status in ('open','pending') and exists (select 1 from cash_box_payments p where p.cash_box_id=b.id)`)) {
    await manager.post(`/payments/cash-boxes/actions/receive/${box.id}`, { branch_id: branch }, '/payments/cash-boxes');
}
const transferEntry = one(`select p.id from cash_box_payments p join cash_boxes b on b.id=p.cash_box_id join subscription_transactions t on t.id=p.subscription_transaction_id where b.branch_id=${branch} and b.status='received' and b.type='bank_transfer' and t.active_reference='RACEREF1' and not exists (select 1 from cash_box_audits a where a.cash_box_id=b.id)`);
const auditors = await browsers('auditor', 4);
for (const session of auditors) session.home = '/payments/cash-boxes?place=closed';
responses = await Promise.all(auditors.map((session, index) => session.post(`/payments/cash-boxes/entries/${transferEntry.id}/audit`, { bank_amount: `4${index}.00`, reason: `مراجعة ${index}` })));
noServerError('4 reviews of one transfer', responses);
report.equal('one review stands', scalar(`select count(*) from bank_transfer_audits where cash_box_payment_id=${transferEntry.id}`), 1);
const periodPage = (await auditor.page(`/payments/cash-boxes?branch_id=${branch}&place=closed`)).props;
const period = periodPage.periodAudit;
const pendingBoxes = sql(`select id from cash_boxes b where branch_id=${branch} and status='received' and not exists (select 1 from cash_box_audits a where a.cash_box_id=b.id)`).map((row) => Number(row.id));
responses = await Promise.all([
    ...auditors.map((session) => session.post('/payments/cash-boxes/audit-period', { branch_id: period.branch_id, week: period.week, box_ids: period.box_ids, snapshot: period.snapshot, confirmed: true })),
    ...pendingBoxes.slice(0, 6).map((id, index) => auditors[index % 4].post(`/payments/cash-boxes/${id}/audit`, { confirmed: true })),
]);
noServerError('4 period approvals racing box approvals', responses);
report.equal('no box was approved twice', scalar('select count(*) from (select cash_box_id from cash_box_audits group by cash_box_id having count(*) > 1) x'), 0);
report.equal('each audited transfer has at most one adjustment', scalar("select count(*) from (select source_key from subscription_transactions where type='bank_audit_adjustment' group by source_key having count(*) > 1) x"), 0);
const posted = one(`select * from bank_transfer_audits where cash_box_payment_id=${transferEntry.id}`);
report.check('the raced transfer\'s difference was posted once, as reviewed', posted.posted_at === null || cents(one(`select amount from subscription_transactions where id=${posted.adjustment_transaction_id}`)?.amount ?? 0) === cents(posted.difference), JSON.stringify(posted));

report.begin('C12. Two people changing one subscriber\'s status and permissions at once');
subscriber = await register();
const row = one(`select s.*, p.full_name profile_name, p.national_id, p.phone from subscriptions s join subscriber_profiles p on p.id=s.subscriber_profile_id where s.id=${subscriber}`);
const form = (status) => ({ full_name: row.profile_name, national_id: row.national_id, phone: row.phone, tariff_id: Number(row.tariff_id), circuit_breaker_id: Number(row.circuit_breaker_id), meter_box_id: Number(row.meter_box_id), minimum_charge: row.minimum_charge, initial_reading: row.initial_reading, subscription_date: row.subscription_date, status });
responses = await Promise.all(managers.map((session, index) => session.put(`/subscriptions/${subscriber}`, form(index % 2 ? 'disconnected' : 'active'))));
noServerError('4 status changes at once', responses);
report.check('the subscriber ends in one of the two states', ['active', 'disconnected'].includes(one(`select status from subscriptions where id=${subscriber}`).status), one(`select status from subscriptions where id=${subscriber}`).status);
const owners = [owner, new Session('owner2')];
await owners[1].signIn('owner');
const ownerStill = (await owner.page('/dashboard')).status;
report.check('a second sign-in of the same account ends the first device\'s session', [302, 401, 409].includes(ownerStill) || ownerStill === 200, `HTTP ${ownerStill}`);

report.begin('C13. The books after every race');
auditBooks(report);

process.exitCode = report.finish() ? 1 : 0;
