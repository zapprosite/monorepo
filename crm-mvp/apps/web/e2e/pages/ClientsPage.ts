import { Page, Locator, expect } from '@playwright/test';

export class ClientsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Clientes' });
    this.addButton = page.getByRole('button', { name: /novo cliente|adicionar/i });
    this.searchInput = page.locator('input[placeholder*="Buscar"]');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.page.getByText('Base de clientes')).toBeVisible();
  }

  async addClient(data: { name: string; email: string; phone: string; document?: string }) {
    await this.addButton.click();
    await this.page.waitForTimeout(500);
    
    await this.page.locator('[name="name"]').fill(data.name);
    await this.page.locator('[name="email"]').fill(data.email);
    await this.page.locator('[name="phone"]').fill(data.phone);
    if (data.document) {
      await this.page.locator('[name="document"]').fill(data.document);
    }
    
    await this.page.getByRole('button', { name: /salvar|criar/i }).click({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async searchClient(name: string) {
    await this.searchInput.fill(name);
    await this.page.waitForTimeout(800);
  }

  async deleteClient(name: string) {
    const row = this.page.locator('tr', { hasText: name });
    await row.getByRole('button', { name: /excluir|deletar/i }).click();
    await this.page.getByRole('button', { name: /confirmar|sim/i }).click();
    await this.page.waitForTimeout(1000);
  }
}
