import { test, expect } from "@playwright/test";

test("screenshot dashboard after login", async ({ page }) => {
  page.on("request", req => console.log(">> REQUEST:", req.url()));
  page.on("response", res => console.log("<< RESPONSE:", res.url(), res.status()));
  
  await page.goto("/auth/login");
  await page.evaluate(() => {
    sessionStorage.setItem(
      "dev_user",
      JSON.stringify({ id: "dev-user-001", email: "dev@localhost", name: "Dev User" })
    );
  });
  await page.goto("/dashboard");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/srv/monorepo/apps/web/e2e/screenshots/dashboard-smoke.png", fullPage: true });
});
