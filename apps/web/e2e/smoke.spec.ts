import { test, expect } from "@playwright/test";

test.describe("Smoke: Login → Dashboard", () => {
	test("dev login without human interaction", async ({ page }) => {
		// 1. Go to login page
		await page.goto("/auth/login");

		// 2. Inject dev user into sessionStorage (simulates successful dev login)
		await page.evaluate(() => {
			sessionStorage.setItem(
				"dev_user",
				JSON.stringify({
					id: "dev-user-001",
					email: "dev@localhost",
					name: "Dev User",
				}),
			);
		});

		// 3. Navigate to dashboard
		await page.goto("/dashboard");

		// 4. Assert dashboard loaded
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.getByText(/Dashboard/i)).toBeVisible();
	});
});
