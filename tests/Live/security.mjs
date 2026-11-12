import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { artisan, baseUrl, clock, MobileClient, one, PASSWORD, Report, scalar, Session, sql, uuid } from './lib.mjs';
import { BANK, loadCompany, signInStaff, subscriberForm } from './company.mjs';

/**
 * The site attacked from outside and from inside: without signing in, with
 * a forged form, as a member of staff reaching past their permissions and
 * as one branch reaching into another, on every route the application has.
 */
const report = new Report('security');
clock.set(process.env.LIVE_TEST_CLOCK_AT ?? '2026-11-26T09:00:00Z');
const company = loadCompany();
const staff = await signInStaff(company);
const { owner, manager, collector, reader, accountant, auditor, managerB, collectorB } = staff;
auditor.home = '/payments/cash-boxes?place=closed';
const { a: branchA, b: branchB } = company.branches;

// One record of branch A for every route parameter, so each route is asked for something real.
const subscription = Number(scalar(`select id from subscriptions where branch_id=${branchA} order by id limit 1`));
const first = (query) => Number(scalar(query) ?? 0);
const ids = {
    subscription, branch: branchA,
    transaction: first(`select id from subscription_transactions where subscription_id=${subscription} and type='payment' order by id limit 1`),
    cashBox: first(`select id from cash_boxes where branch_id=${branchA} order by id limit 1`),
    entry: first(`select p.id from cash_box_payments p join cash_boxes b on b.id=p.cash_box_id where b.branch_id=${branchA} and p.method='bank_transfer' order by p.id limit 1`),
    record: first(`select id from cash_boxes where branch_id=${branchA} order by id limit 1`),
    meter_box: company.boxes.a1, meter_reading: first(`select id from meter_readings where branch_id=${branchA} order by id limit 1`),
    splitPayment: first('select id from split_payments order by id limit 1'), user: company.users.collector.id,
    area: company.area, sub_area: company.blocks[0], governorate: company.governorate, tariff: company.tariffs.residential,
    tariff_segment: company.segment, circuit_breaker: company.breaker, bank: first('select id from banks limit 1'),
    currencyRate: first("select id from currency_rates where currency='USD'"), user_type: first('select id from user_types limit 1'),
    kind: 'ledger', action: 'receive',
};
const branchBound = ['subscription', 'transaction', 'cashBox', 'entry', 'record', 'meter_box', 'meter_reading', 'splitPayment', 'user', 'branch'];
const routes = JSON.parse(artisan('route:list', '--json', '--except-vendor')).filter((route) => !route.uri.includes('fallbackPlaceholder') && !route.uri.startsWith('_') && !route.uri.startsWith('storage'));
const fill = (uri) => {
    const names = [...uri.matchAll(/\{(\w+)\??\}/g)].map((match) => match[1]);
    if (names.some((name) => !ids[name])) return null;

    return { url: `/${uri.replace(/\{(\w+)\??\}/g, (_, name) => ids[name])}`, names };
};
const gets = routes.filter((route) => route.method.includes('GET') && !route.uri.startsWith('api/')).map((route) => ({ ...route, ...fill(route.uri) })).filter((route) => route.url);
const writes = routes.filter((route) => !route.method.includes('GET') && !route.uri.startsWith('api/')).map((route) => ({ ...route, verb: route.method.split('|')[0], ...fill(route.uri) })).filter((route) => route.url);

// ─────────────────────────────────────────────────────────────────────────
report.begin(`S1. Nobody gets in without signing in (${gets.length} pages, ${writes.length} forms, the field API)`);
const guest = new Session('guest');
await guest.raw('GET', '/login');
const open = [];
for (const route of gets) {
    const response = await guest.raw('GET', route.url, { headers: { 'X-Inertia': 'true', 'X-Inertia-Version': '' } });
    const toLogin = [301, 302, 303, 409].includes(response.status) && /\/login$/.test(response.location ?? response.headers.get('x-inertia-location') ?? '/login');
    if (!toLogin && !['login', '/', 'up'].includes(route.uri) && ![401, 403, 404].includes(response.status)) open.push(`${route.url} → ${response.status}`);
}
report.check('every page sends a visitor to the sign-in page', open.length === 0, open.join(', '));
const unguarded = [];
for (const route of writes.filter((route) => !['login'].includes(route.uri))) {
    const response = await guest.raw(route.verb, route.url, { body: {} });
    if (![302, 303, 401, 403, 404, 405, 419].includes(response.status) || ([302, 303].includes(response.status) && !/\/login$/.test(response.location ?? ''))) unguarded.push(`${route.verb} ${route.url} → ${response.status} ${response.location ?? ''}`);
}
report.check('every form refuses a visitor', unguarded.length === 0, unguarded.join(', '));
const api = routes.filter((route) => route.uri.startsWith('api/mobile/v1') && !route.uri.endsWith('/login'));
const apiOpen = [];
for (const route of api) {
    const url = `/${route.uri.replace(/\{(\w+)\??\}/g, (_, name) => ids[name] ?? 1)}`;
    for (const token of [null, 'x'.repeat(64), '']) {
        const response = await fetch(baseUrl + url, { method: route.method.split('|')[0], headers: { Accept: 'application/json', ...(token === null ? {} : { Authorization: `Bearer ${token}` }) } });
        if (![401, 404, 429].includes(response.status)) apiOpen.push(`${route.method} ${url} → ${response.status}`);
    }
}
report.check(`none of the ${api.length} field API routes answers without a valid token`, apiOpen.length === 0, apiOpen.slice(0, 5).join(', '));

report.begin('S2. A form forged from another site (CSRF) and sessions');
let response = await manager.raw('POST', `/subscriptions/${subscription}/charges`, { body: { type: 'penalty', amount: '5', notes: 'csrf' }, csrf: false });
report.equal('a form without the CSRF token is refused', response.status, 419);
response = await manager.raw('POST', `/subscriptions/${subscription}/charges`, { body: { type: 'penalty', amount: '5', notes: 'csrf' }, csrf: false, headers: { 'X-XSRF-TOKEN': 'forged' } });
report.equal('and with a forged token', response.status, 419);
const fresh = new Session('fixation');
const loginPage = await fresh.raw('GET', '/login');
const cookieName = [...fresh.cookies.keys()].find((name) => name !== 'XSRF-TOKEN');
const beforeLogin = fresh.cookies.get(cookieName);
const setCookies = loginPage.headers.getSetCookie();
const sessionCookie = setCookies.find((cookie) => cookie.startsWith(`${cookieName}=`)) ?? '';
report.check('the session cookie is HttpOnly and SameSite', /httponly/i.test(sessionCookie) && /samesite=(lax|strict)/i.test(sessionCookie), sessionCookie.replace(/=[^;]+/, '=…'));
await fresh.signIn(company.users.accountant.username);
report.check('signing in issues a new session id (no fixation)', fresh.cookies.get(cookieName) !== beforeLogin, 'the session id stayed the same');
const stolen = new Session('stolen');
stolen.cookies = new Map(fresh.cookies);
stolen.version = fresh.version;
await fresh.raw('POST', '/logout');
report.equal('after signing out the old cookie only reaches the sign-in page', (await stolen.page('/profile')).component, 'Auth/Login');
for (const [name, value] of [['X-Frame-Options', /SAMEORIGIN|DENY/], ['X-Content-Type-Options', /nosniff/], ['Referrer-Policy', /.+/], ['Permissions-Policy', /camera=\(\)/]]) {
    report.check(`every answer carries ${name}`, value.test(loginPage.headers.get(name) ?? ''), loginPage.headers.get(name));
}
report.check('the server does not announce PHP', !loginPage.headers.get('x-powered-by'), loginPage.headers.get('x-powered-by'));
const leaks = [];
for (const file of ['/.env', '/.git/config', '/composer.json', '/storage/logs/laravel.log', '/artisan', '/../.env', '/vendor/autoload.php', '/phpunit.xml', '/.env.example', '/storage/app/private/backups']) {
    const got = await guest.raw('GET', file);
    if (got.status === 200 && !/<html/i.test(got.text.slice(0, 500))) leaks.push(`${file} → ${got.status}`);
}
report.check('configuration, logs and source files are not served', leaks.length === 0, leaks.join(', '));

report.begin('S3. Guessing passwords');
const guesser = new Session('guesser');
await guesser.raw('GET', '/login');
guesser.version = owner.version;
const visitor = async () => {
    const session = new Session('visitor');
    await session.raw('GET', '/login');
    session.version = owner.version;

    return session;
};
const answers = [];
for (let attempt = 1; attempt <= 7; attempt++) answers.push((await guesser.post('/login', { username: 'owner', password: `wrong-${attempt}` }, '/login')).errors.username ?? '');
report.check('the sixth wrong password in a row is locked out', /ثانية|دقيقة|seconds|minute|محاولات/.test(answers[5]) && answers[5] !== answers[0], `1st: ${answers[0]} | 6th: ${answers[5]}`);
const unknown = (await (await visitor()).post('/login', { username: 'no-such-user', password: 'wrong' }, '/login')).errors.username;
report.equal('an unknown account is answered like a wrong password', unknown, answers[0]);
const phoneGuess = new MobileClient('guess');
const phoneAnswers = [];
for (let attempt = 1; attempt <= 7; attempt++) phoneAnswers.push((await phoneGuess.signIn(company.users.collectorB.username, `wrong-${attempt}`)).status);
report.equal('the field app locks out after five wrong passwords too', phoneAnswers.join(','), '422,422,422,422,422,429,429');
const spray = [];
for (const [index, name] of Object.keys(company.users).entries()) spray.push((await (await visitor()).post('/login', { username: company.users[name].username, password: `Spray-${index}` }, '/login')).errors.username ?? '');
const sprayed = spray.filter((message) => message === answers[0]).length;
if (sprayed === spray.length) report.finding('low', 'password-spraying', `one address tried a password on ${spray.length} different accounts with no slowdown: the lockout counts per account and address only`);
artisan('cache:clear');

report.begin(`S4. Every page, as every kind of account (${gets.length} pages × 8 accounts)`);
const matrix = {};
const serverErrors = [];
const actors = { owner, manager, accountant, reader, collector, auditor, managerB, collectorB };
for (const route of gets) {
    matrix[route.uri] = {};
    for (const [name, session] of Object.entries(actors)) {
        const got = await session.raw('GET', route.url, { headers: { 'X-Inertia': 'true', 'X-Inertia-Version': session.version ?? '' } });
        matrix[route.uri][name] = got.status;
        if (got.status >= 500) serverErrors.push(`${name} ${route.url} → ${got.status}`);
    }
}
writeFileSync(path.join(process.env.LIVE_TEST_OUT, 'access-matrix.json'), JSON.stringify(matrix, null, 1));
report.check('no page ends in a server error for anyone', serverErrors.length === 0, serverErrors.slice(0, 8).join(', '));
const crossed = [];
for (const route of gets.filter((candidate) => candidate.names.some((name) => branchBound.includes(name)))) {
    for (const name of ['managerB', 'collectorB']) {
        if (matrix[route.uri][name] === 200) crossed.push(`${name} opened ${route.url}`);
    }
}
report.check('branch B opens no page of a branch A record', crossed.length === 0, crossed.join(', '));
if (crossed.some((entry) => entry.includes('split-payments'))) {
    const leaked = (await collectorB.json('GET', `/split-payments/${ids.splitPayment}`)).data;
    report.finding('medium', 'split-payment-disclosure', `a collector of another branch reads a split transfer of this branch by its number: sender ${leaked?.senderName}, reference ${leaked?.referenceNumber}, total ${leaked?.total}, bank ${leaked?.bankName}, recorded by ${leaked?.recordedByName}`);
}
const must = (uri, allowed) => {
    const got = Object.entries(matrix[uri] ?? {}).filter(([, status]) => status === 200).map(([name]) => name).sort().join(',');
    report.equal(`${uri} opens only for ${allowed.join(', ')}`, got, [...allowed].sort().join(','));
};
must('settings/permissions', ['owner', 'manager', 'managerB']);
must('users', ['owner', 'manager', 'managerB']);
must('branches', ['owner']);
must('settings/sms', ['owner']);
must('settings/payments', ['owner']);
must('ledger', ['owner', 'manager', 'managerB', 'auditor']);
must('transaction-audit', ['owner', 'manager', 'managerB', 'auditor']);
must('reports', ['owner', 'manager', 'managerB', 'accountant']);
must('receivables', ['owner', 'manager', 'managerB']);
const lowOpen = Object.entries(matrix).filter(([uri, row]) => row.collector === 200).map(([uri]) => uri);
report.check('the collector opens only the collection pages', lowOpen.every((uri) => /^(dashboard|profile|payments|auth\/session|branch-access|subscriptions\/\{subscription\}\/(statement|payments|messages)|split-payments|settings\/mobile-app|paper-sheets|reading-cycles\/print|meter-boxes\/options|confirm-password)/.test(uri)), lowOpen.join(' '));

report.begin('S5. One branch reaching into another (forms)');
const refusedAll = async (name, session, attempts) => {
    const before = scalar('select md5(group_concat(concat_ws(":", id, amount, status, coalesce(notes,"")) order by id)) from subscription_transactions') + scalar('select md5(group_concat(concat_ws(":", id, status, current_reading, amount_due) order by id)) from meter_readings') + scalar('select md5(group_concat(concat_ws(":", id, status, coalesce(archived_at,""), coalesce(meter_box_id,""), minimum_charge) order by id)) from subscriptions') + scalar('select md5(group_concat(concat_ws(":", id, name, username, is_active, coalesce(branch_id,""), role, password) order by id)) from users') + scalar('select count(*) from permission_user') + scalar('select md5(group_concat(concat_ws(":", id, status) order by id)) from cash_boxes');
    const let_through = [];
    for (const [label, verb, url, body] of attempts) {
        const got = await session.submit(verb, url, body);
        if (got.status >= 500) let_through.push(`${label} → HTTP ${got.status}`);
        else if (got.ok) let_through.push(`${label} → accepted (${got.status})`);
    }
    const after = scalar('select md5(group_concat(concat_ws(":", id, amount, status, coalesce(notes,"")) order by id)) from subscription_transactions') + scalar('select md5(group_concat(concat_ws(":", id, status, current_reading, amount_due) order by id)) from meter_readings') + scalar('select md5(group_concat(concat_ws(":", id, status, coalesce(archived_at,""), coalesce(meter_box_id,""), minimum_charge) order by id)) from subscriptions') + scalar('select md5(group_concat(concat_ws(":", id, name, username, is_active, coalesce(branch_id,""), role, password) order by id)) from users') + scalar('select count(*) from permission_user') + scalar('select md5(group_concat(concat_ws(":", id, status) order by id)) from cash_boxes');
    report.check(`${name}: all ${attempts.length} attempts are refused`, let_through.length === 0, let_through.join(' ‖ '));
    report.check(`${name}: nothing changed`, before === after, 'a table changed');
};
const line = ids.transaction;
const reading = ids.meter_reading;
const crossBranch = [
    ['pay', 'POST', `/subscriptions/${subscription}/payments`, { payment_token: uuid(), amount: '1', currency: 'ILS', payment_method: 'cash' }],
    ['charge', 'POST', `/subscriptions/${subscription}/charges`, { type: 'penalty', amount: '5', notes: 'x' }],
    ['discount', 'POST', `/subscriptions/${subscription}/discounts`, { method: 'shekel', value: '1' }],
    ['clearing', 'POST', `/subscriptions/${subscription}/clearings`, { amount: '1', notes: 'x' }],
    ['standing discount', 'PUT', `/subscriptions/${subscription}/standing-discount`, { method: 'percentage', value: '90', segment: 'x' }],
    ['edit subscriber', 'PUT', `/subscriptions/${subscription}`, subscriberForm(company, { full_name: 'مخترق', national_id: '411111111' })],
    ['phone', 'PATCH', `/subscriptions/${subscription}/phone`, { phone: '0599000009' }],
    ['personal details', 'PATCH', `/subscriptions/${subscription}/personal-details`, { full_name: 'مخترق' }],
    ['archive', 'POST', `/subscriptions/${subscription}/archive`, { service_ended_on: clock.date(), reason: 'x', confirmed: true }],
    ['delete subscriber', 'DELETE', `/subscriptions/${subscription}`, {}],
    ['line action', 'POST', `/subscriptions/${subscription}/transactions/${line}/actions`, { action: 'refund', correction_notes: 'x' }],
    ['amend line', 'PATCH', `/subscriptions/${subscription}/transactions/${line}/details`, { notes: 'x', amendment_reason: 'x' }],
    ['correct line', 'PUT', `/subscriptions/${subscription}/transactions/${line}`, { amount: '1', currency: 'ILS', payment_method: 'cash', correction_reason: 'wrong_amount' }],
    ['delete line', 'DELETE', `/subscriptions/${subscription}/transactions/${line}`, { correction_reason: 'other', correction_notes: 'x' }],
    ['erase line', 'DELETE', `/subscriptions/${subscription}/transactions/${line}/permanent`, { correction_notes: 'x' }],
    ['enter reading', 'POST', '/meter-readings', { subscription_id: subscription, week_start: clock.date(), current_reading: 99999 }],
    ['correct reading', 'PUT', `/meter-readings/${reading}`, { current_reading: 1 }],
    ['approve reading', 'POST', '/meter-readings/approve', { reading_ids: [reading], confirm_unusual: true }],
    ['reading price', 'PUT', `/meter-readings/${reading}/pricing`, { unit_price: '0.01' }],
    ['last reading', 'PUT', `/meter-readings/${reading}/last-reading`, { adjustment_type: 'correction', current_reading: 1, expected_reading: 1 }],
    ['reading baseline', 'PUT', `/subscriptions/${subscription}/reading-baseline`, { initial_reading: 1, reason: 'x' }],
    ['close box', 'POST', `/payments/cash-boxes/actions/receive/${ids.cashBox}`, { branch_id: branchA }],
    ['close box as own branch', 'POST', `/payments/cash-boxes/actions/receive/${ids.cashBox}`, { branch_id: branchB }],
    ['audit box', 'POST', `/payments/cash-boxes/${ids.cashBox}/audit`, { confirmed: true }],
    ['edit meter box', 'PUT', `/meter-boxes/${company.boxes.a1}`, { name: 'مخترق', box_number: 'X-1', sub_area_id: company.blocks[0] }],
    ['delete meter box', 'DELETE', `/meter-boxes/${company.boxes.a1}`, {}],
    ['edit user', 'PUT', `/users/${company.users.collector.id}`, { name: 'مخترق', username: 'collector-a1', is_active: false }],
    ['reset password', 'PUT', `/users/${company.users.collector.id}`, { name: 'الجابي الأول', username: 'collector-a1', password: 'Hacked-Pass-2026', password_confirmation: 'Hacked-Pass-2026' }],
    ['delete user', 'DELETE', `/users/${company.users.collector.id}`, {}],
    ['edit branch', 'PUT', `/branches/${branchA}`, { name: 'مخترق', is_active: false }],
    ['bulk change', 'POST', '/subscriptions/bulk-changes', { field: 'status', value: 'disconnected', expected_count: 1, ids: [subscription] }],
    ['split payment', 'POST', '/payments/split', { total_amount: '2', bank_name: BANK, sender_name: 'x', reference_number: 'X-SPLIT', parts: [{ subscription_id: subscription, amount: '1' }, { subscription_id: subscription + 1, amount: '1' }] }],
];
await refusedAll('branch B\'s manager against branch A', managerB, crossBranch);

report.begin('S6. Staff reaching past their own permissions');
const everything = Object.values(company.grants.keys).filter(Boolean);
await refusedAll('the collector', collector, [
    ...crossBranch.filter(([label]) => !['pay', 'clearing', 'split payment'].includes(label)),
    ['grant himself everything', 'PUT', '/settings/permissions', { permissions: { [company.users.collector.id]: everything } }],
    ['create a user', 'POST', '/users', { name: 'x', username: 'backdoor', password: PASSWORD, password_confirmation: PASSWORD }],
    ['change the dollar rate', 'PUT', `/settings/currencies/${ids.currencyRate}`, { rate: '0.01' }],
    ['change a tariff', 'PUT', `/tariffs/${company.tariffs.residential}`, { category: 'residential', rate: '0.01' }],
    ['change the reading schedule', 'PUT', '/settings/reading-schedule', { reading_day: 1 }],
    ['change the SMS gateway', 'PUT', '/settings/sms', { url: 'https://evil.example/sms' }],
    ['add a bank', 'POST', '/settings/banks', { name: 'بنك وهمي', is_receiver: true }],
]);
await refusedAll('the reader', reader, crossBranch.filter(([label]) => ['pay', 'charge', 'discount', 'clearing', 'standing discount', 'line action', 'amend line', 'correct line', 'delete line', 'erase line', 'approve reading', 'close box', 'audit box', 'edit user', 'reset password', 'delete user', 'edit branch', 'archive', 'delete subscriber', 'split payment'].includes(label)));
await refusedAll('the auditor (read-only)', auditor, crossBranch.filter(([label]) => !['audit box'].includes(label)));
await refusedAll('branch A\'s manager climbing', manager, [
    ['make himself Super Admin', 'PUT', `/users/${company.users.manager.id}`, { name: 'مدير', username: 'manager-a', role: 'super_admin' }],
    ['make himself company-wide', 'PUT', `/users/${company.users.manager.id}`, { name: 'مدير', username: 'manager-a', company_wide: true, branch_id: null }],
    ['move himself to branch B', 'PUT', `/users/${company.users.manager.id}`, { name: 'مدير', username: 'manager-a', branch_id: branchB }],
    ['change the owner\'s password', 'PUT', `/users/${scalar("select id from users where username='owner'")}`, { name: 'مالك', username: 'owner', password: 'Hacked-Pass-2026', password_confirmation: 'Hacked-Pass-2026' }],
    ['delete the owner', 'DELETE', `/users/${scalar("select id from users where username='owner'")}`, {}],
    ['make a collector an auditor of every branch', 'PUT', '/settings/permissions', { permissions: { [company.users.collector.id]: [] }, audit_settings: { [company.users.collector.id]: { scope: 'all', branch_ids: [], actions: company.grants.auditActions } } }],
    ['hand on the right to grant', 'PUT', '/settings/permissions', { permissions: { [company.users.collector.id]: [] }, grantable: { [company.users.collector.id]: everything } }],
    ['change the dollar rate', 'PUT', `/settings/currencies/${ids.currencyRate}`, { rate: '0.01' }],
    ['register into branch B', 'POST', '/subscriptions', subscriberForm(company, { national_id: '422222222', branch_id: branchB, meter_box_id: company.boxes.b1 })],
]);
const held = (userId) => sql(`select p.key from permission_user pu join permissions p on p.id=pu.permission_id where pu.user_id=${userId} order by p.key`).map((row) => row.key).join(' ');
const heldBefore = { manager: held(company.users.manager.id), collector: held(company.users.collector.id), collectorB: held(company.users.collectorB.id), managerB: held(company.users.managerB.id) };
await manager.put('/settings/permissions', { permissions: { [company.users.manager.id]: everything, [company.users.collectorB.id]: everything, [company.users.managerB.id]: [], [company.users.collector.id]: [...company.grants.roles.collector, company.grants.keys['collections.clearing'], company.grants.keys['branches.delete'], company.grants.keys['branches.manage_domains'], company.grants.keys['closings.audit'], company.grants.keys['users.manage_permissions']] } }, '/settings/permissions');
report.equal('a manager ticking every permission for himself gains none', held(company.users.manager.id), heldBefore.manager);
report.equal('nor changes anything in branch B', held(company.users.collectorB.id) + held(company.users.managerB.id), heldBefore.collectorB + heldBefore.managerB);
report.check('nor hands a collector what the Super Admin did not let him hand on', !/branches\.|closings\.audit|users\.manage_permissions/.test(held(company.users.collector.id)), held(company.users.collector.id));
await managerB.put('/settings/permissions', { permissions: { [company.users.collector.id]: everything, [company.users.manager.id]: [] } }, '/settings/permissions');
report.equal('branch B\'s manager changes nobody\'s permissions in branch A', held(company.users.manager.id), heldBefore.manager);
await owner.put('/settings/permissions', { permissions: { [company.users.collector.id]: [...company.grants.roles.collector, company.grants.keys['collections.clearing']] } }, '/settings/permissions');
await manager.post('/users', { name: 'موظف جديد', username: 'new-clerk', password: PASSWORD, password_confirmation: PASSWORD, branch_id: branchB, company_wide: true, role: 'super_admin' });
const clerk = one("select role, branch_id from users where username='new-clerk'");
report.check('an account a manager creates lands in his own branch, whatever branch or role the form names', clerk === null || (Number(clerk.branch_id) === branchA && clerk.role !== 'super_admin'), JSON.stringify(clerk));
report.equal('nobody became a Super Admin', scalar("select count(*) from users where role='super_admin'"), 1);
report.equal('the manager is still in his own branch', one(`select branch_id from users where id=${company.users.manager.id}`).branch_id, branchA);

report.begin('S7. A stopped account is out at once, on the site and the field app');
const leaver = new Session('leaver');
await leaver.signIn(company.users.collectorB.username);
const leaverPhone = new MobileClient('leaver');
await leaverPhone.signIn(company.users.collectorB.username);
report.check('the collector is signed in on both', (await leaver.page('/profile')).status === 200 && (await leaverPhone.call('GET', '/me')).status === 200, `site ${(await leaver.page('/profile')).status}, app ${(await leaverPhone.call('GET', '/me')).status}`);
const leaverRow = one(`select name, username, user_type_id from users where id=${company.users.collectorB.id}`);
response = await owner.put(`/users/${company.users.collectorB.id}`, { name: leaverRow.name, username: leaverRow.username, user_type_id: Number(leaverRow.user_type_id), branch_id: branchB, is_active: false });
report.done('the Super Admin stops the account', response);
report.equal('the open browser is sent to the sign-in page on its next click', (await leaver.page('/profile')).component, 'Auth/Login');
report.equal('the field app token stops working', (await leaverPhone.call('GET', '/me')).status, 401);
report.check('and signing in again is refused', !(await new Session('again').signIn(company.users.collectorB.username)).signedIn, 'signed in');
await owner.put(`/users/${company.users.collectorB.id}`, { name: leaverRow.name, username: leaverRow.username, user_type_id: Number(leaverRow.user_type_id), branch_id: branchB, is_active: true });
const changer = new Session('changer');
await changer.signIn(company.users.accountant.username);
response = await changer.put('/password', { current_password: PASSWORD, password: 'New-Strong-Pass-2027', password_confirmation: 'New-Strong-Pass-2027' }, '/profile');
report.equal('staff cannot change their own password (only a manager sets it)', response.status, 403);
report.finding('info', 'own-password', 'an employee cannot change their own password: PUT /password answers 403 for everyone but the Super Admin, so whoever holds users.manage_passwords knows or sets every password of the branch and could sign in as any collector');
await owner.put('/password', { current_password: 'nope', password: 'New-Strong-Pass-2027', password_confirmation: 'New-Strong-Pass-2027' }, '/profile');
report.check('a wrong current password changes nothing', (await new Session('check').signIn('owner', PASSWORD)).signedIn, 'the old password no longer works');
await owner.signIn('owner');
await owner.put('/password', { current_password: PASSWORD, password: '1234567', password_confirmation: '1234567' }, '/profile');
report.check('a seven-character password is refused', !(await new Session('check').signIn('owner', '1234567')).signedIn, 'accepted');
await owner.signIn('owner');
await owner.put('/password', { current_password: PASSWORD, password: '12345678', password_confirmation: '12345678' }, '/profile');
const weak = new Session('weak');
if ((await weak.signIn('owner', '12345678')).signedIn) {
    report.check('the Super Admin cannot set the password 12345678', false, 'accepted: the only rule is eight characters');
    report.finding('medium', 'weak-password-policy', 'the Super Admin\'s password was changed to 12345678 and it signs in: Password::defaults() asks for eight characters and nothing else (no mixed characters, no check against known leaked passwords)');
    await weak.put('/password', { current_password: '12345678', password: PASSWORD, password_confirmation: PASSWORD }, '/profile');
}
await owner.signIn('owner');
report.check('the Super Admin\'s password is back as it was', (await owner.page('/profile')).component !== 'Auth/Login', 'could not sign in again');

report.begin('S8. Hostile input: injection, scripts and spreadsheet formulas');
const hostile = ["' OR 1=1 -- ", '"; DROP TABLE users; --', '%27%20UNION%20SELECT%20password%20FROM%20users--', '<script>alert(1)</script>', '{{7*7}}', '../../../../etc/passwd', '\u0000', 'a'.repeat(5000), '[]', '-1', '1e309', '2026-13-45'];
const listPages = ['/subscriptions', '/ledger', '/payments', '/payments/search', '/meter-readings', '/users', '/receivables', '/reports', '/transaction-audit', '/meter-boxes', '/payments/cash-boxes', '/messages', '/payments/entries'];
const crashed = [];
for (const page of listPages) {
    for (const value of hostile) {
        for (const parameter of ['search', 'sort', 'direction', 'status', 'branch_id', 'from', 'to', 'page', 'per_page', 'week', 'period', 'type', 'q']) {
            const got = await owner.raw('GET', `${page}?${parameter}=${encodeURIComponent(value)}`, { headers: { 'X-Inertia': 'true', 'X-Inertia-Version': owner.version ?? '' } });
            if (got.status >= 500) crashed.push(`${page}?${parameter}=${value.slice(0, 30)} → ${got.status}`);
        }
    }
}
report.check(`${listPages.length * hostile.length * 13} hostile filter values cause no server error`, crashed.length === 0, `${crashed.length}: ${crashed.slice(0, 6).join(' ‖ ')}`);
if (crashed.length) report.finding('low', 'filter-500', `${crashed.length} hostile filter values end in HTTP 500 instead of a validation message, e.g. ${crashed.slice(0, 4).join(' ‖ ')}`);
report.equal('the users table is still there', scalar('select count(*) > 0 from users'), 1);
const script = '<script>window.hacked=1</script><img src=x onerror=alert(1)>';
response = await manager.post('/subscriptions', subscriberForm(company, { full_name: script, national_id: '433333333', phone: '0599333000', address: script, notes: script, subscription_fee: '10' }));
report.done('a subscriber named with a script is stored as text', response);
const evil = Number(scalar("select s.id from subscriptions s join subscriber_profiles p on p.id=s.subscriber_profile_id where p.national_id='433333333'"));
const html = await manager.raw('GET', `/subscriptions/${evil}/statement`);
report.check('the page never carries the script as live HTML', !html.text.includes('<script>window.hacked') && !html.text.includes('<img src=x onerror'), 'the raw tag is in the HTML');
response = await manager.post('/subscriptions', subscriberForm(company, { full_name: '=HYPERLINK("http://evil.example","اضغط")', national_id: '444444444', phone: '0599444000', subscription_fee: '10', notes: '+cmd|calc' }));
const formula = Number(scalar("select s.id from subscriptions s join subscriber_profiles p on p.id=s.subscriber_profile_id where p.national_id='444444444'"));
await manager.post(`/subscriptions/${formula}/charges`, { type: 'penalty', amount: '5', notes: '=1+1' });
await manager.post(`/subscriptions/${formula}/charges`, { type: 'penalty', amount: '5', notes: '@SUM(A1:A9)' });
const csv = await manager.raw('GET', `/reports/lines.csv?from=2026-11-01&to=${clock.date()}`);
const dangerous = csv.text.split('\n').slice(1).flatMap((row) => row.match(/(?:^|,)"?[=+@\-][A-Za-z(|]/g) ?? []);
report.check('the CSV download neutralises cells that start a formula', csv.status === 200 && dangerous.length === 0, `HTTP ${csv.status}; ${dangerous.length} cells start with = + - or @: ${dangerous.slice(0, 4).join(' ')}`);
if (csv.status === 200 && dangerous.length) report.finding('medium', 'csv-formula-injection', `${dangerous.length} cells of reports/lines.csv start a spreadsheet formula taken from a subscriber's name or a note`);
const props = (await manager.page('/dashboard')).data;
const flat = JSON.stringify(props);
report.check('no page hands the browser a password hash or token', !/\$2y\$|remember_token|token_hash|"password"/.test(flat), flat.match(/.{40}(\$2y\$|remember_token|token_hash|"password").{40}/)?.[0]);
const usersPage = JSON.stringify((await manager.page('/users')).data);
report.check('nor does the users list', !/\$2y\$|remember_token|"password":/.test(usersPage), usersPage.match(/.{40}(\$2y\$|remember_token).{40}/)?.[0]);

report.begin('S9. Uploads');
const upload = async (session, url, field, name, type, content, extra = {}) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(extra)) form.append(key, value);
    form.append(field, new Blob([content], { type }), name);
    const got = await fetch(baseUrl + url, { method: 'POST', body: form, redirect: 'manual', headers: { Cookie: session.cookieHeader(), 'X-XSRF-TOKEN': decodeURIComponent(session.cookies.get('XSRF-TOKEN')), 'X-Inertia': 'true', 'X-Inertia-Version': session.version ?? '', Referer: `${baseUrl}/settings/payments`, Accept: 'text/html' } });
    session.keep(got);
    const after = got.headers.get('location') ? await session.page(got.headers.get('location')) : null;

    return { status: got.status, errors: after?.props?.errors ?? {}, ok: got.status < 400 && Object.keys(after?.props?.errors ?? {}).length === 0 };
};
const php = '<?php echo shell_exec($_GET["c"]); ?>';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
report.refused('a PHP file as a bank logo is refused', await upload(owner, '/settings/banks', 'logo', 'shell.php', 'image/png', php, { name: 'بنك الاختبار ١', is_receiver: '1', is_sender: '1', is_active: '1' }));
report.refused('a PHP file dressed as a PNG is refused', await upload(owner, '/settings/banks', 'logo', 'shell.png', 'image/png', php, { name: 'بنك الاختبار ٢', is_receiver: '1', is_sender: '1', is_active: '1' }));
report.refused('an SVG with a script is refused', await upload(owner, '/settings/banks', 'logo', 'logo.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', { name: 'بنك الاختبار ٣', is_receiver: '1', is_sender: '1', is_active: '1' }));
response = await upload(owner, '/settings/banks', 'logo', 'logo.php.png', 'image/png', Buffer.concat([png, Buffer.from(php)]), { name: 'بنك الاختبار ٤', is_receiver: '1', is_sender: '1', is_active: '1' });
const stored = one("select logo_path from banks where name='بنك الاختبار ٤'")?.logo_path;
report.check('a real image with PHP appended is stored under a generated name that is not .php', !stored || (!/\.php/i.test(stored) && !stored.includes('logo.php')), `stored as ${stored}`);
report.refused('the manager may not upload bank logos', await upload(manager, '/settings/banks', 'logo', 'logo.png', 'image/png', png, { name: 'بنك المدير', is_receiver: '1' }), [403]);

report.begin('S10. The field API: tokens, branches and permissions');
const phone = new MobileClient('collector');
await phone.signIn(company.users.collector.username);
report.equal('a collector reads their own profile', (await phone.call('GET', '/me')).status, 200);
const foreign = Number(scalar(`select id from subscriptions where branch_id=${branchB} limit 1`));
report.check('another branch\'s subscriber cannot be opened', [403, 404].includes((await phone.call('GET', `/collections/subscriptions/${foreign}`)).status), `HTTP ${(await phone.call('GET', `/collections/subscriptions/${foreign}`)).status}`);
report.check('nor their statement', [403, 404].includes((await phone.call('GET', `/collections/subscriptions/${foreign}/transactions`)).status), `HTTP ${(await phone.call('GET', `/collections/subscriptions/${foreign}/transactions`)).status}`);
report.equal('nor paid into', (await phone.call('POST', '/collections', { mobile_operation_id: uuid(), collector_confirmed: true, subscription_id: foreign, amount: '1', currency: 'ILS', payment_method: 'cash' })).status, 422);
report.equal('nor adjusted', [403, 404, 422].includes((await phone.call('POST', `/collections/subscriptions/${foreign}/adjustments`, { type: 'penalty', amount: '5', notes: 'x' })).status), true);
const list = await phone.call('GET', '/collections/subscriptions?per_page=500');
report.check('the subscriber list holds the collector\'s branch only', list.status === 200 && !JSON.stringify(list.data).includes('مشترك البريج'), `HTTP ${list.status}`);
report.check('the API answers are never cached', /no-store/.test(list.headers.get('cache-control') ?? ''), list.headers.get('cache-control'));
report.equal('a negative amount is refused', (await phone.call('POST', '/collections', { mobile_operation_id: uuid(), collector_confirmed: true, subscription_id: subscription, amount: '-5', currency: 'ILS', payment_method: 'cash' })).status, 422);
report.equal('a collection the collector did not confirm is refused', (await phone.call('POST', '/collections', { mobile_operation_id: uuid(), subscription_id: subscription, amount: '5', currency: 'ILS', payment_method: 'cash' })).status, 422);
const readerPhone = new MobileClient('reader');
await readerPhone.signIn(company.users.reader.username);
report.equal('the reader\'s token cannot record collections', (await readerPhone.call('POST', '/collections', { mobile_operation_id: uuid(), collector_confirmed: true, subscription_id: subscription, amount: '5', currency: 'ILS', payment_method: 'cash' })).status, 403);
const auditorPhone = new MobileClient('auditor');
report.equal('the auditor cannot use the field app at all', (await auditorPhone.signIn(company.users.auditor.username)).status, 403);
const operation = uuid();
await phone.call('POST', '/collections', { mobile_operation_id: operation, collector_confirmed: true, subscription_id: subscription, amount: '1', currency: 'ILS', payment_method: 'cash', confirm_overpayment: true });
const phone2 = new MobileClient('collector2');
await phone2.signIn(company.users.collector2.username);
report.equal('another collector cannot replay someone else\'s operation id', (await phone2.call('POST', '/collections', { mobile_operation_id: operation, collector_confirmed: true })).status, 403);
const oldToken = phone.token;
await phone.call('POST', '/logout');
phone.token = oldToken;
report.equal('a token is dead after signing out', (await phone.call('GET', '/me')).status, 401);
report.check('tokens are stored hashed, never as issued', Number(scalar(`select count(*) from mobile_access_tokens where token_hash='${oldToken}'`)) === 0 && /^[a-f0-9]{64}$/.test(one('select token_hash from mobile_access_tokens limit 1')?.token_hash ?? 'a'.repeat(64)), 'a plain token is in the table');
report.check('passwords are stored with bcrypt', sql('select password from users').every((row) => /^\$2y\$1[0-9]\$/.test(row.password)), 'a password is not a bcrypt hash');

process.exitCode = report.finish() ? 1 : 0;
