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
    const feed = await page.request.get("/api/confessions?limit=1");
    const data = (await feed.json()) as {
      confessions: { id: string }[];
    };
    test.skip(data.confessions.length === 0, "no approved confession seeded");
    await page.goto(`/post/${data.confessions[0].id}`);
    await page.getByRole("button", { name: "Report" }).click();
    await page.getByRole("button", { name: /Spam/ }).click();
    await page.getByRole("button", { name: /Send|Submit/i }).click();
    await expect(page.getByText("Report received")).toBeVisible();
  });
});
