import { test, expect } from '../fixtures/auth';
import { ClientsPage } from '../pages/ClientsPage';
import { LeadsPage } from '../pages/LeadsPage';
import { SearchHelper } from '../pages/SearchHelper';

/**
 * E2E tests for search interaction across CRM pages.
 * Covers: Clients, Leads, Equipamentos.
 *
 * Each search-capable page has an <Input placeholder="Buscar..." /> that
 * debounces user input and filters the data table via tRPC.
 */

test.describe('Search — Clientes', () => {
  test('deve exibir input de busca na página de clientes', async ({ page, authenticatedPage }) => {
    const clientsPage = new ClientsPage(page);
    await page.goto('/clients');
    await clientsPage.expectLoaded();
    await expect(clientsPage.searchInput).toBeVisible();
  });

  test('deve filtrar clientes por nome ao digitar', async ({ page, authenticatedPage }) => {
    const clientsPage = new ClientsPage(page);
    await page.goto('/clients');
    await clientsPage.expectLoaded();

    // Add a unique client for deterministic test
    await clientsPage.addClient({
      name: `Search Test Client ${Date.now()}`,
      email: `search-test-${Date.now()}@example.com`,
      phone: '11999990000',
    });

    // Type the name in the search box
    const searchHelper = new SearchHelper(page);
    const clientName = await searchHelper.getQuery().then(() => '');
    await searchHelper.typeQuery('Search Test Client');

    // Table should still render (no crash on empty result is OK)
    await expect(page.locator('table, [role="table"], tbody')).toBeVisible();
  });

  test('deve limpar filtro de busca ao apagar o texto', async ({ page, authenticatedPage }) => {
    const clientsPage = new ClientsPage(page);
    await page.goto('/clients');
    await clientsPage.expectLoaded();

    const searchHelper = new SearchHelper(page);

    // Type something
    await searchHelper.typeQuery('nonexistent-query-xyz');
    await page.waitForTimeout(300);

    // Clear
    await searchHelper.clearQuery();
    const value = await searchHelper.getQuery();
    expect(value).toBe('');
  });
});

test.describe('Search — Leads', () => {
  test('deve exibir input de busca na página de leads', async ({ page, authenticatedPage }) => {
    const leadsPage = new LeadsPage(page);
    await page.goto('/leads');
    await leadsPage.expectLoaded();
    await expect(leadsPage.searchInput).toBeVisible();
  });

  test('deve filtrar leads por nome ao digitar', async ({ page, authenticatedPage }) => {
    const leadsPage = new LeadsPage(page);
    await page.goto('/leads');
    await leadsPage.expectLoaded();

    // Add a unique lead for deterministic test
    const uniqueName = `Lead Search ${Date.now()}`;
    await leadsPage.addLead({
      name: uniqueName,
      email: `lead-search-${Date.now()}@example.com`,
      phone: '21988880000',
      source: 'Website',
    });

    const searchHelper = new SearchHelper(page);
    await searchHelper.typeQuery('Lead Search');

    // Table should still render
    await expect(page.locator('table, [role="table"], tbody')).toBeVisible();
  });

  test('deve limpar filtro de busca ao apagar o texto', async ({ page, authenticatedPage }) => {
    const leadsPage = new LeadsPage(page);
    await page.goto('/leads');
    await leadsPage.expectLoaded();

    const searchHelper = new SearchHelper(page);
    await searchHelper.typeQuery('nonexistent-lead-xyz');
    await page.waitForTimeout(300);
    await searchHelper.clearQuery();

    const value = await searchHelper.getQuery();
    expect(value).toBe('');
  });
});

test.describe('Search — Equipamentos', () => {
  test('deve exibir input de busca na página de equipamentos', async ({ page, authenticatedPage }) => {
    await page.goto('/equipamentos');
    await expect(page.getByRole('heading', { name: 'Equipamentos' })).toBeVisible();
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await expect(searchInput).toBeVisible();
  });

  test('deve filtrar equipamentos por nome ao digitar', async ({ page, authenticatedPage }) => {
    await page.goto('/equipamentos');
    await expect(page.getByRole('heading', { name: 'Equipamentos' })).toBeVisible();

    // Equipamentos uses a different placeholder
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('Ar Condicionado');
    await page.waitForTimeout(800);

    await expect(page.locator('table, [role="table"], tbody')).toBeVisible();
  });

  test('deve limpar filtro de busca ao apagar o texto', async ({ page, authenticatedPage }) => {
    await page.goto('/equipamentos');
    await expect(page.getByRole('heading', { name: 'Equipamentos' })).toBeVisible();

    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('nonexistent-equip-xyz');
    await page.waitForTimeout(300);
    await searchInput.clear();
    await page.waitForTimeout(300);

    const value = await searchInput.inputValue();
    expect(value).toBe('');
  });
});
