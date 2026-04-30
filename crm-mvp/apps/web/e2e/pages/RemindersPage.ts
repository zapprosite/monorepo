import { Page, Locator, expect } from '@playwright/test';

export class RemindersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Lembretes' });
    this.addButton = page.getByRole('button', { name: /novo lembrete|adicionar/i });
    this.searchInput = page.locator('input[placeholder*="Buscar"]');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.page.getByText('Follow-ups e tarefas')).toBeVisible();
  }

  async addReminder(data: { title: string; clientName: string; dueDate: string }) {
    await this.addButton.click();
    await this.page.waitForTimeout(500);
    
    await this.page.locator('[name="clientId"]').fill(data.clientName);
    await this.page.locator('[name="title"]').fill(data.title);
    await this.page.locator('[name="dueDate"]').fill(data.dueDate);
    
    await this.page.getByRole('button', { name: /salvar|criar/i }).click({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async searchReminder(title: string) {
    await this.searchInput.fill(title);
    await this.page.waitForTimeout(800);
  }

  async deleteReminder(title: string) {
    const row = this.page.locator('tr', { hasText: title });
    await row.getByRole('button', { name: /excluir|deletar/i }).click();
    await this.page.getByRole('button', { name: /confirmar|sim/i }).click();
    await this.page.waitForTimeout(1000);
  }

  async markAsDone(title: string) {
    const row = this.page.locator('tr', { hasText: title });
    await row.locator('input[type="checkbox"]').click();
    await this.page.waitForTimeout(500);
  }
}
