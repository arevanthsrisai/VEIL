import { test, expect, request as pwRequest } from "@playwright/test";
import { registerViaApi, uniqueUser } from "./helpers";
import { Pool } from "pg";

test.skip(!process.env.DATABASE_URL, "DATABASE_URL required to run admin flows");

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "" });
test.afterAll(async () => {
  await pool.end();
});

const ADMIN = { username: "e2e_admin", password: "AdminPass123" };

async function loginAdmin(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/login", { data: ADMIN });
  test.skip(res.status() !== 200, "e2e_admin not bootstrapped — run scripts/bootstrap-admin.mjs");
}

test.describe("admin flows", () => {
  test("admin can create a poll", async ({ page }) => {
    await loginAdmin(page);
    const res = await page.request.post("/api/polls", {
      data: {
        question: "E2E admin poll?",
        options: ["Yes", "No"],
      },
    });
    expect(res.status()).toBe(201);
    const list = await page.request.get("/api/polls");
    const data = (await list.json()) as { polls: { question: string }[] };
    expect(data.polls.some((p) => p.question === "E2E admin poll?")).toBe(true);
  });

  test("admin settings can be updated", async ({ page }) => {
    await loginAdmin(page);
    const res = await page.request.put("/api/admin/settings", {
      data: { key: "announcement", value: "E2E announcement" },
    });
    expect(res.status()).toBe(200);
    const pub = await page.request.get("/api/announcements");
    const data = (await pub.json()) as { announcement: string | null };
    expect(data.announcement).toBe("E2E announcement");
    await page.request.put("/api/admin/settings", {
      data: { key: "announcement", value: "" },
    });
  });

  test("admin hides an approved post; anonymous loses access; restore brings it back", async ({
    page,
  }) => {
    await loginAdmin(page);
    const anon = await pwRequest.newContext();
    const user = uniqueUser();
    const reg = await anon.post("/api/auth/register", {
      data: { username: user.username, password: user.password, nickname: user.nickname },
    });
    expect(reg.status()).toBe(201);
    const stranger = await pwRequest.newContext();
    const created = await anon.post("/api/confessions", {
      data: { content: `E2E hide test ${Date.now()}` },
    });
    expect(created.status()).toBe(202);
    const { confession } = (await created.json()) as { confession: { id: string } };
    const id = confession.id;

    const before = await stranger.get(`/api/confessions/${id}`);
    expect(before.status()).toBe(404);

    const approve = await page.request.post(`/api/moderation/confessions/${id}`, {
      data: { action: "APPROVED" },
    });
    expect(approve.status()).toBe(200);

    const hide = await page.request.post(`/api/moderation/confessions/${id}`, {
      data: { action: "HIDDEN" },
    });
    expect(hide.status()).toBe(200);
    const hidden = await stranger.get(`/api/confessions/${id}`);
    expect(hidden.status()).toBe(404);

    const restore = await page.request.post(`/api/moderation/confessions/${id}`, {
      data: { action: "RESTORED" },
    });
    expect(restore.status()).toBe(200);
    const restored = await stranger.get(`/api/confessions/${id}`);
    expect(restored.status()).toBe(200);
    await anon.dispose();
    await stranger.dispose();
  });

  test("admin restricts a user for 7 days; login returns 403; unrestrict restores login", async ({
    page,
  }) => {
    await loginAdmin(page);
    const bctx = await pwRequest.newContext();
    const user = uniqueUser("victim");
    const reg = await bctx.post("/api/auth/register", {
      data: { username: user.username, password: user.password, nickname: user.nickname },
    });
    expect(reg.status()).toBe(201);

    const restrict = await page.request.post(
      `/api/admin/users/${(await bctx.get("/api/auth/me").then((r) => r.json() as Promise<{ user: { id: string } }>)).user.id}/restrict`,
      { data: { days: 7 } },
    );
    expect(restrict.status()).toBe(200);

    const bctx2 = await pwRequest.newContext();
    const denied = await bctx2.post("/api/auth/login", {
      data: { username: user.username, password: user.password },
    });
    expect(denied.status()).toBe(403);

    const meId = await bctx.get("/api/auth/me").then((r) => r.json() as Promise<{ user: { id: string } }>);
    void meId;
    const targetId = await pool
      .query<{ id: string }>(`SELECT id FROM users WHERE username = $1`, [user.username])
      .then((r) => r.rows[0].id);
    const unrestrict = await page.request.post(
      `/api/admin/users/${targetId}/restrict`,
      { data: { days: null } },
    );
    expect(unrestrict.status()).toBe(200);

    const allowed = await bctx2.post("/api/auth/login", {
      data: { username: user.username, password: user.password },
    });
    expect(allowed.status()).toBe(200);
    await bctx.dispose();
    await bctx2.dispose();
  });

  test("admin cannot restrict a moderator or admin (409)", async ({ page }) => {
    await loginAdmin(page);
    const adminId = await pool
      .query<{ id: string }>(`SELECT id FROM users WHERE username = $1`, [ADMIN.username])
      .then((r) => r.rows[0].id);
    const res = await page.request.post(`/api/admin/users/${adminId}/restrict`, {
      data: { days: 7 },
    });
    expect(res.status()).toBe(409);
  });
});
