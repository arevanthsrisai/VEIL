import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";
import { uniqueUser, type TestUser } from "./helpers";
import { Pool } from "pg";

test.skip(!process.env.DATABASE_URL, "DATABASE_URL required to run admin user management");

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "" });
test.afterAll(async () => {
  await pool.end();
});

const ADMIN = { username: "e2e_admin", password: "AdminPass123" };

async function loginAdmin(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/login", { data: ADMIN });
  test.skip(res.status() !== 200, "e2e_admin not bootstrapped — run scripts/bootstrap-admin.mjs");
}

async function registerUser(): Promise<{ ctx: APIRequestContext; user: TestUser }> {
  const ctx = await pwRequest.newContext();
  const user = uniqueUser();
  const reg = await ctx.post("/api/auth/register", {
    data: { username: user.username, password: user.password, nickname: user.nickname },
  });
  expect(reg.status()).toBe(201);
  return { ctx, user };
}

async function userIdFor(username: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE username = $1`,
    [username],
  );
  return rows[0].id;
}

test.describe("admin user management", () => {
  test("search filters the user list by nickname and username", async ({ page }) => {
    await loginAdmin(page);
    const { user } = await registerUser();

    const byNickname = await page.request.get(
      `/api/admin/users?search=${encodeURIComponent(user.nickname)}`,
    );
    expect(byNickname.status()).toBe(200);
    const nickData = (await byNickname.json()) as {
      users: { id: string; username: string; nickname: string; mustChangePassword: boolean; postCount: number }[];
    };
    expect(nickData.users.length).toBeGreaterThan(0);
    expect(nickData.users.some((u) => u.id !== "" && u.nickname === user.nickname)).toBe(true);
    expect(
      nickData.users.every((u) => u.nickname.toLowerCase().includes(user.nickname.toLowerCase())),
    ).toBe(true);
    // admin-only view fields are present
    expect(typeof nickData.users[0].username).toBe("string");
    expect(typeof nickData.users[0].postCount).toBe("number");
    expect(nickData.users[0].mustChangePassword).toBe(false);

    const byUsername = await page.request.get(
      `/api/admin/users?search=${encodeURIComponent(user.username)}`,
    );
    expect(byUsername.status()).toBe(200);
    const userData = (await byUsername.json()) as { users: { username: string }[] };
    expect(userData.users.length).toBeGreaterThan(0);
    expect(
      userData.users.every((u) => u.username.toLowerCase().includes(user.username.toLowerCase())),
    ).toBe(true);
  });

  test("non-admin cannot list or search users", async () => {
    const { ctx } = await registerUser();
    const list = await ctx.get("/api/admin/users?search=Testy");
    expect(list.status()).toBe(403);
    await ctx.dispose();
  });

  test("password reset invalidates the target's session and forces a change at next login", async ({
    page,
  }) => {
    await loginAdmin(page);
    const { ctx, user } = await registerUser();

    // old session works before the reset
    expect((await ctx.get("/api/auth/me")).status()).toBe(200);

    const targetId = await userIdFor(user.username);

    // validation: too short → 400
    const bad = await page.request.post(`/api/admin/users/${targetId}/password`, {
      data: { tempPassword: "short" },
    });
    expect(bad.status()).toBe(400);

    const reset = await page.request.post(`/api/admin/users/${targetId}/password`, {
      data: { tempPassword: "TempPass123!" },
    });
    expect(reset.status()).toBe(200);
    const resetData = (await reset.json()) as { ok: boolean; mustChangePassword: boolean };
    expect(resetData.ok).toBe(true);
    expect(resetData.mustChangePassword).toBe(true);
    // the temp password is never returned by the API
    expect(JSON.stringify(resetData)).not.toContain("TempPass123!");

    // old session invalidated — forced re-login
    expect((await ctx.get("/api/auth/me")).status()).toBe(401);

    // login with the temp password works and flags must-change
    const fresh = await pwRequest.newContext();
    const login = await fresh.post("/api/auth/login", {
      data: { username: user.username, password: "TempPass123!" },
    });
    expect(login.status()).toBe(200);
    const loginData = (await login.json()) as { mustChangePassword: boolean };
    expect(loginData.mustChangePassword).toBe(true);
    await ctx.dispose();
    await fresh.dispose();
  });

  test("removing a USER deletes their account and posts", async ({ page }) => {
    await loginAdmin(page);
    const { ctx, user } = await registerUser();
    const created = await ctx.post("/api/confessions", {
      data: { content: `E2E remove test ${Date.now()}` },
    });
    expect(created.status()).toBe(202);

    const targetId = await userIdFor(user.username);
    const del = await page.request.delete(`/api/admin/users/${targetId}`);
    expect(del.status()).toBe(200);

    // posts cascade-deleted
    const posts = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM confessions WHERE author_id = $1`,
      [targetId],
    );
    expect(posts.rows[0].count).toBe("0");

    // gone from the admin list and their session is dead
    const list = await page.request.get(
      `/api/admin/users?search=${encodeURIComponent(user.username)}`,
    );
    const listData = (await list.json()) as { users: { id: string }[] };
    expect(listData.users.length).toBe(0);
    expect((await ctx.get("/api/auth/me")).status()).toBe(401);

    // removing again → 404
    const again = await page.request.delete(`/api/admin/users/${targetId}`);
    expect(again.status()).toBe(404);
    await ctx.dispose();
  });

  test("removing a staff target returns 409", async ({ page }) => {
    await loginAdmin(page);
    const { ctx } = await registerUser();
    const me = (await (await ctx.get("/api/auth/me")).json()) as { user: { id: string } };
    const promote = await page.request.patch("/api/admin/users", {
      data: { userId: me.user.id, role: "MODERATOR" },
    });
    expect(promote.status()).toBe(200);

    const del = await page.request.delete(`/api/admin/users/${me.user.id}`);
    expect(del.status()).toBe(409);

    // cleanup: demote back so the test user doesn't linger as staff
    await page.request.patch("/api/admin/users", {
      data: { userId: me.user.id, role: "USER" },
    });
    await ctx.dispose();
  });

  test("removing yourself returns 409", async ({ page }) => {
    await loginAdmin(page);
    const adminId = await userIdFor(ADMIN.username);
    const del = await page.request.delete(`/api/admin/users/${adminId}`);
    expect(del.status()).toBe(409);
  });
});
