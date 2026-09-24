import { test, expect, request as pwRequest } from "@playwright/test";
import { registerViaApi, uniqueUser } from "./helpers";

test.describe("borrow/lend", () => {
  test("offer, claim, conflict, return, close", async ({ page }) => {
    const userA = uniqueUser("lender");
    await registerViaApi(page, userA);

    const created = await page.request.post("/api/borrow", {
      data: { title: `E2E item ${Date.now()}`, description: "e2e", category: "books" },
    });
    expect(created.status()).toBe(201);
    const { item } = (await created.json()) as { item: { id: string } };
    const id = item.id;

    const bctx = await pwRequest.newContext();
    const userB = uniqueUser("borrower");
    const regB = await bctx.post("/api/auth/register", {
      data: { username: userB.username, password: userB.password, nickname: userB.nickname },
    });
    expect(regB.status()).toBe(201);

    const claim = await bctx.post(`/api/borrow/${id}`, { data: { action: "CLAIM" } });
    expect(claim.status()).toBe(200);
    const claimed = (await claim.json()) as { item: { status: string } };
    expect(claimed.item.status).toBe("BORROWED");

    const claimAgain = await bctx.post(`/api/borrow/${id}`, { data: { action: "CLAIM" } });
    expect(claimAgain.status()).toBe(409);

    const returned = await page.request.post(`/api/borrow/${id}`, {
      data: { action: "RETURNED" },
    });
    expect(returned.status()).toBe(200);
    const closed = await page.request.post(`/api/borrow/${id}`, {
      data: { action: "CLOSED" },
    });
    expect(closed.status()).toBe(200);
    const closedItem = (await closed.json()) as { item: { status: string } };
    expect(closedItem.item.status).toBe("CLOSED");
    await bctx.dispose();
  });

  test("invalid category and unauthenticated are rejected", async ({ page }) => {
    const user = uniqueUser("lender");
    await registerViaApi(page, user);
    const bad = await page.request.post("/api/borrow", {
      data: { title: "x", category: "not-a-category" },
    });
    expect(bad.status()).toBe(400);
    const anon = await pwRequest.newContext();
    const list = await anon.get("/api/borrow");
    expect(list.status()).toBe(401);
    await anon.dispose();
  });
});
