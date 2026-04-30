import { test, expect } from '../fixtures/auth';
import { SchedulePage } from '../pages/SchedulePage';

test.describe('Agenda - Página', () => {
  test('deve carregar página de agenda com elementos principais', async ({ page }) => {
    const schedulePage = new SchedulePage(page);
    await page.goto('/schedule');
    await schedulePage.expectLoaded();
    await expect(schedulePage.addButton).toBeVisible();
  });

  test('deve abrir modal de adicionar agendamento', async ({ page }) => {
    const schedulePage = new SchedulePage(page);
    await page.goto('/schedule');
    await schedulePage.expectLoaded();
    
    await schedulePage.addButton.click();
    await page.waitForTimeout(500);
    
    await expect(page.locator('[name="clientId"]')).toBeVisible();
    await expect(page.locator('[name="dateTime"]')).toBeVisible();
  });
});
