import { test, expect } from '@playwright/test';

/**
 * Perplexity Agent E2E Tests
 * Run: npx playwright test e2e/perplexity.spec.ts
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:4004';

test.describe('Perplexity Agent', () => {

  test('TC-01: Health endpoint returns 200 with ok body', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/_stcore/health`);
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('ok');
  });

  test('TC-02: UI loads and renders without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // Check Streamlit content
    const content = await page.content();
    expect(content).toContain('Streamlit');

    // Check no JS runtime errors
    expect(errors).toHaveLength(0);
  });

});
