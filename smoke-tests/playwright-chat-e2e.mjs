#!/usr/bin/env node
// E2E Playwright test for chat.zappro.site
// Uses Chrome DevTools Protocol via CDP for existing browser session

import { chromium } from 'playwright';

const site = process.argv[2] || 'chat.zappro.site';
const screenshotPath = `/tmp/e2e-${site.replace('.', '-')}-${Date.now()}.png`;
const DEBUG = process.env.DEBUG === '1';

const CF_AUTH_COOKIE = 'CF_Authorization';
const CF_APP_SESSION_COOKIE = 'CF_AppSession';

console.log(`=== Playwright E2E Test: ${site} ===`);
console.log(`Date: ${new Date().toISOString()}`);

let browser;
try {
    const chromeDebugUrl = process.env.CHROME_DEBUG_URL || 'http://localhost:9222';
    try {
        browser = await chromium.connectOverCDP(chromeDebugUrl);
        console.log('  ✅ Connected to Chrome via CDP');
    } catch {
        console.log('  ⚠️  CDP failed, launching headless browser');
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
    }
} catch (err) {
    console.error('Browser error:', err.message);
    process.exit(1);
}

const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 }
});

const page = await context.newPage();

// Counters instead of unbounded arrays
let reqCount = 0, resCount = 0, res2xx = 0;

page.on('request', req => {
    if (req.url().includes(site) || req.url().includes('cloudflareaccess')) reqCount++;
});

page.on('response', res => {
    if (res.url().includes(site) || res.url().includes('cloudflareaccess')) {
        resCount++;
        if (res.status() >= 200 && res.status() < 300) res2xx++;
    }
});

let exitCode = 0;

try {
    console.log('\n[2] Navigating to site...');
    await page.goto(`https://${site}`, { timeout: 45000, waitUntil: 'domcontentloaded', allowEarlyEvents: true });

    const currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl}`);

    if (currentUrl.includes('cloudflareaccess')) {
        console.log('\n[3] At Cloudflare Access - attempting login...');

        const googleButton = await page.$(
            'button:has-text("Google"), ' +
            '[data-provider="google"], ' +
            '.login-oauth-button, ' +
            'a:has-text("Google"), ' +
            '[class*="google"] button, ' +
            '.cloudflare-oauth button'
        );

        if (googleButton) {
            console.log('  Found Google login button, clicking...');
            await googleButton.click();
            await page.waitForURL(url => !url.includes('cloudflareaccess'), { timeout: 15000 })
                .catch(() => console.log('  ⚠️  Redirect timeout, checking current state'));
            console.log(`  After click: ${page.url()}`);
        } else {
            console.log('  No Google button found');
        }
    }

    const finalUrl = page.url();
    console.log(`\n[4] Final URL: ${finalUrl}`);

    const cookies = await context.cookies();
    const cfAuth = cookies.find(c => c.name === CF_AUTH_COOKIE);
    const cfAppSession = cookies.find(c => c.name === CF_APP_SESSION_COOKIE);

    console.log('\n[5] Session cookies:');
    console.log(`  ${CF_AUTH_COOKIE}: ${cfAuth ? `✅ present (expires: ${new Date(cfAuth.expires * 1000).toISOString()})` : '❌ NOT FOUND'}`);
    console.log(`  ${CF_APP_SESSION_COOKIE}: ${cfAppSession ? '✅ present' : '❌ NOT FOUND'}`);

    console.log('\n=== E2E SUMMARY ===');
    console.log(`Site: ${site}`);
    console.log(`Requests: ${reqCount} | Responses: ${resCount} | 2xx: ${res2xx}`);

    const authenticated = cfAuth || (!finalUrl.includes('cloudflareaccess') && finalUrl.includes(site));

    if (authenticated) {
        console.log('\n✅ E2E RESULT: AUTHENTICATED');
        console.log(`  Page title: ${await page.title()}`);
    } else {
        console.log('\n⚠️  E2E RESULT: NOT AUTHENTICATED (2FA required or session expired)');
        console.log('  Fix: Create Service Token in Cloudflare Zero Trust for CI/CD');
        exitCode = 1;
    }

    if (exitCode !== 0 || DEBUG) {
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`\nScreenshot: ${screenshotPath}`);
    }

} catch (err) {
    console.error('\n❌ Playwright error:', err.message);
    exitCode = 1;
} finally {
    await browser.close();
    process.exit(exitCode);
}
