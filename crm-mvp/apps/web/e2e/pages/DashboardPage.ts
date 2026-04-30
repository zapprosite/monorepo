import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly sidebar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Dashboard' });
    this.subtitle = page.getByText('Visão geral do seu negócio');
    this.sidebar = page.locator('aside');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.subtitle).toBeVisible();
  }

  async navigateTo(section: string) {
    const link = this.page.getByRole('link', { name: section });
    await link.click();
    await this.page.waitForLoadState('networkidle');
  }

  async logout() {
    await this.page.getByText('Sair').click();
    await this.page.waitForURL('**/auth/login');
  }
}
