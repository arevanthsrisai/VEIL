import { test, expect } from "@playwright/test";
import { registerViaApi, registerViaUi, uniqueUser } from "./helpers";

type MeResponse = {
  user: {
    id: string;
    nickname: string;
    avatar_emoji: string;
    role: string;
    must_change_password?: boolean;
    username?: unknown;
  };
};

test.describe("profile", () => {
  test("profile requires auth", async ({ page }) => {
    const get = await page.request.get("/api/profile");
    expect(get.status()).toBe(401);
    const patch = await page.request.patch("/api/profile", { data: { nickname: "x" } });
    expect(patch.status()).toBe(401);
    const pw = await page.request.post("/api/profile/password", {
      data: { currentPassword: "a", newPassword: "b" },
    });
    expect(pw.status()).toBe(401);
    const sessions = await page.request.get("/api/profile/sessions");
    expect(sessions.status()).toBe(401);
  });

  test("PATCH updates nickname and avatar", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const res = await page.request.patch("/api/profile", {
      data: { nickname: "Renamed Ghost", avatar_emoji: "🦊" },
    });
    expect(res.status()).toBe(200);
    const data = (await res.json()) as MeResponse & { user: MeResponse["user"] };
    expect(data.user.nickname).toBe("Renamed Ghost");
    expect(data.user.avatar_emoji).toBe("🦊");
    // persisted + visible via /api/auth/me
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(200);
    const meData = (await me.json()) as MeResponse;
    expect(meData.user.nickname).toBe("Renamed Ghost");
    expect(meData.user.avatar_emoji).toBe("🦊");
    expect(meData.user.must_change_password).toBe(false);
  });

  test("PATCH ignores the username field", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const res = await page.request.patch("/api/profile", {
      data: { username: "hacked_name", nickname: "Still Original" },
    });
    expect(res.status()).toBe(200);
    // username is private — /api/auth/me never returns it; prove it's unchanged
    // by logging in with the original username
    const login = await page.request.post("/api/auth/login", {
      data: { username: user.username, password: user.password },
    });
    expect(login.status()).toBe(200);
    const meData = (await (await page.request.get("/api/auth/me")).json()) as MeResponse;
    expect(meData.user.nickname).toBe("Still Original");
    expect(meData.user.username).toBeUndefined();
  });

  test("password change: wrong current rejected, correct accepted", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const bad = await page.request.post("/api/profile/password", {
      data: { currentPassword: "WrongPass123!", newPassword: "NewPassword456!" },
    });
    expect(bad.status()).toBe(401);
    const badData = (await bad.json()) as { error?: string };
    expect(badData.error).toBe("Current password is incorrect.");
    const good = await page.request.post("/api/profile/password", {
      data: { currentPassword: user.password, newPassword: "NewPassword456!" },
    });
    expect(good.status()).toBe(200);
    const goodData = (await good.json()) as { ok?: boolean };
    expect(goodData.ok).toBe(true);
    // the new password works for login
    const relogin = await page.request.post("/api/auth/login", {
      data: { username: user.username, password: "NewPassword456!" },
    });
    expect(relogin.status()).toBe(200);
  });

  test("password change invalidates other sessions but keeps the current one", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user); // session A (this context)
    const browser = page.context().browser();
    if (!browser) throw new Error("no browser");
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const login2 = await page2.request.post("/api/auth/login", {
      data: { username: user.username, password: user.password },
    });
    expect(login2.status()).toBe(200); // session B
    // change password from context 2 → kills session A, keeps B
    const change = await page2.request.post("/api/profile/password", {
      data: { currentPassword: user.password, newPassword: "NewPassword456!" },
    });
    expect(change.status()).toBe(200);
    const meA = await page.request.get("/api/auth/me");
    expect(meA.status()).toBe(401);
    const meB = await page2.request.get("/api/auth/me");
    expect(meB.status()).toBe(200);
    await ctx2.close();
  });

  test("sessions list returns masked ids", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user);
    const res = await page.request.get("/api/profile/sessions");
    expect(res.status()).toBe(200);
    const data = (await res.json()) as { sessions: { id: string; expires_at: string }[] };
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(data.sessions.length).toBeGreaterThan(0);
    for (const s of data.sessions) {
      expect(s.id).toMatch(/^[0-9a-f]{8}…$/);
      expect(typeof s.expires_at).toBe("string");
      expect(s.id.length).toBeLessThan(64); // never the full token hash
    }
  });

  test("sessions DELETE logout-all-others keeps the current session", async ({ page }) => {
    const user = uniqueUser();
    await registerViaApi(page, user); // session A (this context)
    const browser = page.context().browser();
    if (!browser) throw new Error("no browser");
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const login2 = await page2.request.post("/api/auth/login", {
      data: { username: user.username, password: user.password },
    });
    expect(login2.status()).toBe(200); // session B
    // logout-all-others from context A → kills B, keeps A
    const del = await page.request.delete("/api/profile/sessions", {
      data: {},
    });
    expect(del.status()).toBe(200);
    const meA = await page.request.get("/api/auth/me");
    expect(meA.status()).toBe(200);
    const meB = await page2.request.get("/api/auth/me");
    expect(meB.status()).toBe(401);
    await ctx2.close();
  });

  test("profile page redirects when logged out", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("profile page shows identity and saves edits", async ({ page }) => {
    const user = uniqueUser();
    await registerViaUi(page, user);
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
    await expect(page.getByLabel("Nickname (public)")).toHaveValue(user.nickname);
    await expect(page.getByText("Member since")).toBeVisible();
    await expect(page.getByLabel("Current password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out everywhere else" })).toBeVisible();
    await page.getByLabel("Nickname (public)").fill("E2E Renamed");
    await page.getByRole("button", { name: "Save identity" }).click();
    await expect(page.getByText("Identity updated", { exact: false })).toBeVisible();
  });
});
