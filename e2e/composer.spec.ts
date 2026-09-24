import { test, expect } from "@playwright/test";
import { registerViaApi, uniqueUser } from "./helpers";

test.describe("composer", () => {
  test("post with a type stores the type", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const created = await page.request.post("/api/confessions", {
      data: {
        title: "E2E typed",
        content: `E2E typed post ${Date.now()}`,
        type: "question",
      },
    });
    expect(created.status()).toBe(202);
    const { confession } = (await created.json()) as { confession: { id: string } };
    const detail = await page.request.get(`/api/confessions/${confession.id}`);
    expect(detail.status()).toBe(200);
    const data = (await detail.json()) as { type: string | null; anonymous: boolean };
    expect(data.type).toBe("question");
    expect(data.anonymous).toBe(false);
  });

  test("post with an invalid type is rejected", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const created = await page.request.post("/api/confessions", {
      data: { content: `E2E invalid type ${Date.now()}`, type: "not-a-type" },
    });
    expect(created.status()).toBe(400);
  });

  test("anonymous post flags anonymous on the detail API", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const created = await page.request.post("/api/confessions", {
      data: { content: `E2E anonymous post ${Date.now()}`, anonymous: true },
    });
    expect(created.status()).toBe(202);
    const { confession } = (await created.json()) as { confession: { id: string } };
    const detail = await page.request.get(`/api/confessions/${confession.id}`);
    expect(detail.status()).toBe(200);
    const data = (await detail.json()) as { anonymous: boolean; nickname: string };
    expect(data.anonymous).toBe(true);
  });

  test("feed list filters by type and rejects invalid types", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const ok = await page.request.get("/api/confessions?type=thought");
    expect(ok.status()).toBe(200);
    const bad = await page.request.get("/api/confessions?type=bogus");
    expect(bad.status()).toBe(400);
  });
});
