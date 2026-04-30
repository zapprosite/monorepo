import { Page, Locator, expect } from '@playwright/test';

export class SchedulePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Agenda' });
    this.addButton = page.getByRole('button', { name: /novo agendamento|adicionar/i });
    this.searchInput = page.locator('input[placeholder*="Buscar"]');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.page.getByText('Agendamentos de serviços')).toBeVisible();
  }

  async addSchedule(data: { title: string; clientName: string; dateTime: string }) {
    await this.addButton.click();
    await this.page.waitForTimeout(500);
    
    await this.page.locator('[name="clientId"]').fill(data.clientName);
    await this.page.locator('[name="dateTime"]').fill(data.dateTime);
    
    await this.page.getByRole('button', { name: /salvar|criar/i }).click({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async searchSchedule(title: string) {
    await this.searchInput.fill(title);
    await this.page.waitForTimeout(800);
  }

  async deleteSchedule(title: string) {
    const row = this.page.locator('tr', { hasText: title });
    await row.getByRole('button', { name: /excluir|deletar/i }).click();
    await this.page.getByRole('button', { name: /confirmar|sim/i }).click();
    await this.page.waitForTimeout(1000);
  }
}
