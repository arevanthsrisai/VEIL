import { test, expect } from "@playwright/test";
import { registerViaApi, uniqueUser } from "./helpers";

test.describe("reactions", () => {
  test("reactions toggle on approved confessions", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const feed = await page.request.get("/api/confessions?limit=1");
    const data = (await feed.json()) as {
      confessions: { id: string }[];
    };
    test.skip(data.confessions.length === 0, "no approved confession seeded");
    const id = data.confessions[0].id;

    await page.goto(`/post/${id}`);
    const fire = page.getByRole("button", { name: "Fire reaction" });
    await fire.click();
    await expect(fire).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
    await fire.click();
    await expect(fire).toHaveAttribute("aria-pressed", "false", { timeout: 10_000 });
  });
});
