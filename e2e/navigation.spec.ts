import { test, expect } from "@playwright/test";

test.describe("navigation", () => {
  test("unauthenticated visitor to / is redirected to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("policy pages render for anyone", async ({ page }) => {
    for (const path of ["/about", "/rules", "/privacy"]) {
      await page.goto(path);
      await expect(page.locator("main, body").first()).not.toBeEmpty();
    }
  });

  test("popular requires login", async ({ page }) => {
    await page.goto("/popular");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("archive requires login", async ({ page }) => {
    await page.goto("/archive");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
