import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Perplexity Agent E2E
 * Run: npx playwright test --config=e2e/playwright.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4004',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'docker ps | grep perplexity || echo "Container not running"',
    url: 'http://localhost:4004',
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
