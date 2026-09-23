import { test, expect } from "@playwright/test";
import { registerViaApi, uniqueUser } from "./helpers";

// webServer sets E2E_SKIP_RATE_LIMIT=1, so the search rate limiter is bypassed
// in e2e runs — no 429 flakiness here.

test.describe("discovery", () => {
  test("search, random, and today return feed shapes for logged-in users", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);

    const search = await page.request.get("/api/confessions/search?q=veil");
    expect(search.status()).toBe(200);
    const searchData = (await search.json()) as {
      confessions: unknown[];
      nextCursor: unknown;
    };
    expect(Array.isArray(searchData.confessions)).toBe(true);
    expect(searchData.nextCursor).toBeNull();

    const random = await page.request.get("/api/confessions/random");
    expect(random.status()).toBe(200);
    const randomData = (await random.json()) as { confessions: unknown[] };
    expect(Array.isArray(randomData.confessions)).toBe(true);

    const today = await page.request.get("/api/confessions/today");
    expect(today.status()).toBe(200);
    const todayData = (await today.json()) as { confessions: unknown[] };
    expect(Array.isArray(todayData.confessions)).toBe(true);
  });

  test("search validates the query", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);

    const missing = await page.request.get("/api/confessions/search");
    expect(missing.status()).toBe(400);

    const empty = await page.request.get("/api/confessions/search?q=");
    expect(empty.status()).toBe(400);
    const emptyBody = (await empty.json()) as { error: unknown };
    expect(typeof emptyBody.error).toBe("string");

    const overlong = await page.request.get(
      `/api/confessions/search?q=${"a".repeat(101)}`,
    );
    expect(overlong.status()).toBe(400);
  });

  test("discovery endpoints reject anonymous requests", async ({ page }) => {
    const search = await page.request.get("/api/confessions/search?q=veil");
    expect(search.status()).toBe(401);

    const random = await page.request.get("/api/confessions/random");
    expect(random.status()).toBe(401);

    const today = await page.request.get("/api/confessions/today");
    expect(today.status()).toBe(401);
  });
});
