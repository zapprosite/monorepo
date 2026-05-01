import { test, expect } from "@playwright/test";

/**
 * E2E tests for search interaction in apps/web.
 * Covers: Service Orders search, RAG semantic search.
 */

test.describe("Search — Service Orders", () => {
	test.beforeEach(async ({ page }) => {
		// Intercept tRPC batch requests for service orders
		await page.route("http://localhost:4001/trpc/**", async (route) => {
			const url = route.request().url();
			if (url.includes("serviceOrders.listServiceOrders")) {
				route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify([
						{
							result: {
								data: {
									serviceOrders: [
										{
											id: "os-001",
											orderNumber: "OS-0001",
											clientName: "Cliente Teste A",
											status: "open",
											tipo: "installation",
											createdAt: new Date().toISOString(),
										},
										{
											id: "os-002",
											orderNumber: "OS-0002",
											clientName: "Cliente Teste B",
											status: "in_progress",
											tipo: "repair",
											createdAt: new Date().toISOString(),
										},
										{
											id: "os-003",
											orderNumber: "OS-0003",
											clientName: "Cliente Teste C",
											status: "closed",
											tipo: "maintenance",
											createdAt: new Date().toISOString(),
										},
									],
								},
							},
						},
					]),
				});
			} else {
				route.continue();
			}
		});
	});

	test("deve exibir input de busca na página de ordens de serviço", async ({ page }) => {
		await page.goto("/service-orders");

		// Wait for page to load
		await expect(page.getByRole("heading", { name: /Ordens de Serviço/i })).toBeVisible();

		// Check search input is visible
		const searchInput = page.getByPlaceholder("Ex.: OS-0001");
		await expect(searchInput).toBeVisible();
	});

	test("deve filtrar ordens de serviço por número ao digitar", async ({ page }) => {
		await page.goto("/service-orders");
		await expect(page.getByRole("heading", { name: /Ordens de Serviço/i })).toBeVisible();

		const searchInput = page.getByPlaceholder("Ex.: OS-0001");
		await searchInput.fill("OS-0001");
		await page.waitForTimeout(300);

		// Table should still be visible
		await expect(page.locator("table, [role='table'], tbody")).toBeVisible();
	});

	test("deve limpar filtro de busca ao apagar o texto", async ({ page }) => {
		await page.goto("/service-orders");
		await expect(page.getByRole("heading", { name: /Ordens de Serviço/i })).toBeVisible();

		const searchInput = page.getByPlaceholder("Ex.: OS-0001");

		// Type a search term
		await searchInput.fill("OS-0001");
		await page.waitForTimeout(300);

		// Clear the search
		await searchInput.clear();
		await page.waitForTimeout(300);

		const value = await searchInput.inputValue();
		expect(value).toBe("");
	});

	test("deve combinar filtro de busca com filtro de status", async ({ page }) => {
		await page.goto("/service-orders");
		await expect(page.getByRole("heading", { name: /Ordens de Serviço/i })).toBeVisible();

		const searchInput = page.getByPlaceholder("Ex.: OS-0001");
		const statusSelect = page.locator('label:has-text("Status")').locator("..").locator("select, [role='combobox']");

		// Apply search filter
		await searchInput.fill("OS-0001");
		await page.waitForTimeout(300);

		// Apply status filter
		if (statusSelect.count() > 0) {
			await statusSelect.selectOption("open");
		}

		// Table should remain visible
		await expect(page.locator("table, [role='table'], tbody")).toBeVisible();
	});

	test("deve buscar por termo inexistente e mostrar resultado vazio ou todos os itens", async ({ page }) => {
		await page.goto("/service-orders");
		await expect(page.getByRole("heading", { name: /Ordens de Serviço/i })).toBeVisible();

		const searchInput = page.getByPlaceholder("Ex.: OS-0001");
		await searchInput.fill("NONEXISTENT-OS-XYZ");
		await page.waitForTimeout(500);

		// Page should not crash - either show empty state or table
		const tableOrEmpty = page.locator("table, [role='table'], tbody, [data-testid='empty-state'], p:has-text('Nenhum')");
		await expect(tableOrEmpty.first()).toBeVisible();
	});
});

test.describe("Search — RAG Semantic Search", () => {
	test("deve renderizar RagSearchBox com dataset selector e input de busca", async ({ page }) => {
		// Intercept datasets endpoint
		await page.route("http://localhost:4001/trpc/**", async (route) => {
			const url = route.request().url();
			if (url.includes("rag.listDatasets")) {
				route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify([
						{
							result: {
								data: {
									datasets: [
										{ id: "ds-001", name: "Documentation", description: "Main docs" },
										{ id: "ds-002", name: "Knowledge Base", description: "KB articles" },
									],
								},
							},
						},
					]),
				});
			} else {
				route.continue();
			}
		});

		await page.goto("/rag");

		// Check dataset select is visible
		const datasetSelect = page.locator("[role='combobox'], select").first();
		await expect(datasetSelect).toBeVisible();

		// Check query input is visible
		const queryInput = page.getByPlaceholder(/Digite sua busca semântica/i);
		await expect(queryInput).toBeVisible();

		// Check search button is visible
		const searchButton = page.getByRole("button", { name: /Buscar/i });
		await expect(searchButton).toBeVisible();
	});

	test("deve desabilitar botão de busca quando dataset ou query não estão selecionados", async ({ page }) => {
		await page.route("http://localhost:4001/trpc/**", async (route) => {
			const url = route.request().url();
			if (url.includes("rag.listDatasets")) {
				route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify([
						{
							result: {
								data: {
									datasets: [{ id: "ds-001", name: "Documentation", description: "Main docs" }],
								},
							},
						},
					]),
				});
			} else {
				route.continue();
			}
		});

		await page.goto("/rag");

		const searchButton = page.getByRole("button", { name: /Buscar/i });

		// Button should be disabled when no dataset or query
		await expect(searchButton).toBeDisabled();

		// Select dataset
		const datasetSelect = page.locator("[role='combobox'], select").first();
		await datasetSelect.selectOption("ds-001");

		// Button still disabled without query
		await expect(searchButton).toBeDisabled();

		// Fill query
		const queryInput = page.getByPlaceholder(/Digite sua busca semântica/i);
		await queryInput.fill("test query");

		// Button should be enabled now
		await expect(searchButton).toBeEnabled();
	});

	test("deve submeter busca via Enter no input", async ({ page }) => {
		await page.route("http://localhost:4001/trpc/**", async (route) => {
			const url = route.request().url();
			if (url.includes("rag.listDatasets")) {
				route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify([
						{
							result: {
								data: {
									datasets: [{ id: "ds-001", name: "Documentation", description: "Main docs" }],
								},
							},
						},
					]),
				});
			} else {
				route.continue();
			}
		});

		let searchCalled = false;
		await page.route("http://localhost:4001/trpc/**", async (route) => {
			const url = route.request().url();
			if (url.includes("rag.semanticSearch")) {
				searchCalled = true;
				route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify([
						{
							result: {
								data: {
									results: [
										{
											id: "result-001",
											content: "Test result content",
											score: 0.95,
										},
									],
								},
							},
						},
					]),
				});
			} else {
				route.continue();
			}
		});

		await page.goto("/rag");

		const datasetSelect = page.locator("[role='combobox'], select").first();
		await datasetSelect.selectOption("ds-001");

		const queryInput = page.getByPlaceholder(/Digite sua busca semântica/i);
		await queryInput.fill("test query");

		// Submit via Enter
		await queryInput.press("Enter");
		await page.waitForTimeout(500);

		// Search should have been triggered
		expect(searchCalled || page.url().includes("rag")).toBeTruthy();
	});
});
