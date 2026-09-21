import { test, expect } from "@playwright/test";
import { registerViaUi, uniqueUser } from "./helpers";

test.describe("moderation gating", () => {
  test("regular user sees permission denied on /moderation", async ({ page }) => {
    const user = uniqueUser();
    await registerViaUi(page, user);
    await page.goto("/moderation");
    await expect(page.getByText("permission", { exact: false })).toBeVisible();
    await expect(page.getByText("Approve")).toHaveCount(0);
  });

  test("regular user sees permission denied on /admin", async ({ page }) => {
    const user = uniqueUser();
    await registerViaUi(page, user);
    await page.goto("/admin");
    await expect(page.getByText("permission", { exact: false })).toBeVisible();
  });

  test("reporting a confession succeeds", async ({ page }) => {
    const user = uniqueUser();
    await registerViaUi(page, user);
    await page.goto("/");
    const reportTrigger = page.getByRole("button", { name: "Report" }).first();
    const anyCard = await page.getByText("relative", { exact: false }).count();
    test.skip(anyCard === 0, "no confessions visible in feed to report");
    await reportTrigger.click();
    await page.getByRole("button", { name: /Spam/ }).click();
    await page.getByRole("button", { name: /Send|Submit/i }).click();
    await expect(page.getByText("Report received")).toBeVisible();
  });
});
