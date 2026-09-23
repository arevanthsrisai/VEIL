import { test, expect } from "@playwright/test";
import { registerViaApi, uniqueUser } from "./helpers";

const NULL_UUID = "00000000-0000-0000-0000-000000000000";

async function createPostViaApi(page: import("@playwright/test").Page): Promise<string> {
  const created = await page.request.post("/api/confessions", {
    data: { content: `Veil moderation extended e2e post ${Date.now()}` },
  });
  expect(created.status()).toBe(202);
  const data = (await created.json()) as { confession: { id: string } };
  return data.confession.id;
}

test.describe("moderation hide/restore + restriction gating", () => {
  test("HIDDEN action is staff-only — plain user gets 403", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const postId = await createPostViaApi(page);
    const res = await page.request.post(`/api/moderation/confessions/${postId}`, {
      data: { action: "HIDDEN" },
    });
    expect(res.status()).toBe(403);
  });

  test("RESTORED action is staff-only — plain user gets 403", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const postId = await createPostViaApi(page);
    const res = await page.request.post(`/api/moderation/confessions/${postId}`, {
      data: { action: "RESTORED" },
    });
    expect(res.status()).toBe(403);
  });

  test("restrict route is admin-only — plain user gets 403", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const res = await page.request.post(`/api/admin/users/${NULL_UUID}/restrict`, {
      data: { days: 7 },
    });
    expect(res.status()).toBe(403);
  });

  test("restrict route unauthenticated gets 401", async ({ page }) => {
    const res = await page.request.post(`/api/admin/users/${NULL_UUID}/restrict`, {
      data: { days: 7 },
    });
    expect(res.status()).toBe(401);
  });

  test("normal user login is unaffected by restriction changes", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const login = await page.request.post("/api/auth/login", {
      data: { username: user.username, password: user.password },
    });
    expect(login.status()).toBe(200);
    const data = (await login.json()) as { user?: { nickname: string } };
    expect(data.user?.nickname).toBeTruthy();
    // username is private — never in any API response
    expect(JSON.stringify(data)).not.toContain(user.username);
  });
});

// Moderator/admin flows need a moderator or admin account. There is no bootstrap
// helper in e2e/helpers — create one against the target DB with
// `node scripts/bootstrap-admin.mjs <username> <password>` and unskip.
test.describe("moderation hide/restore + restriction moderator/admin flows", () => {
  test.fixme(
    "moderator hides an approved post, author can still log in, restore brings it back",
    async () => {
      // 1. user registers + creates a post; moderator approves it (202 → APPROVED)
      // 2. moderator POSTs { action: "HIDDEN" } → 200; post shows REJECTED + "Hidden by moderation"
      // 3. author login still returns 200
      // 4. moderator POSTs { action: "RESTORED" } → 200; post is APPROVED again in the feed
    }
  );

  test.fixme(
    "admin restricts a user for 7 days, login returns 403, unrestrict restores login",
    async () => {
      // 1. admin POSTs /api/admin/users/<id>/restrict { days: 7 } → 200
      // 2. user login → 403 "Account restricted. Try again later.", no session cookie set
      // 3. admin POSTs { days: null } → 200
      // 4. user login → 200
    }
  );

  test.fixme("admin cannot restrict a moderator or admin (409)", async () => {
    // POST /api/admin/users/<moderator-id>/restrict { days: 7 } → 409
  });
});
