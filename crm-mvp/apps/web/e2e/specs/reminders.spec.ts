import { test, expect } from '../fixtures/auth';
import { RemindersPage } from '../pages/RemindersPage';

test.describe('Lembretes - Página', () => {
  test('deve carregar página de lembretes com elementos principais', async ({ page }) => {
    const remindersPage = new RemindersPage(page);
    await page.goto('/reminders');
    await remindersPage.expectLoaded();
    await expect(remindersPage.addButton).toBeVisible();
  });

  test('deve abrir modal de adicionar lembrete', async ({ page }) => {
    const remindersPage = new RemindersPage(page);
    await page.goto('/reminders');
    await remindersPage.expectLoaded();
    
    await remindersPage.addButton.click();
    await page.waitForTimeout(500);
    
    await expect(page.locator('[name="title"]')).toBeVisible();
    await expect(page.locator('[name="dueDate"]')).toBeVisible();
  });
});
