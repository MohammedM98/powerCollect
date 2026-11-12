import { artisan, cents, clock, money, one, Report, scalar, sql, uuid } from './lib.mjs';
import { BANK, setUpCompany, signInStaff, subscriberForm } from './company.mjs';
import { auditBooks } from './books.mjs';

/**
 * A subscriber's whole life on a real server and database: registered,
 * read every week, billed, paid in every way, corrected, discounted,
 * disconnected, archived and restored, while the branch's boxes are closed,
 * opened again, audited and approved. Every figure the pages show is
 * compared with what the scenario worked out by hand.
 */
const report = new Report('lifecycle');
clock.set('2026-11-12T08:00:00Z'); // Thursday, the reading day, 10:00 in Gaza.

report.begin('1. Company set up through the website');
const company = await setUpCompany(report);
const staff = await signInStaff(company);
for (const name of ['auditor']) staff[name].home = '/payments/cash-boxes?place=closed';
const { manager, collector, collector2, reader, accountant, auditor, managerB, collectorB, owner } = staff;
const branch = company.branches.a;

const statement = async (session, id) => (await session.page(`/subscriptions/${id}/statement`)).props;
const balance = async (id) => (await statement(manager, id)).summary.balance;
const lastLine = (id, type) => one(`select * from subscription_transactions where subscription_id=${id} ${type ? `and type='${type}'` : ''} order by id desc limit 1`);
const pay = (session, id, payment) => session.post(`/subscriptions/${id}/payments`, { payment_token: uuid(), currency: 'ILS', payment_method: 'cash', ...payment }, `/subscriptions/${id}/statement`);
const transfer = (session, id, payment) => pay(session, id, { payment_method: 'bank_transfer', bank_name: BANK, sender_name: 'سالم عبد الله', ...payment });

// ─────────────────────────────────────────────────────────────────────────
report.begin('2. Registering a subscriber');
let response = await manager.post('/subscriptions', subscriberForm(company), '/subscriptions/create');
report.done('the branch manager registers a subscriber with a 100 ₪ fee', response);
const salem = Number(scalar("select id from subscriptions where full_name='سالم عبد الله'"));
report.equal('the registration fee is the first line of the statement', (await statement(manager, salem)).entries[0].type, 'subscription_fee');
report.equal('the subscriber owes the fee', await balance(salem), '100.00');
report.check('the account number was issued', /^\d{9}$/.test(one(`select account_number from subscriptions where id=${salem}`).account_number), one(`select account_number from subscriptions where id=${salem}`).account_number);

report.refused('the same national id is refused', await manager.post('/subscriptions', subscriberForm(company, { full_name: 'مكرر' })));
report.refused('a missing name and tariff are refused', await manager.post('/subscriptions', subscriberForm(company, { full_name: '', tariff_id: null, national_id: '401234568' })));
report.refused('an active subscriber without a first reading is refused', await manager.post('/subscriptions', subscriberForm(company, { national_id: '401234569', initial_reading: null })));
report.refused('a negative fee is refused', await manager.post('/subscriptions', subscriberForm(company, { national_id: '401234570', subscription_fee: '-50' })));
report.refused('a malformed phone is refused', await manager.post('/subscriptions', subscriberForm(company, { national_id: '401234571', phone: '12345' })));
report.refused('a box of another branch is refused', await manager.post('/subscriptions', subscriberForm(company, { national_id: '401234572', meter_box_id: company.boxes.b1 })));
report.refused('the collector may not register subscribers', await collector.post('/subscriptions', subscriberForm(company, { national_id: '401234573' })), [403]);
report.equal('none of the refused forms created a subscriber', scalar('select count(*) from subscriptions'), 1);

for (const [name, nationalId, phone, overrides] of [
    ['منى خليل', '402222222', '0599222222', { initial_reading: 500, minimum_charge: 10, subscription_fee: null, charge_subscription_fee: false }],
    ['متجر الأمل', '403333333', '0599333333', { tariff_id: company.tariffs.commercial, initial_reading: 0, minimum_charge: 25, meter_box_id: company.boxes.a2, subscription_fee: '150' }],
    ['خالد منتظر', '404444444', '0599444444', { status: 'suspended', initial_reading: null, subscription_fee: null, charge_subscription_fee: false }],
]) {
    report.done(`registers ${name}`, await manager.post('/subscriptions', subscriberForm(company, { full_name: name, national_id: nationalId, phone, ...overrides })));
}
report.done('branch B registers a subscriber of its own', await managerB.post('/subscriptions', subscriberForm(company, { full_name: 'مشترك البريج', national_id: '405555555', phone: '0599555555', meter_box_id: company.boxes.b1 })));
const [mona, shop, khaled, other] = ['منى خليل', 'متجر الأمل', 'خالد منتظر', 'مشترك البريج'].map((name) => Number(scalar(`select id from subscriptions where full_name='${name}'`)));
report.equal('the waiting subscriber owes nothing', await balance(khaled), '0.00');
report.equal('the shop owes its 150 ₪ fee', await balance(shop), '150.00');

report.done('the manager edits the phone', await manager.patch(`/subscriptions/${salem}/phone`, { phone: '0599111111' }));
report.equal('the new phone is saved', one(`select p.phone from subscriptions s join subscriber_profiles p on p.id=s.subscriber_profile_id where s.id=${salem}`).phone, '0599111111');

// ─────────────────────────────────────────────────────────────────────────
report.begin('3. Week 1 readings: entry, refusals, approval and billing');
const week1 = '2026-11-06';
const read = (session, id, value, extra = {}) => session.post('/meter-readings', { subscription_id: id, week_start: week1, current_reading: value, ...extra }, '/meter-readings');
report.refused('a reading below the last one is refused', await read(reader, salem, 900));
report.refused('a reading for a week still running is refused', await reader.post('/meter-readings', { subscription_id: salem, week_start: '2026-11-13', current_reading: 1100 }));
report.refused('an impossible consumption is refused', await read(reader, salem, 99999999));
report.refused('a reading for a waiting subscriber is refused', await read(reader, khaled, 10));
report.refused('a reading for another branch is refused', await read(reader, other, 1100));
report.refused('the collector may not enter readings', await read(collector, salem, 1100), [403]);
report.refused('a negative reading is refused', await read(reader, salem, -5));
report.refused('a reading with three decimals is refused', await read(reader, salem, '1100.123'));
report.equal('no refused reading was saved', scalar('select count(*) from meter_readings'), 0);

report.done('the reader enters Salem 1000 → 1120', await read(reader, salem, 1120));
report.done('the reader enters Mona 500 → 508 (below the minimum)', await read(reader, mona, 508));
report.done('the reader enters the shop 0 → 300', await read(reader, shop, 300));
report.refused('a second reading for the same week is refused', await read(reader, salem, 1130));
let reading = one(`select * from meter_readings where subscription_id=${salem}`);
report.equal('Salem: 120 kWh × 0.50 = 60.00', `${reading.consumption}|${reading.reading_fee}|${reading.amount_due}|${reading.status}`, '120.00|60.00|60.00|pending');
reading = one(`select * from meter_readings where subscription_id=${mona}`);
report.equal('Mona: 8 kWh × 0.50 = 4.00, raised to the 10.00 minimum', `${reading.reading_fee}|${reading.amount_due}`, '4.00|10.00');
reading = one(`select * from meter_readings where subscription_id=${shop}`);
report.equal('the shop: 300 kWh × 0.80 = 240.00', reading.amount_due, '240.00');
report.equal('a pending reading does not touch the balance', await balance(salem), '100.00');

const readingIds = (where = '') => sql(`select id from meter_readings ${where}`).map((row) => Number(row.id));
report.refused('the reader may not approve readings', await reader.post('/meter-readings/approve', { reading_ids: readingIds() }), [403]);
report.refused('branch B may not approve branch A readings', await managerB.post('/meter-readings/approve', { reading_ids: readingIds() }));
report.equal('still nothing is billed', scalar("select count(*) from subscription_transactions where type='meter_reading'"), 0);

report.done('the reader corrects Salem\'s pending reading to 1110', await reader.put(`/meter-readings/${one(`select id from meter_readings where subscription_id=${salem}`).id}`, { current_reading: 1110 }));
report.equal('the corrected reading is 110 kWh = 55.00', one(`select amount_due from meter_readings where subscription_id=${salem}`).amount_due, '55.00');

response = await manager.post('/meter-readings/approve', { reading_ids: readingIds(), confirm_unusual: true });
report.done('the manager approves the week', response);
report.equal('all three readings are approved', scalar("select count(*) from meter_readings where status='approved'"), 3);
report.equal('Salem owes 100 + 55', await balance(salem), '155.00');
report.equal('Mona owes the 10.00 minimum', await balance(mona), '10.00');
report.equal('the shop owes 150 + 240', await balance(shop), '390.00');
response = await manager.post('/meter-readings/approve', { reading_ids: readingIds(), confirm_unusual: true });
report.equal('approving again bills nothing twice', scalar("select count(*) from subscription_transactions where type='meter_reading'"), 3);

report.begin('3b. Correcting an approved reading');
const salemReading = Number(one(`select id from meter_readings where subscription_id=${salem}`).id);
report.done('the manager corrects the approved reading to 1130 without approving', await manager.put(`/meter-readings/${salemReading}`, { current_reading: 1130 }));
reading = one(`select * from meter_readings where id=${salemReading}`);
report.equal('the reading went back to review at 130 kWh = 65.00', `${reading.status}|${reading.amount_due}`, 'pending|65.00');
report.equal('its bill was taken back, the balance is the fee alone', await balance(salem), '100.00');
report.equal('the cancelled bill and its reversal stay on the statement', scalar(`select count(*) from subscription_transactions where subscription_id=${salem} and meter_reading_id=${salemReading}`) + '|' + scalar(`select count(*) from subscription_transactions where subscription_id=${salem} and type='reversal'`), '1|1');
report.done('the manager approves it again', await manager.post('/meter-readings/approve', { reading_ids: [salemReading] }));
report.equal('Salem owes 100 + 65', await balance(salem), '165.00');
report.done('the manager corrects and approves in one step (1124)', await manager.put(`/meter-readings/${salemReading}`, { current_reading: 1124, approve: true, confirm_unusual: true }));
report.equal('Salem owes 100 + 62', await balance(salem), '162.00');
report.equal('the reading has exactly one standing bill', scalar(`select count(*) from subscription_transactions where meter_reading_id=${salemReading} and type='meter_reading' and cancelled_at is null`), 1);
report.equal('every correction is in the reading\'s history', scalar(`select count(*) from meter_reading_adjustments where meter_reading_id=${salemReading}`), 3);

// ─────────────────────────────────────────────────────────────────────────
report.begin('4. Payments: cash, currencies, transfers and their refusals');
response = await pay(collector, salem, { amount: '62' });
report.done('the collector takes 62 ₪ in cash', response);
report.equal('the receipt shows voucher 000001 and the balance left', `${response.flash?.recordedPayment?.voucherNumber}|${response.flash?.recordedPayment?.balance}`, '000001|100.00');
const cashLine = lastLine(salem, 'payment');
report.equal('the payment is stored as a credit of -62.00', cashLine.amount, '-62.00');

for (const [name, payment] of [
    ['a zero amount', { amount: '0' }], ['a negative amount', { amount: '-20' }], ['an amount with three decimals', { amount: '10.999' }],
    ['a non-numeric amount', { amount: 'abc' }], ['an amount above the limit', { amount: '1000001', confirm_overpayment: true }],
    ['an unknown currency', { amount: '10', currency: 'XYZ' }], ['an unknown payment method', { amount: '10', payment_method: 'cheque' }],
    ['a forged exchange rate is ignored, the stored one is used', null],
]) {
    if (payment === null) {
        response = await pay(collector, mona, { amount: '1', currency: 'USD', exchange_rate: '999' });
        report.equal(name, lastLine(mona, 'payment').amount, '-3.70');
    } else {
        report.refused(`${name} is refused`, await pay(collector, salem, payment));
    }
}
report.refused('a payment without its token is refused', await collector.post(`/subscriptions/${salem}/payments`, { amount: '10', currency: 'ILS', payment_method: 'cash' }));
report.refused('an overpayment needs confirming', await pay(collector, salem, { amount: '5000' }));
report.refused('a transfer without its bank and sender is refused', await pay(collector, salem, { amount: '10', payment_method: 'bank_transfer' }));
report.refused('a transfer dated tomorrow is refused', await transfer(collector, salem, { amount: '10', bank_received_on: '2026-11-13' }));
report.refused('branch B\'s collector cannot pay into branch A', await pay(collectorB, salem, { amount: '10' }), [403, 404]);
report.refused('the reader cannot record payments', await pay(reader, salem, { amount: '10' }), [403]);
report.refused('the auditor cannot record payments', await pay(auditor, salem, { amount: '10' }), [403, 404]);
report.equal('Salem still owes 100 after every refusal', await balance(salem), '100.00');

report.done('10 $ in cash at 3.70', await pay(collector, salem, { amount: '10', currency: 'USD' }));
report.equal('the dollars are worth 37.00 ₪', lastLine(salem, 'payment').amount + '|' + lastLine(salem, 'payment').exchange_rate, '-37.00|3.7000');
report.done('a 30 ₪ transfer with reference FT-1001', await transfer(collector, salem, { amount: '30', reference_number: 'FT-1001' }));
report.refused('the same reference on another subscriber is refused', await transfer(collector2, mona, { amount: '5', reference_number: 'ft 1001' }));
report.refused('FT/1001 is the same reference too', await transfer(collector2, mona, { amount: '5', reference_number: 'FT/1001' }));
report.done('unless the collector confirms the duplicate', await transfer(collector2, mona, { amount: '5', reference_number: 'FT-1001', confirm_duplicate_reference: true }));
report.equal('Salem owes 100 - 37 - 30', await balance(salem), '33.00');

report.begin('4b. The same payment sent twice is recorded once');
const token = uuid();
const twice = { payment_token: token, amount: '3', currency: 'ILS', payment_method: 'cash' };
report.done('first send', await collector.post(`/subscriptions/${salem}/payments`, twice));
report.done('second send of the same form', await collector.post(`/subscriptions/${salem}/payments`, twice));
report.equal('one line only', scalar(`select count(*) from subscription_transactions where subscription_id=${salem} and type='payment' and amount='-3.00'`), 1);
report.refused('the same token with another amount is refused', await collector.post(`/subscriptions/${salem}/payments`, { ...twice, amount: '4' }));
report.refused('the same token by another collector is refused', await collector2.post(`/subscriptions/${salem}/payments`, twice));
report.equal('Salem owes 30', await balance(salem), '30.00');

report.begin('4c. One transfer split between two subscribers');
response = await collector.post('/payments/split', {
    total_amount: '100', bank_name: BANK, sender_name: 'أبو سالم', reference_number: 'SPLIT-77', confirm_overpayment: true,
    parts: [{ subscription_id: salem, amount: '30' }, { subscription_id: shop, amount: '70' }],
});
report.done('a 100 ₪ transfer split 30 + 70', response);
report.equal('both parts share the split and the reference', scalar("select count(*) from subscription_transactions where active_reference='SPLIT77' and split_payment_id is not null"), 2);
report.equal('Salem is settled and the shop owes 320', `${await balance(salem)}|${await balance(shop)}`, '0.00|320.00');
report.refused('parts that do not add up to the transfer are refused', await collector.post('/payments/split', {
    total_amount: '100', bank_name: BANK, sender_name: 'أبو سالم', reference_number: 'SPLIT-78', confirm_overpayment: true,
    parts: [{ subscription_id: salem, amount: '30' }, { subscription_id: shop, amount: '60' }],
}));
report.refused('a part for another branch is refused', await collector.post('/payments/split', {
    total_amount: '100', bank_name: BANK, sender_name: 'أبو سالم', reference_number: 'SPLIT-79', confirm_overpayment: true,
    parts: [{ subscription_id: salem, amount: '30' }, { subscription_id: other, amount: '70' }],
}));

// ─────────────────────────────────────────────────────────────────────────
report.begin('5. Charges, discounts and clearings (debit and credit lines)');
const actions = async (id, lineId) => (await statement(manager, id)).entries.find((entry) => entry.id === Number(lineId));
const act = (session, id, lineId, body) => session.post(`/subscriptions/${id}/transactions/${lineId}/actions`, body, `/subscriptions/${id}/statement`);
report.done('a 20 ₪ penalty', await manager.post(`/subscriptions/${shop}/charges`, { type: 'penalty', amount: '20', notes: 'تأخر في السداد' }));
const penalty = Number(lastLine(shop, 'penalty').id);
report.equal('the newest line may be edited or deleted', JSON.stringify((await actions(shop, penalty)).available_actions), '["edit","delete"]');
report.refused('the collector may not edit the penalty', await act(collector, shop, penalty, { action: 'edit', amount: '1', amendment_reason: 'تجربة' }));
report.refused('the reader may not delete the penalty', await act(reader, shop, penalty, { action: 'delete', correction_notes: 'تجربة' }));
report.refused('branch B may not touch the line', await act(managerB, shop, penalty, { action: 'delete', correction_notes: 'تجربة' }), [403, 404]);
report.refused('a line addressed through another subscriber is not found', await act(manager, salem, penalty, { action: 'delete', correction_notes: 'تجربة' }), [404]);
report.refused('status and type cannot be forced through the form', await act(manager, shop, penalty, { action: 'edit', amount: '20', amendment_reason: 'x', status: 'cancelled', type: 'payment', balance_after: '0' }));
report.equal('the penalty is unchanged by every refusal', JSON.stringify(one(`select amount, status, type from subscription_transactions where id=${penalty}`)), '{"amount":"20.00","status":"active","type":"penalty"}');
report.done('the manager edits the penalty to 35 ₪', await act(manager, shop, penalty, { action: 'edit', amount: '35', amendment_reason: 'المبلغ الصحيح' }));
report.equal('the shop owes 320 + 35', await balance(shop), '355.00');
report.refused('a negative charge is refused', await manager.post(`/subscriptions/${shop}/charges`, { type: 'penalty', amount: '-20', notes: 'سالب' }));
report.refused('a zero charge is refused', await manager.post(`/subscriptions/${shop}/charges`, { type: 'penalty', amount: '0', notes: 'صفر' }));
report.refused('a penalty without its reason is refused', await manager.post(`/subscriptions/${shop}/charges`, { type: 'penalty', amount: '5' }));
report.refused('the collector may not add charges', await collector.post(`/subscriptions/${shop}/charges`, { type: 'penalty', amount: '5', notes: 'x' }), [403]);
report.done('a 15 ₪ discount', await manager.post(`/subscriptions/${shop}/discounts`, { method: 'shekel', value: '15', notes: 'خصم لمرة واحدة' }));
report.refused('a negative discount is refused', await manager.post(`/subscriptions/${shop}/discounts`, { method: 'shekel', value: '-15' }));
report.refused('a discount above what is owed is refused', await manager.post(`/subscriptions/${shop}/discounts`, { method: 'shekel', value: '5000' }));
report.done('the manager corrects the discount to 10 ₪', await manager.put(`/subscriptions/${shop}/transactions/${lastLine(shop, 'discount').id}`, { method: 'shekel', value: '10', correction_reason: 'wrong_amount', correction_notes: 'خصم أقل' }));
report.equal('the old discount is cancelled, reversed and replaced', scalar(`select group_concat(concat(type, ':', status, ':', amount) order by id separator ' ') from subscription_transactions where subscription_id=${shop} and (type in ('discount','reversal'))`), 'discount:cancelled:-15.00 reversal:active:15.00 discount:active:-10.00');
report.done('a 25 ₪ clearing by the collector', await collector.post(`/subscriptions/${shop}/clearings`, { amount: '25', notes: 'صيانة شبكة للشركة' }));
report.refused('a clearing above what is owed needs confirming', await collector.post(`/subscriptions/${shop}/clearings`, { amount: '900', notes: 'أكبر من الرصيد' }));
report.refused('a negative clearing is refused', await collector.post(`/subscriptions/${shop}/clearings`, { amount: '-25', notes: 'سالب' }));
report.equal('the shop owes 355 - 10 - 25', await balance(shop), '320.00');
const shopSummary = (await statement(manager, shop)).summary;
report.equal('charged − paid − discounted − cleared is the balance', money(cents(shopSummary.charged) - cents(shopSummary.paid) - cents(shopSummary.discounted) - cents(shopSummary.cleared)), '320.00');
report.equal('the summary counts 425 charged, 70 paid, 10 discounted, 25 cleared', `${shopSummary.charged}|${shopSummary.paid}|${shopSummary.discounted}|${shopSummary.cleared}`, '425.00|70.00|10.00|25.00');
report.equal('the clearing took the next voucher number', lastLine(shop, 'clearing').voucher_number, String(Number(scalar('select last_number from payment_voucher_sequences where id=1'))));
report.equal('an older charge may only be cancelled', JSON.stringify((await actions(shop, penalty)).available_actions), '["cancel"]');
report.refused('editing it now is refused', await act(manager, shop, penalty, { action: 'edit', amount: '1', amendment_reason: 'x' }));

// ─────────────────────────────────────────────────────────────────────────
report.begin('6. Statement actions: refund, amend, cancel, erase');
report.done('Mona pays 1 ₪', await pay(collector, mona, { amount: '1' }));
const monaPayment = Number(lastLine(mona, 'payment').id);
report.done('a wrong 20 ₪ charge is added to Mona', await manager.post(`/subscriptions/${mona}/charges`, { type: 'disconnection_fee', amount: '20' }));
const wrong = Number(lastLine(mona).id);
const before = Number(scalar('select count(*) from subscription_transactions'));
report.refused('the accountant may not erase lines', await accountant.delete(`/subscriptions/${mona}/transactions/${wrong}/permanent`, { correction_notes: 'x' }), [403, 404]);
report.done('the manager deletes it', await manager.delete(`/subscriptions/${mona}/transactions/${wrong}/permanent`, { correction_notes: 'أُدخل بالخطأ' }));
report.equal('the ledger never loses a line: the charge stays, cancelled, with its reversal', `${Number(scalar('select count(*) from subscription_transactions')) - before}|${one(`select status from subscription_transactions where id=${wrong}`).status}|${one(`select amount from subscription_transactions where reverses_id=${wrong}`).amount}`, '1|cancelled|-20.00');
report.refused('a line can never be removed by the model itself', { status: /cannot|must be kept|يجب|لا يمكن/.test(artisan('tinker', '--execute', `try { App\\Models\\SubscriptionTransaction::query()->acrossBranches()->find(${wrong})->delete(); echo "deleted"; } catch (Throwable $e) { echo "cannot"; }`)) ? 422 : 200 });
report.done('a 4 ₪ penalty follows', await manager.post(`/subscriptions/${mona}/charges`, { type: 'penalty', amount: '4', notes: 'غرامة' }));
report.equal('Mona owes 10 - 3.70 - 5 - 1 + 4', await balance(mona), '4.30');
report.equal('an older payment may be refunded, not deleted', JSON.stringify((await actions(mona, monaPayment)).available_actions), '["edit_metadata","refund"]');
report.refused('the collector may not refund', await act(collector, mona, monaPayment, { action: 'refund', correction_notes: 'x' }));
report.done('the manager refunds the 1 ₪ payment', await act(manager, mona, monaPayment, { action: 'refund', correction_notes: 'أُعيد المبلغ للمشترك' }));
report.equal('the refund brings the debt back', await balance(mona), '5.30');
report.refused('a refunded payment cannot be refunded again', await act(manager, mona, monaPayment, { action: 'refund', correction_notes: 'مرة ثانية' }));
report.equal('still 5.30', await balance(mona), '5.30');
report.done('a payment\'s notes are amended', await manager.patch(`/subscriptions/${salem}/transactions/${cashLine.id}/details`, { notes: 'دفعة أولى', amendment_reason: 'إضافة ملاحظة' }));
report.equal('the amendment did not move any money', await balance(salem), '0.00');
report.equal('and is kept in the history', scalar(`select count(*) from transaction_amendments where transaction_id=${cashLine.id}`), 1);
await manager.patch(`/subscriptions/${salem}/transactions/${cashLine.id}/details`, { amount: '1', currency: 'USD', notes: 'دفعة أولى', amendment_reason: 'x' });
report.equal('an amendment cannot change the amount or the currency', JSON.stringify(one(`select amount, currency from subscription_transactions where id=${cashLine.id}`)), '{"amount":"-62.00","currency":"ILS"}');
report.done('the shop\'s penalty is cancelled', await act(manager, shop, penalty, { action: 'cancel', correction_reason: 'fee_cancelled', correction_notes: 'أُعفي من الغرامة' }));
report.equal('the shop owes 320 - 35', await balance(shop), '285.00');
report.refused('a cancelled line cannot be cancelled again', await act(manager, shop, penalty, { action: 'cancel', correction_reason: 'other', correction_notes: 'x' }));

// ─────────────────────────────────────────────────────────────────────────
report.begin('7. Boxes: closing, opening the next one, and what a closed box seals');
let boxesPage = (await manager.page(`/payments/cash-boxes?branch_id=${branch}&place=open`)).props;
report.check('the open boxes page lists each collector\'s boxes', boxesPage.boxes.length >= 3, `${boxesPage.boxes.length} boxes`);
const boxOf = (userId, type) => one(`select * from cash_boxes where user_id=${userId} and type='${type}' and status in ('open','pending') order by id desc limit 1`);
const cashBox = boxOf(company.users.collector.id, 'cash');
const expectedCash = sql(`select currency, sum(amount) total from cash_box_payments where cash_box_id=${cashBox.id} group by currency`);
report.equal('the collector\'s cash box holds every cash entry in shekels: 62 + 3.70 + 37 + 3 + 1', expectedCash.map((row) => `${row.currency}:${row.total}`).sort().join(' '), 'ILS:106.70');

const close = (session, boxId) => session.post(`/payments/cash-boxes/actions/receive/${boxId}`, { branch_id: branch }, '/payments/cash-boxes');
report.refused('the collector may not close a box', await close(collector, cashBox.id), [403]);
report.refused('the reader may not close a box', await close(reader, cashBox.id), [403]);
report.refused('branch B may not close branch A\'s box', await managerB.post(`/payments/cash-boxes/actions/receive/${cashBox.id}`, { branch_id: branch }), [403, 404]);
report.refused('nor by naming its own branch', await managerB.post(`/payments/cash-boxes/actions/receive/${cashBox.id}`, { branch_id: company.branches.b }), [403, 404]);
report.equal('the box is still open', one(`select status from cash_boxes where id=${cashBox.id}`).status, 'open');
report.done('the accountant closes the collector\'s cash box', await close(accountant, cashBox.id));
const closed = one(`select * from cash_boxes where id=${cashBox.id}`);
report.equal('the box is received; the refunded 1 ₪ is not expected in it', `${closed.status}|${closed.expected_counts}`, 'received|{"ILS":"105.70","USD":"0.00","JOD":"0.00"}');
report.refused('a closed box cannot be closed again', await close(accountant, cashBox.id));

report.begin('7b. A line in a closed box can no longer change');
const sealedLine = await actions(salem, Number(cashLine.id));
report.equal('the statement offers no action on it', JSON.stringify(sealedLine.available_actions), '[]');
for (const [name, send] of [
    ['edit', () => act(manager, salem, cashLine.id, { action: 'edit', amount: '1', amendment_reason: 'x' })],
    ['refund', () => act(manager, salem, cashLine.id, { action: 'refund', correction_notes: 'x' })],
    ['cancel', () => act(manager, salem, cashLine.id, { action: 'cancel', correction_reason: 'other', correction_notes: 'x' })],
    ['correct', () => manager.put(`/subscriptions/${salem}/transactions/${cashLine.id}`, { amount: '1', currency: 'ILS', payment_method: 'cash', correction_reason: 'wrong_amount', correction_notes: 'x' })],
    ['amend', () => manager.patch(`/subscriptions/${salem}/transactions/${cashLine.id}/details`, { notes: 'x', amendment_reason: 'x' })],
    ['delete', () => manager.delete(`/subscriptions/${salem}/transactions/${cashLine.id}`, { correction_reason: 'other', correction_notes: 'x' })],
    ['erase', () => manager.delete(`/subscriptions/${salem}/transactions/${cashLine.id}/permanent`, { correction_notes: 'x' })],
    ['edit by the Super Admin', () => act(owner, salem, cashLine.id, { action: 'edit', amount: '1', amendment_reason: 'x' })],
]) {
    report.refused(`${name} is refused`, await send());
}
report.equal('the sealed payment is exactly as it was', JSON.stringify(one(`select amount, status, notes, cancelled_at from subscription_transactions where id=${cashLine.id}`)), JSON.stringify({ amount: '-62.00', status: 'active', notes: 'دفعة أولى', cancelled_at: null }));

report.begin('7c. The next payment opens a new box');
report.done('the collector takes 5.30 ₪ from Mona', await pay(collector, mona, { amount: '5.3' }));
const reopened = boxOf(company.users.collector.id, 'cash');
report.check('it went into a new open box, not the closed one', reopened && reopened.id !== cashBox.id, `box ${reopened?.id}`);
report.equal('the closed box still holds what it closed with', scalar(`select count(*) from cash_box_payments where cash_box_id=${cashBox.id}`), 5);

report.begin('7d. Reviewing transfers and closing the rest by type');
const transferBox = boxOf(company.users.collector.id, 'bank_transfer');
const transferEntries = sql(`select id from cash_box_payments where cash_box_id=${transferBox.id} order by id`).map((row) => Number(row.id));
report.done('the manager confirms a transfer arrived', await manager.post(`/payments/cash-boxes/actions/electronic/${transferEntries[0]}`, { branch_id: branch, status: 'confirmed' }));
report.refused('the collector may not review transfers', await collector.post(`/payments/cash-boxes/actions/electronic/${transferEntries[0]}`, { branch_id: branch, status: 'missing' }), [403]);
const openTransfers = sql(`select id from cash_boxes where branch_id=${branch} and type='bank_transfer' and status in ('open','pending')`).map((row) => Number(row.id));
report.done('the manager closes every transfer box at once', await manager.post('/payments/cash-boxes/actions/receive-type', { branch_id: branch, type: 'bank_transfer', box_ids: openTransfers }));
report.equal('no transfer box is left open', scalar(`select count(*) from cash_boxes where branch_id=${branch} and type='bank_transfer' and status in ('open','pending') and exists (select 1 from cash_box_payments p where p.cash_box_id=cash_boxes.id)`), 0);
for (const box of sql(`select id from cash_boxes where branch_id=${branch} and status in ('open','pending') and exists (select 1 from cash_box_payments p where p.cash_box_id=cash_boxes.id)`)) {
    report.done(`the manager closes box ${box.id}`, await close(manager, box.id));
}

// ─────────────────────────────────────────────────────────────────────────
report.begin('8. Audit: the bank statement, each box, then the whole period');
const closedPage = (await auditor.page(`/payments/cash-boxes?branch_id=${branch}&place=closed`)).props;
report.check('the auditor sees the closed boxes of the week', closedPage.boxes.length >= 3 && closedPage.periodAudit, `${closedPage.boxes.length} boxes`);
report.refused('the auditor cannot open the open boxes of a branch', await auditor.post(`/payments/cash-boxes/actions/receive/${cashBox.id}`, { branch_id: branch }), [403, 404]);
report.refused('the manager may not approve the audit', await manager.post(`/payments/cash-boxes/${cashBox.id}/audit`, { confirmed: true }), [403, 404]);
report.refused('the collector may not approve the audit', await collector.post(`/payments/cash-boxes/${cashBox.id}/audit`, { confirmed: true }), [403, 404]);

const ft = one("select p.id entry, t.id line, t.subscription_id from cash_box_payments p join subscription_transactions t on t.id=p.subscription_transaction_id where t.reference_number='FT-1001' and t.subscription_id=" + salem);
response = await auditor.json('GET', `/payments/cash-boxes/entries/${ft.entry}/audit`);
report.check('the auditor opens the transfer\'s review', response.status === 200, `HTTP ${response.status}`);
response = await auditor.post(`/payments/cash-boxes/entries/${ft.entry}/audit`, { bank_amount: '28.00', reason: 'البنك خصم عمولة 2 ₪' });
report.done('the bank shows 28 ₪, not the 30 recorded', response);
report.equal('nothing is charged until the box is approved', await balance(salem), '0.00');
report.refused('a difference without its reason is refused', await auditor.post(`/payments/cash-boxes/entries/${ft.entry}/audit`, { bank_amount: '27.00' }));
report.refused('a negative bank amount is refused', await auditor.post(`/payments/cash-boxes/entries/${ft.entry}/audit`, { bank_amount: '-5', reason: 'x' }));
report.refused('the manager may not audit transfers', await manager.post(`/payments/cash-boxes/entries/${ft.entry}/audit`, { bank_amount: '30.00', reason: 'x' }), [403, 404]);
const ftBox = Number(one(`select cash_box_id from cash_box_payments where id=${ft.entry}`).cash_box_id);
report.done('the auditor approves the transfer box', await auditor.post(`/payments/cash-boxes/${ftBox}/audit`, { confirmed: true }));
const adjustment = one(`select * from subscription_transactions where subscription_id=${salem} and type='bank_audit_adjustment'`);
report.equal('the 2 ₪ difference is charged back to the subscriber', adjustment?.amount, '2.00');
report.equal('Salem owes the 2 ₪', await balance(salem), '2.00');
report.equal('the recorded payment itself is untouched', one(`select amount, status from subscription_transactions where id=${ft.line}`).amount, '-30.00');

report.done('the auditor approves the cash box', await auditor.post(`/payments/cash-boxes/${cashBox.id}/audit`, { confirmed: true }));
await auditor.post(`/payments/cash-boxes/${cashBox.id}/audit`, { confirmed: true });
report.equal('approving a box twice records one approval', scalar(`select count(*) from cash_box_audits where cash_box_id=${cashBox.id}`), 1);
const period = (await auditor.page(`/payments/cash-boxes?branch_id=${branch}&place=closed`)).props.periodAudit;
report.refused('a period approval with a stale snapshot is refused', await auditor.post('/payments/cash-boxes/audit-period', { branch_id: period.branch_id, week: period.week, box_ids: period.box_ids, snapshot: 'f'.repeat(64), confirmed: true }));
report.done('the auditor approves the rest of the period', await auditor.post('/payments/cash-boxes/audit-period', { branch_id: period.branch_id, week: period.week, box_ids: period.box_ids, snapshot: period.snapshot, confirmed: true }));
report.equal('every closed box of the branch is approved', scalar(`select count(*) from cash_boxes b where branch_id=${branch} and status='received' and not exists (select 1 from cash_box_audits a where a.cash_box_id=b.id)`), 0);
report.refused('an audited transfer cannot be audited again', await auditor.post(`/payments/cash-boxes/entries/${ft.entry}/audit`, { bank_amount: '30.00', reason: 'تغيير بعد الاعتماد' }));
report.equal('the adjustment is still 2.00', one(`select amount from subscription_transactions where id=${adjustment.id}`).amount, '2.00');
report.refused('the adjustment itself cannot be cancelled', await act(manager, salem, adjustment.id, { action: 'cancel', correction_reason: 'other', correction_notes: 'x' }));

// ─────────────────────────────────────────────────────────────────────────
report.begin('9. Week 2: the standing discount, last week\'s reading corrected');
clock.advance({ days: 7 }); // Thursday 19 November
artisan('closings:process');
report.refused('a week later the old sessions have expired', await manager.post(`/subscriptions/${mona}/charges`, { type: 'penalty', amount: '1', notes: 'x' }), [419, 401]);
for (const [name, session] of Object.entries(staff)) {
    const signedIn = await session.signIn(name === 'owner' ? 'owner' : company.users[name].username);
    if (!signedIn.signedIn) report.check(`${name} signs in again`, false, `HTTP ${signedIn.status} → ${signedIn.location} ${signedIn.text.slice(0, 200)}`);
}
const week2 = '2026-11-13';
report.equal('the scheduled closing left no box with money open', scalar(`select count(*) from cash_boxes b where branch_id=${branch} and status in ('open','pending') and exists (select 1 from cash_box_payments p where p.cash_box_id=b.id)`), 0);
report.done('Mona gets a standing 50% discount', await manager.put(`/subscriptions/${mona}/standing-discount`, { method: 'percentage', value: '50', segment: 'أسر محتاجة' }));
report.refused('a standing discount above 100% is refused', await manager.put(`/subscriptions/${shop}/standing-discount`, { method: 'percentage', value: '150', segment: 'x' }));
report.refused('the reader may not give discounts', await reader.put(`/subscriptions/${shop}/standing-discount`, { method: 'percentage', value: '10', segment: 'x' }), [403]);
const read2 = (session, id, value, extra = {}) => session.post('/meter-readings', { subscription_id: id, week_start: week2, current_reading: value, ...extra }, '/meter-readings');
report.refused('last week can no longer take new readings', await reader.post('/meter-readings', { subscription_id: khaled, week_start: week1, current_reading: 5 }));
report.done('Salem 1124 → 1224', await read2(reader, salem, 1224));
report.done('Mona 508 → 608', await read2(reader, mona, 608));
report.done('the shop 300 → 2900, far above its usual', await read2(reader, shop, 2900));
reading = one(`select * from meter_readings where subscription_id=${salem} and week_start='${week2}'`);
report.equal('Salem\'s week starts from last week\'s corrected 1124', `${reading.previous_reading}|${reading.consumption}|${reading.amount_due}`, '1124.00|100.00|50.00');
reading = one(`select * from meter_readings where subscription_id=${mona} and week_start='${week2}'`);
report.equal('Mona: 100 kWh = 50.00, half off, no minimum', `${reading.reading_fee}|${reading.discount_amount}|${reading.amount_due}`, '50.00|25.00|25.00');
const unusual = one(`select * from meter_readings where subscription_id=${shop} and week_start='${week2}'`);
report.check('the shop\'s 2600 kWh is flagged as unusual', unusual.usual_consumption !== null, `usual ${unusual.usual_consumption}`);
response = await manager.post('/meter-readings/approve', { reading_ids: readingIds(`where week_start='${week2}'`) });
report.equal('approval without confirmation holds the unusual one back', scalar(`select group_concat(status order by subscription_id) from meter_readings where week_start='${week2}'`), 'approved,approved,pending');
report.equal('Mona is billed 50 with a 25 discount line beside it', scalar(`select group_concat(concat(type, ':', amount) order by id separator ' ') from subscription_transactions where meter_reading_id=${reading.id}`), 'meter_reading:50.00 reading_discount:-25.00');
report.equal('Mona owes 25', await balance(mona), '25.00');
report.done('the manager confirms and approves the unusual reading', await manager.post('/meter-readings/approve', { reading_ids: [Number(unusual.id)], confirm_unusual: true }));
report.equal('the shop owes 285 + 2600 × 0.80', await balance(shop), '2365.00');

report.begin('9b. Correcting last week\'s reading after this week was entered');
const preview = await manager.json('POST', `/meter-readings/${salemReading}/last-reading-preview`, { adjustment_type: 'correction', current_reading: 1120, expected_reading: 1124 });
report.check('the correction is previewed first', preview.status === 200, `HTTP ${preview.status} ${preview.text.slice(0, 200)}`);
response = await manager.put(`/meter-readings/${salemReading}/last-reading`, { adjustment_type: 'correction', current_reading: 1120, expected_reading: 1124, confirm_unusual: true });
report.done('last week\'s reading is corrected 1124 → 1120', response);
const [first, second] = sql(`select * from meter_readings where subscription_id=${salem} order by week_start`);
report.equal('last week is now 120 kWh, billed again at once', `${first.current_reading}|${first.consumption}|${first.amount_due}|${first.status}`, '1120.00|120.00|60.00|approved');
report.equal('this week\'s reading is cleared and must be entered again from 1120', `${second.previous_reading}|${second.requires_reentry}|${second.status}|${second.amount_due}`, '1120.00|1|pending|0.00');
report.equal('its bill was taken back: Salem owes 2 + 60 - 62', await balance(salem), '0.00');
report.refused('a reading waiting for re-entry cannot be approved', await manager.post('/meter-readings/approve', { reading_ids: [Number(second.id)], confirm_unusual: true }));
report.refused('a stale correction (the page showed another value) is refused', await manager.put(`/meter-readings/${salemReading}/last-reading`, { adjustment_type: 'correction', current_reading: 1100, expected_reading: 1124 }));
report.refused('the accountant may not correct last week', await accountant.put(`/meter-readings/${salemReading}/last-reading`, { adjustment_type: 'correction', current_reading: 1100, expected_reading: 1120 }), [403]);
report.done('the reader enters this week again: 1224', await reader.put(`/meter-readings/${second.id}`, { current_reading: 1224 }));
report.done('and the manager approves it', await manager.post('/meter-readings/approve', { reading_ids: [Number(second.id)], confirm_unusual: true }));
report.equal('Salem owes 104 kWh × 0.50', await balance(salem), '52.00');
report.equal('each of Salem\'s readings has exactly one standing bill', scalar(`select group_concat(c order by c) from (select count(*) c from subscription_transactions where subscription_id=${salem} and type='meter_reading' and cancelled_at is null group by meter_reading_id) x`), '1,1');

report.begin('9b′. Who may change an approved bill (separation of duties)');
const [monaFirst, monaSecond] = sql(`select * from meter_readings where subscription_id=${mona} order by week_start`);
response = await reader.put(`/meter-readings/${monaFirst.id}/last-reading`, { adjustment_type: 'correction', current_reading: 540, expected_reading: 508, confirm_unusual: true });
const monaAfter = one(`select * from meter_readings where id=${monaFirst.id}`);
const rebilledByReader = response.ok && monaAfter.status === 'approved' && Number(monaAfter.approved_by) === company.users.reader.id;
report.check('the reader (who holds no approval permission) corrects last week\'s approved reading', response.ok, `HTTP ${response.status} ${JSON.stringify(response.errors)}`);
if (rebilledByReader) {
    report.finding('medium', 'approval-bypass', `reader-a holds meter_readings.correct_last but not meter_readings.approve, yet their correction of an approved reading was approved and billed again at once in their own name: reading ${monaFirst.id} went 10.00 → ${monaAfter.amount_due}, approved_by=${monaAfter.approved_by}`);
}
report.equal('Mona: last week is now 40 kWh = 20.00, this week cleared: 25 + 10 - 25', await balance(mona), '10.00');
report.done('the reader enters Mona\'s week again: 608', await reader.put(`/meter-readings/${monaSecond.id}`, { current_reading: 608 }));
report.done('the manager approves it', await manager.post('/meter-readings/approve', { reading_ids: [Number(monaSecond.id)], confirm_unusual: true }));
report.equal('Mona owes 10 + (68 kWh = 34.00 − 50%)', await balance(mona), '27.00');

report.begin('9c. Stopping the standing discount and changing a reading\'s price');
report.done('Mona\'s standing discount is stopped', await manager.delete(`/subscriptions/${mona}/standing-discount`));
report.equal('readings already recorded keep the discount they were given', await balance(mona), '27.00');
report.equal('and the next reading will be recorded without one', scalar(`select count(*) from standing_discounts where subscription_id=${mona}`), 0);
const shopReading2 = Number(unusual.id);
report.done('the shop\'s price for this week is set to 0.70', await manager.put(`/meter-readings/${shopReading2}/pricing`, { unit_price: '0.70' }));
reading = one(`select * from meter_readings where id=${shopReading2}`);
report.equal('the reading is repriced: 2600 × 0.70', reading.amount_due, '1820.00');
if (reading.status === 'pending') report.done('and approved again', await manager.post('/meter-readings/approve', { reading_ids: [shopReading2], confirm_unusual: true }));
report.equal('the shop owes 285 + 1820', await balance(shop), '2105.00');
report.refused('a negative price is refused', await manager.put(`/meter-readings/${shopReading2}/pricing`, { unit_price: '-1' }));
report.refused('the reader may not change prices', await reader.put(`/meter-readings/${shopReading2}/pricing`, { unit_price: '0.10' }), [403]);

// ─────────────────────────────────────────────────────────────────────────
report.begin('10. Status changes: activate, disconnect, reconnect, archive, restore');
const updateForm = (id, changes) => {
    const row = one(`select s.*, p.full_name profile_name, p.national_id, p.phone from subscriptions s join subscriber_profiles p on p.id=s.subscriber_profile_id where s.id=${id}`);

    return { full_name: row.profile_name, national_id: row.national_id, phone: row.phone, tariff_id: Number(row.tariff_id), circuit_breaker_id: row.circuit_breaker_id && Number(row.circuit_breaker_id), meter_box_id: row.meter_box_id && Number(row.meter_box_id), minimum_charge: row.minimum_charge, initial_reading: row.initial_reading, subscription_date: row.subscription_date, status: row.status, ...changes };
};
report.done('the waiting subscriber is activated at reading 50', await manager.put(`/subscriptions/${khaled}`, updateForm(khaled, { status: 'active', initial_reading: 50 })));
report.done('and read this week: 50 → 90', await read2(reader, khaled, 90));
report.done('Salem is disconnected', await manager.put(`/subscriptions/${salem}`, updateForm(salem, { status: 'disconnected' })));
report.refused('a disconnected subscriber cannot go back to waiting', await manager.put(`/subscriptions/${salem}`, updateForm(salem, { status: 'suspended' })));
report.done('a disconnected subscriber can still pay', await pay(collector, salem, { amount: '52' }));
report.equal('Salem is settled', await balance(salem), '0.00');
report.refused('the collector may not archive', await collector.post(`/subscriptions/${salem}/archive`, { service_ended_on: clock.date(), reason: 'x', confirmed: true }), [403]);
report.refused('an active subscriber cannot be archived', await manager.post(`/subscriptions/${shop}/archive`, { service_ended_on: clock.date(), reason: 'x', confirmed: true }));
report.done('the disconnected Salem is archived', await manager.post(`/subscriptions/${salem}/archive`, { service_ended_on: clock.date(), reason: 'انتقل من المنطقة', confirmed: true }));
report.refused('an archived subscriber cannot be edited', await manager.put(`/subscriptions/${salem}`, updateForm(salem, { address: 'x' })), [403]);
report.refused('nor charged', await manager.post(`/subscriptions/${salem}/charges`, { type: 'penalty', amount: '5', notes: 'x' }), [403]);
report.refused('nor read', await read2(reader, salem, 1300));
report.check('nor listed for the collector', !(await collector.json('GET', '/payments/search?search=سالم')).text.includes('سالم عبد الله'), 'the archived subscriber is in the search results');
report.done('Salem is restored', await manager.delete(`/subscriptions/${salem}/archive`, { reason: 'عاد إلى المنطقة', confirmed: true }));
report.equal('with the same statement and balance', await balance(salem), '0.00');
report.done('and reconnected', await manager.put(`/subscriptions/${salem}`, updateForm(salem, { status: 'active' })));
report.refused('a subscriber with money on the account cannot be deleted', await manager.delete(`/subscriptions/${shop}`), [403, 302, 422]);
report.equal('the shop is still there', scalar(`select count(*) from subscriptions where id=${shop}`), 1);

// ─────────────────────────────────────────────────────────────────────────
report.begin('11. The log, the reports and the downloads agree with the statements');
const owed = sql(`select subscription_id, sum(amount) total from subscription_transactions where branch_id=${branch} group by subscription_id`);
const branchNet = money(owed.reduce((sum, row) => sum + cents(row.total), 0));
const log = (await manager.page('/ledger?period=all')).props;
report.equal('the financial log lists every line of the branch', log.entries.total, scalar(`select count(*) from subscription_transactions where branch_id=${branch}`));
report.equal('its net is what the subscribers owe', money(cents(log.ledgerTotals.net)), branchNet);
const collected = money(-cents(scalar(`select coalesce(sum(amount),0) from subscription_transactions where branch_id=${branch} and cancelled_at is null and reverses_id is null and type in ('payment','bank_audit_adjustment')`)));
report.equal('its collected total is the standing payments', money(cents(log.summary.collected)), collected);
report.equal('branch B\'s log shows none of branch A\'s lines', (await managerB.page('/ledger?period=all')).props.entries.total, scalar(`select count(*) from subscription_transactions where branch_id=${company.branches.b}`));
report.refused('the reader cannot open the financial log', await reader.page('/ledger'), [403]);

const reports = (await manager.page(`/reports?from=2026-11-01&to=${clock.date()}`)).props;
report.equal('the report closes on what the subscribers owe', reports.flow?.closing, branchNet);
const csv = await manager.raw('GET', `/reports/lines.csv?from=2026-11-01&to=${clock.date()}`);
report.check('the lines download as CSV', csv.status === 200 && /csv/.test(csv.headers.get('content-type') ?? ''), `HTTP ${csv.status} ${csv.headers.get('content-type')} ${csv.text.length} bytes`);
const csvRows = csv.text.trim().split('\n').length - 1;
report.check('the CSV has a row for every line of the period', csvRows >= Number(scalar(`select count(*) from subscription_transactions where branch_id=${branch}`)) - 1, `${csvRows} rows`);
report.check('no CSV cell starts a spreadsheet formula', !/(^|,)"?[=+@]/m.test(csv.text.split('\n').slice(1).join('\n')), 'a cell starts with = + or @');
report.refused('the collector cannot download the lines', await collector.raw('GET', '/reports/lines.csv'), [403]);
report.refused('branch B cannot ask for branch A\'s report', await managerB.page(`/reports?branch_id=${branch}&from=2026-11-01&to=${clock.date()}`), [403, 404, 422, 302, 200]);
const boxReport = await manager.page(`/payments/cash-boxes/report?branch_id=${branch}`);
report.check('the cash box report opens', boxReport.status === 200, `HTTP ${boxReport.status}`);
const receipt = await collector.page(`/subscriptions/${salem}/payments/${cashLine.id}/receipt`);
report.equal('the receipt prints the voucher', receipt.props?.receipt?.systemVoucherNumber, '000001');
report.refused('branch B cannot print branch A\'s receipt', await collectorB.page(`/subscriptions/${salem}/payments/${cashLine.id}/receipt`), [403, 404]);
const printed = await manager.page(`/subscriptions/statement-print?subscription_ids[]=${salem}&subscription_ids[]=${shop}`);
report.check('the statements print', printed.status === 200 || printed.status === 422, `HTTP ${printed.status}`);
const receivables = (await manager.page('/receivables')).props;
report.equal('the receivables page totals the positive balances', money(cents(receivables.summary.total)), money(owed.filter((row) => cents(row.total) > 0).reduce((sum, row) => sum + cents(row.total), 0)));

// ─────────────────────────────────────────────────────────────────────────
report.begin('12. The books, audited straight from the tables');
auditBooks(report);

process.exitCode = report.finish() ? 1 : 0;
