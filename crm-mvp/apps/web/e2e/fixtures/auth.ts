import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

export type AuthFixture = {
  authenticatedPage: LoginPage;
};

export const test = base.extend<AuthFixture>({
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsDev();
    await use(loginPage);
  },
});

export { expect } from '@playwright/test';
