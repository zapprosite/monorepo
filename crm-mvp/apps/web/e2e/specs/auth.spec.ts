import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('Autenticação - Validações', () => {
  test('deve permitir acesso ao login sem autenticação', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(page.getByText('Acesso ao Sistema')).toBeVisible();
  });

  test('deve redirecionar após logout', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();
    await page.waitForURL('**/dashboard');
    
    await page.getByText('Sair').click();
    await page.waitForURL('**/auth/login');
    await expect(page.getByText('Acesso ao Sistema')).toBeVisible();
  });
});
