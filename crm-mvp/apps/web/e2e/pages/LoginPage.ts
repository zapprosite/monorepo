import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly title: Locator;
  readonly devLoginButton: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByRole('heading', { name: 'CRM MVP' });
    this.devLoginButton = page.getByText('Entrar como Dev');
    this.emailInput = page.locator('input[type="email"]').or(page.locator('input[name="email"]'));
    this.passwordInput = page.locator('input[type="password"]').or(page.locator('input[name="password"]'));
    this.submitButton = page.getByRole('button', { name: /entrar|login/i });
  }

  async goto() {
    await this.page.goto('/auth/login');
    await this.page.waitForLoadState('networkidle');
  }

  async loginAsDev() {
    await this.devLoginButton.click();
    await this.page.waitForURL('**/dashboard');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectLoggedOut() {
    await expect(this.page.getByText('Login de desenvolvimento')).toBeVisible();
  }
}
