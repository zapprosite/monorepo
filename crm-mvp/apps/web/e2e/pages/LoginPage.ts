import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly title: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByRole('heading', { name: 'JS Climatização' });
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.getByRole('button', { name: 'Entrar' });
  }

  async goto() {
    await this.page.goto('/auth/login');
    await this.page.waitForSelector('input[type="email"]');
  }

  async loginAsAdmin() {
    await this.emailInput.fill('zappro.ia@gmail.com');
    await this.passwordInput.fill('Fifine156458*');
    await this.submitButton.click();
    await this.page.waitForURL('**/dashboard');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectLoggedOut() {
    await expect(this.page.getByText('Acesso ao Sistema')).toBeVisible();
  }
}
