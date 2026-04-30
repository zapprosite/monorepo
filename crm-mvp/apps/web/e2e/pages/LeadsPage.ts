import { Page, Locator, expect } from '@playwright/test';

export class LeadsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Leads' });
    this.addButton = page.getByRole('button', { name: /novo lead|adicionar/i });
    this.searchInput = page.locator('input[placeholder*="Buscar"]');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.page.getByText('Pipeline comercial')).toBeVisible();
  }

  async addLead(data: { name: string; email: string; phone: string; source?: string }) {
    await this.addButton.click();
    await this.page.waitForTimeout(500);
    
    await this.page.locator('[name="name"]').fill(data.name);
    await this.page.locator('[name="email"]').fill(data.email);
    await this.page.locator('[name="phone"]').fill(data.phone);
    if (data.source) {
      await this.page.locator('[name="source"]').fill(data.source);
    }
    
    await this.page.getByRole('button', { name: /salvar|criar/i }).click({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async searchLead(name: string) {
    await this.searchInput.fill(name);
    await this.page.waitForTimeout(800);
  }

  async deleteLead(name: string) {
    const row = this.page.locator('tr', { hasText: name });
    await row.getByRole('button', { name: /excluir|deletar/i }).click();
    await this.page.getByRole('button', { name: /confirmar|sim/i }).click();
    await this.page.waitForTimeout(1000);
  }

  async editLead(name: string, newData: { name?: string; email?: string }) {
    const row = this.page.locator('tr', { hasText: name });
    await row.getByRole('button', { name: /editar/i }).click();
    await this.page.waitForTimeout(500);
    
    if (newData.name) {
      await this.page.locator('[name="name"]').fill(newData.name);
    }
    if (newData.email) {
      await this.page.locator('[name="email"]').fill(newData.email);
    }
    
    await this.page.getByRole('button', { name: /salvar|atualizar/i }).click({ force: true });
    await this.page.waitForTimeout(1000);
  }
}
