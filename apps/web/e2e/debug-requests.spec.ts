import { test } from "@playwright/test";

test("log all requests", async ({ page }) => {
  page.on("request", req => {
    if (req.url().includes("4001")) {
      console.log(">> REQUEST:", req.method(), req.url());
      console.log("  POST DATA:", req.postData());
      console.log("  HEADERS:", JSON.stringify(req.headers()));
    }
  });
  page.on("response", res => {
    if (res.url().includes("4001")) {
      console.log("<< RESPONSE:", res.status(), res.url());
    }
  });
  
  await page.goto("/auth/login");
  await page.evaluate(() => {
    sessionStorage.setItem("dev_user", JSON.stringify({ id: "dev-user-001", email: "dev@localhost", name: "Dev User" }));
  });
  await page.goto("/dashboard");
  await page.waitForTimeout(3000);
});
