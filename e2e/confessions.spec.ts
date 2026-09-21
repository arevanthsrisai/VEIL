import { test, expect } from "@playwright/test";
import { registerViaApi, uniqueUser } from "./helpers";

test.describe("confessions", () => {
  test("submitting a confession queues it for moderation", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const content = `E2E confession ${Date.now()} — the library wifi knows my secrets.`;

    await page.goto("/");
    await page.getByRole("button", { name: "New confession" }).click();
    await page.getByLabel("Title (optional)").fill("E2E title");
    await page.getByLabel("Confession").fill(content);
    await page.getByRole("button", { name: "Submit for moderation" }).click();
    await expect(page.getByText("Submitted for moderation")).toBeVisible();
  });

  test("pending confession appears in activity with a pending badge", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const content = `E2E activity confession ${Date.now()}`;
    const created = await page.request.post("/api/confessions", {
      data: { content },
    });
    expect(created.status()).toBe(202);

    await page.goto("/activity");
    await expect(page.getByText(content)).toBeVisible();
    await expect(page.getByText("Pending review")).toBeVisible();
  });

  test("own pending confession is visible on its detail page", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const content = `E2E detail confession ${Date.now()}`;
    const created = await page.request.post("/api/confessions", {
      data: { content },
    });
    expect(created.status()).toBe(202);
    const activity = await page.request.get("/api/me/activity");
    const data = (await activity.json()) as {
      confessions: { id: string; content: string }[];
    };
    const item = data.confessions.find((c) => c.content === content);
    expect(item).toBeDefined();

    await page.goto(`/post/${item!.id}`);
    await expect(page.getByText("Your confession")).toBeVisible();
    await expect(page.getByText("Pending review")).toBeVisible();
  });
});
