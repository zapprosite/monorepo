import { test, expect } from "@playwright/test";
import * as path from "node:path";

test.describe("Smoke: Login → Dashboard", () => {
	test("dev login without human interaction", async ({ page }) => {
		// Intercept tRPC batch requests and mock a successful dashboard response.
		// The web app uses httpBatchLink (instead of httpBatchStreamLink) when
		// navigator.webdriver is true, which lets us mock with a plain JSON array.
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

		// 2. Inject dev user into sessionStorage — the tRPC client reads this
		//    and sends the X-Dev-User header, triggering backend dev auth bypass.
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

		// 6. Assert KPI cards are rendered with mocked data (scope to <main>)
		const main = page.locator("main");
		await expect(main.getByText(/Clientes/i)).toBeVisible();
		await expect(main.getByText(/Leads/i)).toBeVisible();
		await expect(main.getByText(/42/)).toBeVisible();

		// 7. Screenshot for evidence
		await page.screenshot({
			path: "/srv/monorepo/apps/web/e2e/screenshots/dashboard-smoke.png",
			fullPage: true,
		});
	});
});
