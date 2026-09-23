import { test, expect } from "@playwright/test";
import { registerViaApi, uniqueUser } from "./helpers";

test.describe("bookmarks", () => {
  test("save and remove a bookmark via api", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);

    const feed = await page.request.get("/api/confessions?limit=1");
    const feedData = (await feed.json()) as { confessions: { id: string }[] };
    test.skip(feedData.confessions.length === 0, "no approved confession seeded");
    const id = feedData.confessions[0].id;

    const save = await page.request.post("/api/bookmarks", {
      data: { confessionId: id },
    });
    expect(save.status()).toBe(201);
    expect(((await save.json()) as { bookmarked: boolean }).bookmarked).toBe(true);

    const saved = await page.request.get("/api/me/bookmarks");
    expect(saved.status()).toBe(200);
    const savedData = (await saved.json()) as { confessions: { id: string }[] };
    expect(savedData.confessions.some((c) => c.id === id)).toBe(true);

    const remove = await page.request.delete(`/api/bookmarks/${id}`);
    expect(remove.status()).toBe(200);
    expect(((await remove.json()) as { bookmarked: boolean }).bookmarked).toBe(false);

    const after = await page.request.get("/api/me/bookmarks");
    const afterData = (await after.json()) as { confessions: { id: string }[] };
    expect(afterData.confessions.some((c) => c.id === id)).toBe(false);

    // unauthenticated requests are rejected
    await page.context().clearCookies();
    const anon = await page.request.post("/api/bookmarks", { data: { confessionId: id } });
    expect(anon.status()).toBe(401);
  });
});
