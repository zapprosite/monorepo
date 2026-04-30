import { test, expect } from '../fixtures/auth';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';

test.describe('Smoke Test - Navegação Principal', () => {
  test('login dev → dashboard → navegação completa → logout', async ({ page, authenticatedPage }) => {
    const dashboard = new DashboardPage(page);
    
    // 2. Dashboard carrega
    await dashboard.expectLoaded();
    await expect(page.getByText('Total Clientes')).toBeVisible();

    // 3. Navegação para Leads
    await dashboard.navigateTo('Leads');
    await expect(page.getByText('Pipeline comercial')).toBeVisible();

    // 4. Navegação para Clientes
    await dashboard.navigateTo('Clientes');
    await expect(page.getByText('Base de clientes')).toBeVisible();

    // 5. Navegação para Agenda
    await dashboard.navigateTo('Agenda');
    await expect(page.getByText('Agendamentos de serviços')).toBeVisible();

    // 6. Navegação para Contratos
    await dashboard.navigateTo('Contratos');
    await expect(page.getByText('Gestão de contratos')).toBeVisible();

    // 7. Navegação para Lembretes
    await dashboard.navigateTo('Lembretes');
    await expect(page.getByText('Follow-ups e tarefas')).toBeVisible();

    // 8. Logout
    await dashboard.logout();
    const loginPage = new LoginPage(page);
    await loginPage.expectLoggedOut();
  });
});
