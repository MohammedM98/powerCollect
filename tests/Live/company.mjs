import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { artisan, one, PASSWORD, scalar, Session, sql } from './lib.mjs';

const file = () => path.join(process.env.LIVE_TEST_OUT, 'company.json');

export const BANK = 'بنك فلسطين';

/**
 * Set a fresh deployment up the way its Super Admin does, through the
 * website: locations, prices, two branches with their boxes, and each
 * branch's staff with what each may do. Returns the ids the scenarios need.
 */
export async function setUpCompany(report) {
    const owner = new Session('owner');
    report.done('the Super Admin signs in', await owner.signIn('owner'));
    const grants = JSON.parse(artisan('tinker', '--execute', 'require base_path("tests/Live/starter-permissions.php");').trim().split('\n').pop());

    report.done('adds a governorate', await owner.post('/governorates', { name: 'المحافظة الوسطى' }));
    const governorate = scalar("select id from governorates where name='المحافظة الوسطى'");
    report.done('adds an area', await owner.post('/areas', { name: 'مخيم النصيرات', governorate_id: governorate }));
    const area = scalar("select id from areas where name='مخيم النصيرات'");
    for (const name of ['البلوك أ', 'البلوك ب']) report.done(`adds sub-area ${name}`, await owner.post('/sub-areas', { name, area_id: area }));
    const blocks = sql('select id from sub_areas order by id').map((row) => row.id);
    for (const [currency, rate] of [['USD', '3.7'], ['JOD', '5.2']]) {
        report.done(`sets the ${currency} rate`, await owner.put(`/settings/currencies/${scalar(`select id from currency_rates where currency='${currency}'`)}`, { rate }));
    }
    report.done('adds the residential tariff', await owner.post('/tariffs', { category: 'residential', rate: '0.50' }));
    report.done('adds the commercial tariff', await owner.post('/tariffs', { category: 'commercial', rate: '0.80' }));
    report.done('adds a customer segment', await owner.post('/tariff-segments', { name: 'أسر محتاجة' }));
    report.done('adds a circuit breaker', await owner.post('/circuit-breakers', { ampere: 10, minimum_payment: '10' }));

    const branches = {};
    for (const [key, name, phone] of [['a', 'فرع النصيرات', '0599000001'], ['b', 'فرع البريج', '0599000002']]) {
        report.done(`adds branch ${name}`, await owner.post('/branches', { name, phone, is_active: true, governorate_id: governorate, area_id: area }));
        branches[key] = Number(scalar(`select id from branches where name='${name}'`));
    }
    const boxes = {};
    for (const [key, branch, name, number, block] of [['a1', 'a', 'المدارس', 'T-101', 0], ['a2', 'a', 'السوق', 'T-102', 1], ['b1', 'b', 'الجامع', 'T-201', 0]]) {
        report.done(`adds meter box ${number}`, await owner.post('/meter-boxes', { name, box_number: number, sub_area_id: blocks[block], branch_id: branches[branch], location: `قرب ${name}` }));
        boxes[key] = Number(scalar(`select id from meter_boxes where box_number='${number}'`));
    }

    const staff = {
        manager: ['مدير فرع النصيرات', 'manager-a', 'مدير فرع', 'a', 'branch_admin', ['collections.force_delete', 'collections.record_late', 'subscriptions.archive', 'subscriptions.view_archived', 'subscriptions.restore_archived', 'subscriptions.update_kilowatt_price', 'subscriptions.update_minimum_charge', 'subscriptions.bulk_update', 'reports.export', 'reports.view', 'reports.debt_aging', 'reports.transaction_audit', 'meter_readings.correct_last', 'meter_readings.browse_weeks']],
        collector: ['الجابي الأول', 'collector-a1', 'جابي', 'a', 'collector', ['collections.clearing']],
        collector2: ['الجابي الثاني', 'collector-a2', 'جابي', 'a', 'collector', []],
        reader: ['قارئ العدادات', 'reader-a', 'قارئ', 'a', 'data_entry', []],
        accountant: ['المحاسب', 'accountant-a', 'محاسب', 'a', 'accountant', ['collections.close_boxes']],
        auditor: ['المدقق المالي', 'auditor-1', 'مدقق', 'a', 'financial_auditor', []],
        managerB: ['مدير فرع البريج', 'manager-b', 'مدير فرع', 'b', 'branch_admin', []],
        collectorB: ['جابي البريج', 'collector-b1', 'جابي', 'b', 'collector', []],
    };
    const users = {};
    const permissions = {};
    for (const [key, [name, username, title, branch, role, extra]] of Object.entries(staff)) {
        if (!scalar(`select id from user_types where name='${title}'`)) report.done(`adds the user type ${title}`, await owner.post('/user-types', { name: title }));
        report.done(`adds the account ${username}`, await owner.post('/users', {
            name, username, password: PASSWORD, password_confirmation: PASSWORD, max_devices: 20,
            user_type_id: Number(scalar(`select id from user_types where name='${title}'`)), branch_id: branches[branch],
        }));
        users[key] = { id: Number(scalar(`select id from users where username='${username}'`)), username, name, branch: branches[branch] };
        permissions[users[key].id] = [...new Set([...grants.roles[role], ...extra.map((permission) => grants.keys[permission])])];
    }
    report.done('grants every account its permissions', await owner.put('/settings/permissions', {
        permissions,
        audit_settings: { [users.auditor.id]: { scope: 'all', branch_ids: [], actions: grants.auditActions } },
    }));
    report.equal('the collector holds exactly what was ticked', scalar(`select count(*) from permission_user where user_id=${users.collector.id}`), permissions[users.collector.id].length);

    const company = {
        governorate, area, blocks, branches, boxes, users, grants,
        tariffs: { residential: Number(scalar("select id from tariffs where category='residential'")), commercial: Number(scalar("select id from tariffs where category='commercial'")) },
        breaker: Number(one('select id from circuit_breakers').id), segment: Number(one('select id from tariff_segments').id),
    };
    writeFileSync(file(), JSON.stringify(company, null, 2));

    return company;
}

export function loadCompany() {
    if (!existsSync(file())) throw new Error('Run the lifecycle suite first: it sets the company up.');

    return JSON.parse(readFileSync(file(), 'utf8'));
}

/** Sign every member of staff in, each in a browser of their own. */
export async function signInStaff(company, names = Object.keys(company.users)) {
    const sessions = { owner: new Session('owner') };
    await sessions.owner.signIn('owner');
    for (const name of names) {
        sessions[name] = new Session(name);
        const response = await sessions[name].signIn(company.users[name].username);
        if (response.status !== 302 || /login/.test(response.location ?? '')) throw new Error(`${name} could not sign in (${response.status} → ${response.location})`);
    }

    return sessions;
}

/** The new-subscriber form as the branch fills it in. */
export function subscriberForm(company, overrides = {}) {
    return {
        full_name: 'سالم عبد الله', national_id: '401234567', phone: '0599123456', address: 'البلوك أ، قرب المدرسة',
        meter_box_id: company.boxes.a1, tariff_id: company.tariffs.residential, circuit_breaker_id: company.breaker,
        status: 'active', initial_reading: 1000, minimum_charge: 10, subscription_fee: '100', charge_subscription_fee: true,
        ...overrides,
    };
}
