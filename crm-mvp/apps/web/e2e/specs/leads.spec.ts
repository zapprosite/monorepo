import { test, expect } from '../fixtures/auth';
import { LeadsPage } from '../pages/LeadsPage';

test.describe('Leads - Página', () => {
  test('deve carregar página de leads com elementos principais', async ({ page, authenticatedPage }) => {
    const leadsPage = new LeadsPage(page);
    await page.goto('/leads');
    await leadsPage.expectLoaded();
    await expect(leadsPage.addButton).toBeVisible();
    await expect(leadsPage.searchInput).toBeVisible();
  });

  test('deve abrir modal de adicionar lead', async ({ page, authenticatedPage }) => {
    const leadsPage = new LeadsPage(page);
    await page.goto('/leads');
    await leadsPage.expectLoaded();
    
    await leadsPage.addButton.click();
    await page.waitForTimeout(500);
    
    // Modal aberto - campo nome visível
    await expect(page.locator('[name="name"]')).toBeVisible();
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[name="phone"]')).toBeVisible();
  });
});
