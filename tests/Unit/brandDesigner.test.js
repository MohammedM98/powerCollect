import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function designer() {
    const html = readFileSync(new URL('../../public/powercollect-brand-designer.html', import.meta.url), 'utf8');
    const scripts = [...html.matchAll(/<script id="designer-(?:palette|app)">([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    const context = vm.createContext({ React: { createElement() {}, useState() {}, useEffect() {}, useMemo() {}, useRef() {} }, ReactDOM: { createRoot: () => ({ render() {} }) }, document: { getElementById() {} } });
    vm.runInContext(scripts.join('\n').replace('ReactDOM.createRoot(document.getElementById(\'root\')).render(h(App));', 'globalThis.contract = { fromFile, toFile, blankIdentity, normalizeMaker, MAKER_DEFAULTS, COLOR_SETS, DESIGN };'), context);
    return context.contract;
}

test('legacy customer files get neutral new choices and preserve original choices', () => {
    const { fromFile, toFile } = designer();
    const output = toFile(fromFile({ version: 1, company: { name: 'شركة تجريبية' }, design: { tables: 'spreadsheet', navigation: 'topbar' } }));

    assert.equal(output.design.tables, 'spreadsheet');
    assert.equal(output.design.navigation, 'topbar');
    assert.equal(output.design.tableVariant, 'default');
    assert.equal(output.design.motionStyle, 'standard');
    assert.equal(output.design.details, 'modal');
    assert.equal(output.design.footerStyle, 'full');
    assert.equal(output.colors.secondary, null);
});

test('five color roles and structural options round trip without maker or unknown keys', () => {
    const { fromFile, toFile, COLOR_SETS } = designer();
    const output = toFile(fromFile({ version: 1, company: { name: 'اختبار' }, maker: { product: 'overwrite' }, colors: { ...COLOR_SETS[1].colors, success: '#123456', unknown: '#000000' }, design: { tableVariant: 'ledger', motionStyle: 'slide', details: 'modal', footerStyle: 'compact', unknown: 'ignored' } }));

    assert.equal(output.colors.success, '#123456');
    for (const role of ['primary', 'secondary', 'accent', 'background', 'surface']) assert.match(output.colors[role], /^#[0-9A-F]{6}$/);
    assert.equal(output.design.details, 'modal');
    assert.equal(output.design.tableVariant, 'ledger');
    assert.equal(output.design.motionStyle, 'slide');
    assert.equal(output.design.footerStyle, 'compact');
    assert.equal('maker' in output, false);
    assert.equal('unknown' in output.colors, false);
    assert.equal('unknown' in output.design, false);
});

test('developer identity keeps original team defaults and has an independent safe export', () => {
    const { normalizeMaker, MAKER_DEFAULTS } = designer();
    const original = JSON.parse(readFileSync(new URL('../../resources/brand/maker.json', import.meta.url), 'utf8'));
    assert.equal(MAKER_DEFAULTS.team.length, original.team.length);
    assert.equal(MAKER_DEFAULTS.team[0].name, original.team[0].name);
    const maker = normalizeMaker({ product: 'Product', company: { name: 'Developer', ignored: 'bad' }, team: [{ name: 'Person', role: 'Engineer', phone: '+9701' }, { name: '  ' }], colors: {} });

    assert.equal(maker.company.name, 'Developer');
    assert.equal(maker.team.length, 1);
    assert.equal(maker.team[0].role, 'Engineer');
    assert.equal('colors' in maker, false);
    assert.equal('ignored' in maker.company, false);
});
