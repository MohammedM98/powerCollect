const { chromium, expect: browserExpect } = require('playwright/test');
const assert = require('node:assert/strict');
const expect = browserExpect.configure({ timeout: 15_000 });

// Signing in and out as a person does, and what a signed-in person without permission sees.
(async () => {
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    const context = await browser.newContext({ baseURL: process.env.BASE_URL, viewport: { width: 1440, height: 900 }, locale: 'ar' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
    const signIn = async (username, password) => {
        await page.locator('#username').fill(username);
        await page.locator('#password').fill(password);
        await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
    };
    try {
        await page.goto('/subscriptions');
        await expect(page).toHaveURL(/\/login$/);
        console.log('✓ a visitor opening a page is sent to the sign-in page');

        await signIn('owner', 'wrong-password');
        await expect(page.getByText('بيانات الدخول هذه غير متطابقة مع سجلاتنا.').first()).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
        console.log('✓ a wrong password is refused with the Arabic message');

        await signIn('stopped_user', 'Strong-Pass-2026');
        await expect(page.getByText('تم إيقاف هذا الحساب. تواصل مع المدير لإعادة تفعيله.').first()).toBeVisible();
        await expect(page).toHaveURL(/\/login$/);
        console.log('✓ a stopped account is told so, even with the right password');

        await signIn('no_access', 'Strong-Pass-2026');
        await page.waitForURL((url) => !url.pathname.startsWith('/login'));
        const refused = await page.goto('/users');
        assert.equal(refused.status(), 403);
        await expect(page.getByRole('status').filter({ hasText: 'هذه الصفحة غير متاحة لحسابك' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'العودة إلى لوحة التحكم' })).toHaveAttribute('href', /\/dashboard$/);
        await page.screenshot({ path: `${process.env.OUT_DIR}/access-refused.png`, fullPage: true });
        console.log('✓ a member of staff without permission sees the quiet refusal with the way back');

        await page.goto('/dashboard');
        await page.getByRole('button', { name: 'خارج النظام' }).first().click();
        await expect(page).toHaveURL(/\/login$/);
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login$/);
        console.log('✓ signing out ends the session');

        assert.deepEqual(errors, []);
        console.log('PASS: visitor redirect, wrong password, stopped account, refused page and sign-out.');
    } catch (error) {
        await page.screenshot({ path: `${process.env.OUT_DIR}/access-failure.png`, fullPage: true }).catch(() => {});
        throw error;
    } finally {
        await browser.close();
    }
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
