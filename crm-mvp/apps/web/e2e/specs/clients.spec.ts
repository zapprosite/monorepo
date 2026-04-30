import { test, expect } from '../fixtures/auth';
import { ClientsPage } from '../pages/ClientsPage';

test.describe('Clientes - Página', () => {
  test('deve carregar página de clientes com elementos principais', async ({ page }) => {
    const clientsPage = new ClientsPage(page);
    await page.goto('/clients');
    await clientsPage.expectLoaded();
    await expect(clientsPage.addButton).toBeVisible();
    await expect(clientsPage.searchInput).toBeVisible();
  });

  test('deve abrir modal de adicionar cliente', async ({ page }) => {
    const clientsPage = new ClientsPage(page);
    await page.goto('/clients');
    await clientsPage.expectLoaded();
    
    await clientsPage.addButton.click();
    await page.waitForTimeout(500);
    
    await expect(page.locator('[name="name"]')).toBeVisible();
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[name="phone"]')).toBeVisible();
  });
});
