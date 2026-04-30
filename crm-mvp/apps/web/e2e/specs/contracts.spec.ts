import { test, expect } from '../fixtures/auth';
import { ContractsPage } from '../pages/ContractsPage';

test.describe('Contratos - Página', () => {
  test('deve carregar página de contratos com elementos principais', async ({ page }) => {
    const contractsPage = new ContractsPage(page);
    await page.goto('/contracts');
    await contractsPage.expectLoaded();
    await expect(contractsPage.addButton).toBeVisible();
  });

  test('deve abrir modal de adicionar contrato', async ({ page }) => {
    const contractsPage = new ContractsPage(page);
    await page.goto('/contracts');
    await contractsPage.expectLoaded();
    
    await contractsPage.addButton.click();
    await page.waitForTimeout(500);
    
    await expect(page.locator('[name="clientId"]')).toBeVisible();
    await expect(page.locator('[name="value"]')).toBeVisible();
  });
});
