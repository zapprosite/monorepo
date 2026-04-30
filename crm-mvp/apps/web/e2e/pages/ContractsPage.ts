import { Page, Locator, expect } from '@playwright/test';

export class ContractsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Contratos' });
    this.addButton = page.getByRole('button', { name: /novo contrato|adicionar/i });
    this.searchInput = page.locator('input[placeholder*="Buscar"]');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.page.getByText('Gestão de contratos')).toBeVisible();
  }

  async addContract(data: { clientName: string; value: string; startDate: string; endDate: string }) {
    await this.addButton.click();
    await this.page.waitForTimeout(500);
    
    await this.page.locator('[name="clientId"]').fill(data.clientName);
    await this.page.locator('[name="value"]').fill(data.value);
    await this.page.locator('[name="startDate"]').fill(data.startDate);
    await this.page.locator('[name="endDate"]').fill(data.endDate);
    
    await this.page.getByRole('button', { name: /salvar|criar/i }).click({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async searchContract(clientName: string) {
    await this.searchInput.fill(clientName);
    await this.page.waitForTimeout(800);
  }

  async deleteContract(clientName: string) {
    const row = this.page.locator('tr', { hasText: clientName });
    await row.getByRole('button', { name: /excluir|deletar/i }).click();
    await this.page.getByRole('button', { name: /confirmar|sim/i }).click();
    await this.page.waitForTimeout(1000);
  }
}
