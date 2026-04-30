import { test, expect } from '@playwright/test';

test.describe('Autenticação - Validações', () => {
  test('deve permitir acesso ao login sem autenticação', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByText('Login de desenvolvimento')).toBeVisible();
  });

  test('deve redirecionar após logout', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByText('Entrar como Dev').click();
    await page.waitForURL('**/dashboard');
    
    await page.getByText('Sair').click();
    await page.waitForURL('**/auth/login');
    await expect(page.getByText('Login de desenvolvimento')).toBeVisible();
  });
});
