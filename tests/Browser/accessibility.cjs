const { chromium, expect: browserExpect } = require('playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const assert = require('node:assert/strict');
const { writeFileSync } = require('node:fs');
const expect = browserExpect.configure({ timeout: 15_000 });

/**
 * An automated accessibility scan (axe, WCAG 2.1 A and AA) of the main pages,
 * light and dark. It records what it finds in a11y.json and a11y-summary.md
 * and fails only when a page cannot be opened or throws; the findings
 * themselves are for the owner to triage.
 */
const pages = [
    { name: 'الدخول', path: '/login', signedIn: false },
    { name: 'البداية', path: '/dashboard' },
    { name: 'المشتركون', path: '/subscriptions' },
    { name: 'كشف الحساب', path: '/subscriptions', openStatement: true },
    { name: 'الدفعات', path: '/payments' },
    { name: 'الصناديق', path: '/payments/cash-boxes' },
    { name: 'التقارير', path: '/reports' },
    { name: 'الذمم', path: '/receivables' },
    { name: 'السجل', path: '/ledger' },
    { name: 'المستخدمون', path: '/users' },
    { name: 'الرسائل', path: '/messages' },
    { name: 'المظهر', path: '/settings/appearance' },
];
const impactOrder = ['critical', 'serious', 'moderate', 'minor'];

async function signIn(page) {
    await page.goto('/login');
    await page.locator('#username').fill('owner');
    await page.locator('#password').fill('Strong-Pass-2026');
    await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

async function open(page, target) {
    await page.goto(target.path);
    await page.waitForLoadState('networkidle');
    if (target.openStatement) {
        await page.locator('.data-table tbody > tr[data-clickable]').first().locator('.row-identity-text > button').click();
        await expect(page.getByRole('dialog', { name: /^كشف حساب/ }).locator('.account-statement')).toBeVisible();
        await page.waitForLoadState('networkidle');
    }
    await page.waitForTimeout(300);
}

(async () => {
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    const errors = [];
    const results = [];
    try {
        for (const theme of ['light', 'dark']) {
            const context = await browser.newContext({ baseURL: process.env.BASE_URL, viewport: { width: 1500, height: 1000 }, locale: 'ar', reducedMotion: 'reduce' });
            await context.addInitScript((mode) => localStorage.setItem('theme', mode), theme);
            const page = await context.newPage();
            page.on('pageerror', (error) => errors.push(`${theme}: ${error.stack ?? error.message}`));
            let signedIn = false;
            for (const target of pages) {
                if (target.signedIn !== false && !signedIn) {
                    await signIn(page);
                    signedIn = true;
                }
                await open(page, target);
                assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark', `${target.path} is not in the ${theme} theme`);
                const { violations, incomplete } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
                results.push({
                    page: target.name, path: target.path, theme,
                    violations: violations.map((violation) => ({
                        id: violation.id, impact: violation.impact, help: violation.help, helpUrl: violation.helpUrl,
                        nodes: violation.nodes.map((node) => ({ target: node.target.join(' '), html: node.html.slice(0, 300), summary: node.failureSummary })),
                    })),
                    incomplete: incomplete.map((check) => ({ id: check.id, impact: check.impact, help: check.help, nodes: check.nodes.length })),
                });
                await page.screenshot({ path: `${process.env.OUT_DIR}/a11y-${theme}-${target.path.slice(1).replaceAll('/', '-')}${target.openStatement ? '-statement' : ''}.png` });
            }
            await context.close();
        }

        writeFileSync(`${process.env.OUT_DIR}/a11y.json`, JSON.stringify(results, null, 2));
        const rules = new Map();
        for (const result of results) {
            for (const violation of result.violations) {
                const rule = rules.get(violation.id) ?? { ...violation, count: 0, where: new Set() };
                rule.count += violation.nodes.length;
                rule.where.add(`${result.page} (${result.theme === 'dark' ? 'داكن' : 'فاتح'})`);
                rules.set(violation.id, rule);
            }
        }
        const undecided = new Map();
        for (const result of results) {
            for (const check of result.incomplete) {
                undecided.set(check.id, { help: check.help, count: (undecided.get(check.id)?.count ?? 0) + check.nodes });
            }
        }
        const sorted = [...rules.values()].sort((a, b) => impactOrder.indexOf(a.impact) - impactOrder.indexOf(b.impact) || b.count - a.count);
        const summary = [
            '# فحص سهولة الوصول (axe، WCAG 2.1 A/AA)',
            '',
            `${pages.length} صفحة × وضعان. ${sorted.length} قاعدة مخالَفة، ${sorted.reduce((total, rule) => total + rule.count, 0)} عنصرًا.`,
            '',
            '| القاعدة | الأثر | العناصر | الوصف | الصفحات |',
            '|---|---|---|---|---|',
            ...sorted.map((rule) => `| \`${rule.id}\` | ${rule.impact} | ${rule.count} | ${rule.help} | ${[...rule.where].join('، ')} |`),
            '',
            'ما لم يستطع axe الحكم عليه (يحتاج فحصًا يدويًا، غالبًا التباين فوق الزجاج والتدرّج):',
            '',
            '| القاعدة | العناصر | الوصف |',
            '|---|---|---|',
            ...[...undecided].sort((a, b) => b[1].count - a[1].count).map(([id, check]) => `| \`${id}\` | ${check.count} | ${check.help} |`),
        ].join('\n');
        writeFileSync(`${process.env.OUT_DIR}/a11y-summary.md`, `${summary}\n`);
        console.log(summary);

        assert.deepEqual(errors, []);
        console.log('PASS: every main page opened in light and dark and was scanned; findings are recorded, not enforced.');
    } catch (error) {
        console.error(error.stack ?? error.message);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
