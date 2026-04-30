import { test, expect } from "@playwright/test";

test.describe("Smoke: Login → Dashboard", () => {
	test("dev login without human interaction", async ({ page }) => {
		// Intercept tRPC batch requests and return a standard JSON array response.
		await page.route("http://localhost:4001/trpc/**", async (route) => {
			const url = route.request().url();
			if (url.includes("dashboard.getStats")) {
				route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify([
						{
							result: {
								data: {
									kpis: {
										totalClients: 42,
										totalLeads: 15,
										activeContracts: 8,
										pendingReminders: 3,
										todaySchedules: 5,
										openServiceOrders: 2,
									},
									recentContracts: [],
									upcomingSchedules: [],
									pendingRemindersList: [],
								},
							},
						},
					]),
				});
			} else {
				route.continue();
			}
		});

		// 1. Go to login page
		await page.goto("/auth/login");

		// 2. Inject dev user into sessionStorage (trpc client sends X-Dev-User header)
		await page.evaluate(() => {
			sessionStorage.setItem(
				"dev_user",
				JSON.stringify({
					id: "dev-user-001",
					email: "test@example.com",
					name: "Test User",
				}),
			);
		});

		// 3. Navigate to dashboard
		await page.goto("/dashboard");

		// 4. Wait for dashboard title (h1) to be visible
		await expect(page.locator("h1", { hasText: /Dashboard/i })).toBeVisible();

		// 5. Assert no error alert is visible
		await expect(page.getByText(/Erro ao carregar dashboard/i)).not.toBeVisible();

		// 6. Assert KPI cards are rendered with mocked data
		await expect(page.getByText(/Clientes/i)).toBeVisible();
		await expect(page.getByText(/Leads/i)).toBeVisible();
		await expect(page.getByText(/42/)).toBeVisible();

		// 7. Screenshot for evidence
		await page.screenshot({ path: "e2e/screenshots/dashboard-smoke.png", fullPage: true });
	});
});
